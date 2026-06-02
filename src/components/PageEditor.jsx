import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { filterSuggestionItems } from '@blocknote/core';
import '@blocknote/mantine/style.css';
import { Image as ImageIcon, Smile, X, ChevronRight, Shield, Map, Type, Palette, FileText, List, FileCode, AlignLeft, AlignCenter, Code as CodeIcon, FileCheck } from 'lucide-react';
import { schema } from '@/blocks/schema';
import { titleFontOptions } from '@/lib/pageStyleOptions';
import { ColorPickerPopover } from '@/components/ColorPicker';
import MoreFontsModal from '@/components/MoreFontsModal';
import { ensureGoogleFont, buildStack, GOOGLE_FONTS_CATALOG } from '@/lib/googleFonts';

const CATALOG_BY_FAMILY = Object.fromEntries(GOOGLE_FONTS_CATALOG.map(([family, cat]) => [family, cat]));
import { TEMPLATES } from '@/lib/pageTemplates';
import MarkdownEditor from '@/components/MarkdownEditor';
import EditorContextMenu from '@/components/EditorContextMenu';
import IconPicker from '@/components/IconPicker';
import { renderIcon } from '@/lib/iconRegistry';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAncestors(page, pages) {
  const chain = [];
  let current = page;
  while (current?.parentId) {
    const parent = pages.find((p) => p.id === current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PageEditor(props) {
  // Route to MarkdownPageEditor when either the page is explicitly marked
  // markdown mode OR the loaded content is a raw string (which BlockNote
  // can't consume — that's the legacy/imported shape for markdown pages).
  const isMarkdown =
    props.page?.mode === 'markdown' || typeof props.initialBlocks === 'string';
  if (isMarkdown) {
    return <MarkdownPageEditor {...props} />;
  }
  return <BlockPageEditor {...props} />;
}

function BlockPageEditor({ page, allPages = [], initialBlocks, updatePage, saveContent, createPage }) {
  const [title, setTitle]       = useState(page?.title ?? 'Untitled');
  const [icon, setIcon]         = useState(page?.icon ?? null);
  const [cover, setCover]       = useState(page?.cover ?? null);
  const [fontClass, setFontClass] = useState(page?.fontClass ?? '');
  const [titleColor, setTitleColor] = useState(page?.titleColor ?? '#e8e8e8');
  const [iconAnchor, setIconAnchor] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [headings, setHeadings] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(!initialBlocks?.length);
  const [wordCount, setWordCount] = useState({ words: 0, blocks: 0 });
  const [titleSize, setTitleSize] = useState(page?.titleSize ?? 40);
  const [titleAlign, setTitleAlign] = useState(page?.titleAlign ?? 'left');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [fontFamily, setFontFamily] = useState(page?.fontFamily ?? '');
  const [moreFontsOpen, setMoreFontsOpen] = useState(false);
  const navigate = useNavigate();
  const coverInputRef = useRef(null);
  const editorWrapperRef = useRef(null);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);

  const editor = useCreateBlockNote({
    schema,
    initialContent: Array.isArray(initialBlocks) && initialBlocks.length ? initialBlocks : undefined,
    // Disable browser spellcheck on the ProseMirror contenteditable at
    // editor-creation time, so we don't need a MutationObserver to fight
    // ProseMirror over the attribute. The previous observer-based fix
    // re-queried the DOM on every block mutation, which made pages with
    // many cards crawl in Firefox.
    domAttributes: {
      editor: { spellcheck: 'false' },
    },
    uploadFile: async (file) => {
      // Local-first: convert to data URL and embed inline.
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
  });

  useEffect(() => {
    setTitle(page?.title ?? 'Untitled');
    setIcon(page?.icon ?? null);
    setCover(page?.cover ?? null);
    setFontClass(page?.fontClass ?? '');
    setTitleColor(page?.titleColor ?? '#e8e8e8');
    setTitleSize(page?.titleSize ?? 40);
    setTitleAlign(page?.titleAlign ?? 'left');
    setFontFamily(page?.fontFamily ?? '');
  }, [page?.id]);

  // Ensure dynamic Google Font is loaded when chosen.
  useEffect(() => {
    if (fontFamily) ensureGoogleFont(fontFamily);
  }, [fontFamily]);

  const handleMoreFontSelect = useCallback((family) => {
    setFontFamily(family);
    setFontClass('');
    updatePage(page.id, { fontFamily: family, fontClass: '' });
    ensureGoogleFont(family);
  }, [page?.id, updatePage]);

  const handleTitleAlignChange = useCallback((align) => {
    setTitleAlign(align);
    updatePage(page.id, { titleAlign: align });
  }, [page?.id, updatePage]);

  const handleTitleSizeChange = useCallback((size) => {
    setTitleSize(size);
    updatePage(page.id, { titleSize: size });
    requestAnimationFrame(() => {
      if (titleRef.current) {
        titleRef.current.style.height = 'auto';
        titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
      }
    });
  }, [page?.id, updatePage]);

  // Resize title textarea whenever its content or font-size changes.
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [title, titleSize]);

  // Extra markdown shortcuts BlockNote doesn't ship with. The built-in input
  // rules trigger on whitespace (e.g. typing ``` then SPACE converts to a
  // code block), but most users instinctively reach for Enter after the
  // closing fence — same as in GitBook, Notion, or a plain Markdown editor.
  // This handler watches for those Enter-triggered patterns and runs the
  // conversion before ProseMirror inserts a new line.
  useEffect(() => {
    if (!editor) return;
    const pmView = editor.prosemirrorView || editor._tiptapEditor?.view;
    const dom = pmView?.dom;
    if (!dom) return;

    const handler = (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const cursor = editor.getTextCursorPosition?.();
      const block = cursor?.block;
      if (!block || block.type !== 'paragraph') return;
      const text = (block.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');

      // ``` or ```lang at the start of a paragraph → code block.
      const codeMatch = text.match(/^```(\w*)$/);
      if (codeMatch) {
        e.preventDefault();
        e.stopPropagation();
        const lang = codeMatch[1] || 'text';
        editor.updateBlock(block, { type: 'codeBlock', props: { language: lang }, content: [] });
        editor.setTextCursorPosition(block, 'start');
        return;
      }

      // --- alone on a paragraph → divider, then put cursor on the next line.
      if (text === '---') {
        e.preventDefault();
        e.stopPropagation();
        editor.updateBlock(block, { type: 'divider', props: {}, content: [] });
        const [next] = editor.insertBlocks([{ type: 'paragraph' }], block, 'after');
        editor.setTextCursorPosition(next, 'start');
        return;
      }
    };

    dom.addEventListener('keydown', handler, true);
    return () => dom.removeEventListener('keydown', handler, true);
  }, [editor]);

  // Inject a copy button into every code block's header bar. BlockNote
  // re-renders blocks on every edit; without throttling, a MutationObserver
  // here used to fire on every keystroke and scan the entire editor tree
  // — that's what was freezing the browser on big pages. Now we:
  //   1. Batch all observed mutations into one rAF callback
  //   2. Only check nodes inside `addedNodes`, never the whole tree
  //   3. Bail out fast when a mutation is purely text (no structural change)
  useEffect(() => {
    if (!editor) return;
    const pmView = editor.prosemirrorView || editor._tiptapEditor?.view;
    const root = pmView?.dom;
    if (!root) return;

    const COPY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    // For every code block we (a) inject a copy button as a direct child of
    // the block (sibling of the header wrapper, NOT a child of it, so the
    // invisible <select> covering the header can't eat the button's clicks),
    // and (b) reflect the selected language onto the header wrapper as a
    // `data-bn-lang` attribute so CSS can show it via `::before content:
    // attr(data-bn-lang)`. The header reads as a plain text label even
    // though the underlying <select> is what actually drives the language.
    const ensureCodeBlockChrome = (codeBlockEl) => {
      const header = codeBlockEl.querySelector(':scope > div:has(> select)');
      const select = header?.querySelector('select');

      // Reflect select.value → header[data-bn-lang] (and re-bind change listener once).
      if (header && select) {
        const setLang = () => {
          const opt = select.options[select.selectedIndex];
          const label = opt ? opt.textContent.trim() : (select.value || 'text');
          // Use the user-visible language NAME (e.g. "Bash / Shell") if it's short,
          // otherwise fall back to the canonical language id (`bash`, `python`).
          header.setAttribute('data-bn-lang', (label.length <= 18 ? label : select.value) || 'text');
        };
        setLang();
        if (!select.dataset.bnLangBound) {
          select.dataset.bnLangBound = '1';
          select.addEventListener('change', setLang);
        }
      }

      // Copy button — only inject once per code block.
      if (codeBlockEl.querySelector(':scope > .bn-copy-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bn-copy-btn';
      btn.title = 'Copy code';
      btn.setAttribute('contenteditable', 'false');
      btn.innerHTML = COPY_SVG;
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pre = codeBlockEl.querySelector(':scope > pre');
        const text = pre ? pre.innerText : '';
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add('copied');
          btn.innerHTML = CHECK_SVG;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = COPY_SVG;
          }, 1500);
        } catch {}
      });
      codeBlockEl.appendChild(btn);
    };

    // Initial sweep — only happens once when the page editor mounts.
    root.querySelectorAll('.bn-block-content[data-content-type="codeBlock"]').forEach(ensureCodeBlockChrome);

    let rafId = 0;
    const pendingNodes = new Set();
    const flush = () => {
      rafId = 0;
      for (const node of pendingNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.bn-block-content[data-content-type="codeBlock"]')) {
          ensureCodeBlockChrome(node);
        }
        // Only descend if the added subtree could plausibly contain a code
        // block. querySelectorAll on isolated subtrees is much cheaper than
        // scanning the whole editor.
        node.querySelectorAll?.('.bn-block-content[data-content-type="codeBlock"]').forEach(ensureCodeBlockChrome);
      }
      pendingNodes.clear();
    };

    const obs = new MutationObserver((records) => {
      let hasNew = false;
      for (const r of records) {
        if (r.type !== 'childList' || !r.addedNodes.length) continue;
        for (const n of r.addedNodes) {
          if (n.nodeType === 1) {        // Element only — skip text nodes
            pendingNodes.add(n);
            hasNew = true;
          }
        }
      }
      if (hasNew && !rafId) rafId = requestAnimationFrame(flush);
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [editor]);

  // The latest blocks BlockNote handed to onChange. Used by the unmount
  // flush below so a quick edit (e.g. apply colour and immediately navigate
  // away) doesn't get lost when the debounce timer is still pending.
  const pendingBlocksRef = useRef(null);
  const pageIdRef = useRef(page?.id);
  const saveContentRef = useRef(saveContent);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'dirty' | 'saving' | 'saved'
  useEffect(() => { pageIdRef.current = page?.id; }, [page?.id]);
  useEffect(() => { saveContentRef.current = saveContent; }, [saveContent]);

  const debouncedSave = useCallback((blocks) => {
    pendingBlocksRef.current = blocks;
    setSaveState('dirty');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        await saveContent(page.id, blocks);
        pendingBlocksRef.current = null;
        setSaveState('saved');
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch {
        setSaveState('dirty');
      }
    }, 600);
  }, [page?.id, saveContent]);

  // Manual save — bypasses the debounce so the user can guarantee a write
  // before navigating away or refreshing. Hook on Save button + Ctrl+S.
  const manualSave = useCallback(async () => {
    const blocks = pendingBlocksRef.current ?? editor.document;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!blocks || !page?.id) return;
    setSaveState('saving');
    try {
      await saveContent(page.id, blocks);
      pendingBlocksRef.current = null;
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch {
      setSaveState('dirty');
    }
  }, [editor, page?.id, saveContent]);

  // Ctrl+S / Cmd+S → manual save. Captured at window level so it fires
  // regardless of which child element has focus (sidebar, color picker,
  // toolbar button, etc.).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        manualSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manualSave]);

  // Flush any pending edits when the editor unmounts (e.g. user navigates
  // to another page right after changing a colour). Without this, edits
  // made in the last 600ms of the session would be silently dropped.
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingBlocksRef.current && pageIdRef.current && saveContentRef.current) {
      saveContentRef.current(pageIdRef.current, pendingBlocksRef.current);
      pendingBlocksRef.current = null;
    }
  }, []);

  const updateStats = useCallback(() => {
    let words = 0, blocks = 0;
    const visit = (bls) => {
      for (const block of bls) {
        if (['paragraph', 'heading', 'bulletListItem', 'numberedListItem', 'checkListItem'].includes(block.type)) {
          blocks++;
          const text = (block.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ');
          words += text.split(/\s+/).filter(Boolean).length;
        }
        if (block.children?.length) visit(block.children);
      }
    };
    visit(editor.document || []);
    setWordCount({ words, blocks });
  }, [editor]);

  useEffect(() => { updateStats(); }, [updateStats]);

  // Used by the empty-page template picker — replaces all content
  const applyTemplate = useCallback((template) => {
    if (!template.blocks?.length) return;
    editor.replaceBlocks(editor.document, template.blocks);
    setShowTemplatePicker(false);
  }, [editor]);

  // Dismiss the picker — start with an empty canvas where slash commands and
  // markdown shortcuts (``` for code, # for heading, /map for map, etc.) just work.
  const startBlank = useCallback(() => {
    setShowTemplatePicker(false);
    editor.focus();
  }, [editor]);

  // Used by the slash menu — inserts after cursor position
  const insertTemplate = useCallback((template) => {
    if (!template.blocks?.length) return;
    try {
      const cursor = editor.getTextCursorPosition().block;
      editor.insertBlocks(template.blocks, cursor, 'after');
    } catch {}
  }, [editor]);

  const extractHeadings = useCallback(() => {
    const result = [];
    const visit = (blocks) => {
      for (const block of blocks) {
        if (block.type === 'heading') {
          const text = (block.content || [])
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('');
          if (text) result.push({ id: block.id, level: block.props?.level ?? 1, text });
        }
        if (block.children?.length) visit(block.children);
      }
    };
    visit(editor.document || []);
    setHeadings(result);
  }, [editor]);

  useEffect(() => { extractHeadings(); }, [extractHeadings]);

  // Debounce the two doc-traversal helpers so they don't run on every
  // single keystroke. With many blocks on a page (e.g. an imported MITRE
  // library page with 30+ technique cards), running them inline made
  // typing feel laggy. 300ms is short enough that the headings panel and
  // word count still feel live but skips redundant work between strokes.
  const slowUpdateTimer = useRef(null);
  const handleEditorChange = useCallback(() => {
    debouncedSave(editor.document);
    clearTimeout(slowUpdateTimer.current);
    slowUpdateTimer.current = setTimeout(() => {
      extractHeadings();
      updateStats();
    }, 300);
  }, [debouncedSave, extractHeadings, updateStats, editor]);
  useEffect(() => () => clearTimeout(slowUpdateTimer.current), []);

  const scrollToHeading = useCallback((heading) => {
    const el = document.querySelector(`[data-id="${heading.id}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    try {
      const findBlock = (blocks, id) => {
        for (const b of blocks) {
          if (b.id === id) return b;
          const f = b.children?.length ? findBlock(b.children, id) : null;
          if (f) return f;
        }
        return null;
      };
      const block = findBlock(editor.document, heading.id);
      if (block) editor.setTextCursorPosition(block, 'start');
    } catch {}
  }, [editor]);

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    updatePage(page.id, { title: val || 'Untitled' });
  };

  const handleIconSelect = (emoji) => {
    setIcon(emoji);
    updatePage(page.id, { icon: emoji });
  };

  const handleCoverFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCover(ev.target.result);
      updatePage(page.id, { cover: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCover = () => {
    setCover(null);
    updatePage(page.id, { cover: null });
  };

  const handleFontChange = (e) => {
    setFontClass(e.target.value);
    setFontFamily('');
    updatePage(page.id, { fontClass: e.target.value, fontFamily: '' });
  };

  const handleColorChange = (hex) => {
    setTitleColor(hex);
    updatePage(page.id, { titleColor: hex });
  };

  // Custom slash menu items
  const getSlashItems = useCallback(async (query) => {
    const defaults = getDefaultReactSlashMenuItems(editor);
    const custom = [
      {
        title: 'Card',
        subtext: 'Technique card — overview, steps, code',
        aliases: ['card', 'technique', 'tactic'],
        group: 'Custom blocks',
        icon: <Shield className="h-4 w-4" />,
        onItemClick: () => {
          editor.insertBlocks(
            [{ type: 'card', props: { data: '' } }],
            editor.getTextCursorPosition().block,
            'after'
          );
        },
      },
      {
        title: 'Map',
        subtext: 'Columns of techniques — kill-chain board',
        aliases: ['map', 'board', 'kanban', 'columns', 'phases'],
        group: 'Custom blocks',
        icon: <Map className="h-4 w-4" />,
        onItemClick: () => {
          editor.insertBlocks(
            [{ type: 'map', props: { mapId: '' } }],
            editor.getTextCursorPosition().block,
            'after'
          );
        },
      },
      {
        title: 'Report',
        subtext: 'SysReptor pentest report — upload a design, fill it out, export PDF',
        aliases: ['report', 'sysreptor', 'pentest', 'finding', 'cvss', 'pdf'],
        group: 'Custom blocks',
        icon: <FileCheck className="h-4 w-4" />,
        onItemClick: () => {
          editor.insertBlocks(
            [{ type: 'report', props: { reportId: '' } }],
            editor.getTextCursorPosition().block,
            'after'
          );
        },
      },
      // BlockNote 0.50's default slash menu omits an entry for the codeBlock
      // spec we register in schema.js — so /code did nothing. Adding it here.
      {
        title: 'Code block',
        subtext: 'Syntax-highlighted code (bash, python, …)',
        aliases: ['code', 'codeblock', 'snippet', 'fence'],
        group: 'Basic blocks',
        icon: <CodeIcon className="h-4 w-4" />,
        onItemClick: () => {
          editor.insertBlocks(
            [{ type: 'codeBlock', props: { language: 'text' } }],
            editor.getTextCursorPosition().block,
            'after'
          );
        },
      },
      {
        title: 'Sub-page',
        subtext: 'Create a child page and insert a link',
        aliases: ['page', 'subpage', 'link'],
        group: 'Custom blocks',
        icon: <FileText className="h-4 w-4" />,
        onItemClick: async () => {
          if (!createPage) return;
          const cursor = editor.getTextCursorPosition().block;
          const newPage = await createPage({ title: 'Untitled', parentId: page.id });
          editor.insertBlocks(
            [{ type: 'pagelink', props: { pageId: newPage.id } }],
            cursor,
            'after'
          );
        },
      },
      ...TEMPLATES.map((tmpl) => ({
        title: tmpl.name,
        subtext: tmpl.description,
        group: 'Templates',
        icon: <span className="text-sm leading-none">{tmpl.icon}</span>,
        onItemClick: () => insertTemplate(tmpl),
      })),
    ];
    return filterSuggestionItems([...defaults, ...custom], query);
  }, [editor, createPage, page?.id, insertTemplate]);

  if (!page) return null;

  const ancestors = getAncestors(page, allPages);
  const editorFontStack = fontClass
    ? getComputedStyle(document.documentElement).getPropertyValue('--app-font') || ''
    : '';

  return (
    <div className="flex min-h-screen flex-col bg-[#1f1f1f]">
      {/* Breadcrumbs bar */}
      <div className="sticky top-0 z-10 flex h-[42px] flex-shrink-0 items-center border-b border-[#262626] bg-[#1f1f1f]/95 px-6 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-[12.5px] text-[#9a9a9a]">
          <Link to="/" className="rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]">
            Home
          </Link>
          {ancestors.map((ancestor) => (
            <React.Fragment key={ancestor.id}>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#6e6e6e]" />
              <Link
                to={`/page/${ancestor.id}`}
                className="max-w-[140px] truncate rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
              >
                {ancestor.icon && <span className="mr-1">{renderIcon(ancestor.icon)}</span>}
                {ancestor.title || 'Untitled'}
              </Link>
            </React.Fragment>
          ))}
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#6e6e6e]" />
          <button
            type="button"
            onClick={() => {
              const el = titleRef.current;
              if (!el) return;
              el.focus();
              // Caret at end so they can keep typing, or select-all to overwrite.
              const len = el.value.length;
              try { el.setSelectionRange(len, len); } catch {}
            }}
            className="truncate rounded px-1.5 py-0.5 text-left text-[#e8e8e8] transition-colors hover:bg-white/[0.045]"
            title="Click to rename"
          >
            {icon && <span className="mr-1">{renderIcon(icon)}</span>}
            {title || 'Untitled'}
          </button>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => setShowToc((v) => !v)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors ${
              showToc ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#9a9a9a] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
            }`}
            title="Outline"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors ${
              showSettings ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#9a9a9a] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
            }`}
            title="Page style"
          >
            <Type className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cover */}
      {cover && (
        <div
          className="group relative h-[200px] w-full flex-shrink-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${cover})` }}
        >
          <div className="absolute inset-0 bg-black/15" />
          <button
            onClick={handleRemoveCover}
            className="absolute right-6 top-4 flex items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1.5 text-[11.5px] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3" /> Remove cover
          </button>
        </div>
      )}

      {/* Page header */}
      <div className={`mx-auto w-full max-w-[1280px] px-16 ${cover ? 'pt-6' : 'pt-12'}`}>
        {/* Icon */}
        {icon && (
          <div className="mb-3 inline-block">
            <button
              onClick={(e) => setIconAnchor(e.currentTarget)}
              className="text-[64px] leading-none transition-opacity hover:opacity-70"
              title="Change icon"
            >
              {renderIcon(icon)}
            </button>
          </div>
        )}

        {/* Add controls (icon / cover) */}
        <div className="mb-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100">
          {!icon && (
            <button
              onClick={(e) => setIconAnchor(e.currentTarget)}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] text-[#7a7a7a] transition-colors hover:bg-white/[0.045] hover:text-[#c4c4c4]"
            >
              <Smile className="h-3.5 w-3.5" /> Add icon
            </button>
          )}
          {!cover && (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] text-[#7a7a7a] transition-colors hover:bg-white/[0.045] hover:text-[#c4c4c4]"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Add cover
            </button>
          )}
        </div>

        {iconAnchor && (
          <IconPicker
            anchorEl={iconAnchor}
            onSelect={handleIconSelect}
            onClose={() => setIconAnchor(null)}
          />
        )}

        <input type="file" accept="image/*" className="hidden" ref={coverInputRef} onChange={handleCoverFile} />

        {/* Per-page style settings. The font dropdown sets the page's *default*
            font (Google Docs' "Document defaults"). Individual selections can
            still override it via right-click → Font in the editor body. */}
        {showSettings && (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#232323] px-4 py-3">
            <div className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-[#7a7a7a]" />
              <select
                value={fontFamily ? '' : fontClass}
                onChange={handleFontChange}
                className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#e8e8e8] outline-none"
              >
                <option value="">Default</option>
                {titleFontOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => setMoreFontsOpen(true)}
                className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#c4c4c4] transition-colors hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
                title="Browse Google Fonts"
              >
                {fontFamily ? <span style={{ fontFamily: buildStack(fontFamily, CATALOG_BY_FAMILY[fontFamily] || 'sans') }}>{fontFamily}</span> : 'More fonts…'}
              </button>
            </div>
            <div className="relative flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-[#7a7a7a]" />
              <label className="text-[12px] text-[#7a7a7a]">Title color</label>
              <button
                onClick={() => setColorPickerOpen((v) => !v)}
                className="h-6 w-10 rounded border border-[#2a2a2a] transition-transform hover:scale-105"
                style={{ background: titleColor }}
                title="Choose color"
              />
              {colorPickerOpen && (
                <div className="absolute left-0 top-full z-50 mt-1">
                  <ColorPickerPopover
                    value={titleColor}
                    onChange={handleColorChange}
                    onClose={() => setColorPickerOpen(false)}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-0.5">
              <button
                onClick={() => handleTitleAlignChange('left')}
                className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
                  titleAlign === 'left' ? 'bg-white/[0.08] text-[#e8e8e8]' : 'text-[#7a7a7a] hover:text-[#c4c4c4]'
                }`}
                title="Align title left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleTitleAlignChange('center')}
                className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
                  titleAlign === 'center' ? 'bg-white/[0.08] text-[#e8e8e8]' : 'text-[#7a7a7a] hover:text-[#c4c4c4]'
                }`}
                title="Align title center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <MoreFontsModal
          open={moreFontsOpen}
          value={fontFamily}
          onSelect={handleMoreFontSelect}
          onClose={() => setMoreFontsOpen(false)}
        />

        {/* Title — textarea so long titles wrap onto multiple lines.
            Subtle background on hover/focus makes it visually obvious this
            is interactive (otherwise it reads as static page heading). */}
        <textarea
          ref={titleRef}
          data-page-title
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          rows={1}
          spellCheck={false}
          className={`mb-1 w-full resize-none overflow-hidden rounded bg-transparent font-bold leading-tight tracking-tight placeholder-[#3a3a3a] outline-none transition-colors hover:bg-white/[0.025] focus:bg-white/[0.04] ${fontFamily ? '' : fontClass}`}
          style={{
            fontFamily: fontFamily
              ? buildStack(fontFamily, CATALOG_BY_FAMILY[fontFamily] || 'sans')
              : (fontClass ? undefined : 'var(--app-font, Inter, sans-serif)'),
            color: titleColor,
            fontSize: `${titleSize}px`,
            textAlign: titleAlign,
          }}
          onInput={(e) => {
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); editor.focus(); }
          }}
        />
      </div>

      {/* Template picker — shown on empty pages */}
      {showTemplatePicker && (
        <div className="mx-auto w-full max-w-[1280px] px-16 pb-4 pt-4">
          <div className="rounded-xl border border-[#2a2a2a] bg-[#232323] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#c4c4c4]">Start with a template</span>
              <button
                onClick={() => setShowTemplatePicker(false)}
                className="flex h-6 w-6 items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.05] hover:text-[#c4c4c4]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={startBlank}
                className="flex flex-col items-start gap-1 rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] p-3 text-left transition-colors hover:border-[#3a3a3a] hover:bg-[#272727]"
              >
                <FileCode className="h-[18px] w-[18px] text-[#9a9a9a]" strokeWidth={1.7} />
                <span className="mt-1 text-[12.5px] font-medium text-[#e8e8e8]">Blank</span>
                <span className="text-[11px] leading-snug text-[#7a7a7a]">Type / for commands</span>
              </button>
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => applyTemplate(tmpl)}
                  className="flex flex-col items-start gap-1 rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] p-3 text-left transition-colors hover:border-[#3a3a3a] hover:bg-[#272727]"
                >
                  <span className="text-[18px] leading-none">{tmpl.icon}</span>
                  <span className="mt-1 text-[12.5px] font-medium text-[#e8e8e8]">{tmpl.name}</span>
                  <span className="text-[11px] leading-snug text-[#7a7a7a]">{tmpl.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BlockNote editor — aligned with the title's px-16 so content and title sit on the same left edge.
          The wrapper carries the page's chosen default font (fontClass or fontFamily); selections can
          override it via the right-click Font picker (FontFamily inline style on the run). */}
      <div
        ref={editorWrapperRef}
        className={`blocknote-wrapper mx-auto w-full max-w-[1280px] flex-1 px-16 pb-32 ${fontFamily ? '' : fontClass}`}
        spellCheck={false}
        style={
          fontFamily
            ? { fontFamily: buildStack(fontFamily, CATALOG_BY_FAMILY[fontFamily] || 'sans') }
            : (fontClass ? undefined : { fontFamily: 'var(--app-font, Inter, sans-serif)' })
        }
      >
        <BlockNoteView
          editor={editor}
          theme="dark"
          onChange={handleEditorChange}
        >
          <SuggestionMenuController triggerCharacter="/" getItems={getSlashItems} />
        </BlockNoteView>
      </div>
      <EditorContextMenu
        editor={editor}
        containerRef={editorWrapperRef}
        titleRef={titleRef}
        titleSize={titleSize}
        onTitleSizeChange={handleTitleSizeChange}
      />

      {/* Word count + manual save. Auto-save still runs in the background;
          this button is a guaranteed-now write for cases where the debounce
          hasn't fired yet. Ctrl+S / Cmd+S triggers the same path. */}
      <div className="fixed bottom-3 right-4 z-20 flex items-center gap-3 text-[11px] text-[#5a5a5a] select-none">
        {wordCount.words > 0 && (
          <span>{wordCount.words.toLocaleString()} words · {wordCount.blocks} blocks</span>
        )}
        <button
          type="button"
          onClick={manualSave}
          disabled={saveState === 'saving'}
          title="Save now (Ctrl+S) — auto-save also runs in the background"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            saveState === 'dirty'
              ? 'border-[#5b86c8] bg-[#5b86c8]/15 text-[#86b0e3] hover:bg-[#5b86c8]/25'
              : saveState === 'saved'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-[#2a2a2a] bg-[#1f1f1f] text-[#7a7a7a] hover:border-[#3a3a3a] hover:text-[#c4c4c4]'
          }`}
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'dirty' ? 'Save now' : 'Save'}
        </button>
      </div>

      {/* Table of Contents */}
      {showToc && (
        <div className="fixed right-0 top-[42px] z-30 flex h-[calc(100%-42px)] w-56 flex-col border-l border-[#262626] bg-[#1f1f1f]/95 px-4 py-5 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#7a7a7a]">On this page</span>
            <button
              onClick={() => setShowToc(false)}
              className="flex h-5 w-5 items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.05] hover:text-[#c4c4c4]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {headings.length === 0 ? (
            <p className="text-[12px] text-[#5a5a5a]">No headings yet</p>
          ) : (
            <div className="space-y-0.5 overflow-y-auto">
              {headings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => scrollToHeading(h)}
                  style={{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }}
                  className="block w-full truncate rounded py-1 pr-2 text-left text-[12.5px] text-[#9a9a9a] transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Markdown page editor ─────────────────────────────────────────────────────

function MarkdownPageEditor({ page, allPages = [], initialBlocks, updatePage, saveContent }) {
  const [title, setTitle]       = useState(page?.title ?? 'Untitled');
  const [icon, setIcon]         = useState(page?.icon ?? null);
  const [cover, setCover]       = useState(page?.cover ?? null);
  const [fontClass, setFontClass] = useState(page?.fontClass ?? '');
  const [titleColor, setTitleColor] = useState(page?.titleColor ?? '#e8e8e8');
  const [titleSize, setTitleSize] = useState(page?.titleSize ?? 40);
  const [titleAlign, setTitleAlign] = useState(page?.titleAlign ?? 'left');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [fontFamily, setFontFamily] = useState(page?.fontFamily ?? '');
  const [moreFontsOpen, setMoreFontsOpen] = useState(false);
  const [iconAnchor, setIconAnchor] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [text, setText] = useState(typeof initialBlocks === 'string' ? initialBlocks : '');
  const coverInputRef = useRef(null);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    setTitle(page?.title ?? 'Untitled');
    setIcon(page?.icon ?? null);
    setCover(page?.cover ?? null);
    setFontClass(page?.fontClass ?? '');
    setTitleColor(page?.titleColor ?? '#e8e8e8');
    setTitleSize(page?.titleSize ?? 40);
    setTitleAlign(page?.titleAlign ?? 'left');
    setFontFamily(page?.fontFamily ?? '');
  }, [page?.id]);

  useEffect(() => {
    if (fontFamily) ensureGoogleFont(fontFamily);
  }, [fontFamily]);

  const handleMoreFontSelect = useCallback((family) => {
    setFontFamily(family);
    setFontClass('');
    updatePage(page.id, { fontFamily: family, fontClass: '' });
    ensureGoogleFont(family);
  }, [page?.id, updatePage]);

  const handleTitleAlignChange = useCallback((align) => {
    setTitleAlign(align);
    updatePage(page.id, { titleAlign: align });
  }, [page?.id, updatePage]);

  const handleTitleSizeChange = useCallback((size) => {
    setTitleSize(size);
    updatePage(page.id, { titleSize: size });
    requestAnimationFrame(() => {
      if (titleRef.current) {
        titleRef.current.style.height = 'auto';
        titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
      }
    });
  }, [page?.id, updatePage]);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [title, titleSize]);

  const handleTextChange = (next) => {
    setText(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveContent(page.id, next), 500);
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    updatePage(page.id, { title: val || 'Untitled' });
  };

  const handleIconSelect = (emoji) => {
    setIcon(emoji);
    updatePage(page.id, { icon: emoji });
  };

  const handleCoverFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCover(ev.target.result);
      updatePage(page.id, { cover: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCover = () => {
    setCover(null);
    updatePage(page.id, { cover: null });
  };

  const handleFontChange = (e) => {
    setFontClass(e.target.value);
    setFontFamily('');
    updatePage(page.id, { fontClass: e.target.value, fontFamily: '' });
  };

  const handleColorChange = (hex) => {
    setTitleColor(hex);
    updatePage(page.id, { titleColor: hex });
  };

  if (!page) return null;

  const ancestors = getAncestors(page, allPages);
  const wordCount = (text || '').split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#1f1f1f]">
      {/* Breadcrumbs bar */}
      <div className="sticky top-0 z-10 flex h-[42px] flex-shrink-0 items-center border-b border-[#262626] bg-[#1f1f1f]/95 px-6 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-[12.5px] text-[#9a9a9a]">
          <Link to="/" className="rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]">
            Home
          </Link>
          {ancestors.map((ancestor) => (
            <React.Fragment key={ancestor.id}>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#6e6e6e]" />
              <Link
                to={`/page/${ancestor.id}`}
                className="max-w-[140px] truncate rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
              >
                {ancestor.icon && <span className="mr-1">{renderIcon(ancestor.icon)}</span>}
                {ancestor.title || 'Untitled'}
              </Link>
            </React.Fragment>
          ))}
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#6e6e6e]" />
          <button
            type="button"
            onClick={() => {
              const el = titleRef.current;
              if (!el) return;
              el.focus();
              const len = el.value.length;
              try { el.setSelectionRange(len, len); } catch {}
            }}
            className="truncate rounded px-1.5 py-0.5 text-left text-[#e8e8e8] transition-colors hover:bg-white/[0.045]"
            title="Click to rename"
          >
            {icon && <span className="mr-1">{renderIcon(icon)}</span>}
            {title || 'Untitled'}
          </button>
          <span className="ml-1 rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#7a7a7a]">
            md
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[12px] transition-colors ${
              showSettings ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#9a9a9a] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
            }`}
            title="Page style"
          >
            <Type className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cover */}
      {cover && (
        <div
          className="group relative h-[200px] w-full flex-shrink-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${cover})` }}
        >
          <div className="absolute inset-0 bg-black/15" />
          <button
            onClick={handleRemoveCover}
            className="absolute right-6 top-4 flex items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1.5 text-[11.5px] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3" /> Remove cover
          </button>
        </div>
      )}

      {/* Page header */}
      <div className={`mx-auto w-full max-w-[1280px] px-16 ${cover ? 'pt-6' : 'pt-12'}`}>
        {icon && (
          <div className="mb-3 inline-block">
            <button
              onClick={(e) => setIconAnchor(e.currentTarget)}
              className="text-[64px] leading-none transition-opacity hover:opacity-70"
              title="Change icon"
            >
              {renderIcon(icon)}
            </button>
          </div>
        )}

        <div className="mb-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100">
          {!icon && (
            <button
              onClick={(e) => setIconAnchor(e.currentTarget)}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] text-[#7a7a7a] transition-colors hover:bg-white/[0.045] hover:text-[#c4c4c4]"
            >
              <Smile className="h-3.5 w-3.5" /> Add icon
            </button>
          )}
          {!cover && (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] text-[#7a7a7a] transition-colors hover:bg-white/[0.045] hover:text-[#c4c4c4]"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Add cover
            </button>
          )}
        </div>

        {iconAnchor && (
          <IconPicker
            anchorEl={iconAnchor}
            onSelect={handleIconSelect}
            onClose={() => setIconAnchor(null)}
          />
        )}

        <input type="file" accept="image/*" className="hidden" ref={coverInputRef} onChange={handleCoverFile} />

        {showSettings && (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#232323] px-4 py-3">
            <div className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-[#7a7a7a]" />
              <select
                value={fontFamily ? '' : fontClass}
                onChange={handleFontChange}
                className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#e8e8e8] outline-none"
              >
                <option value="">Default font</option>
                {titleFontOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => setMoreFontsOpen(true)}
                className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#c4c4c4] transition-colors hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
                title="Browse Google Fonts"
              >
                {fontFamily ? <span style={{ fontFamily: buildStack(fontFamily, CATALOG_BY_FAMILY[fontFamily] || 'sans') }}>{fontFamily}</span> : 'More fonts…'}
              </button>
            </div>
            <div className="relative flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-[#7a7a7a]" />
              <label className="text-[12px] text-[#7a7a7a]">Title color</label>
              <button
                onClick={() => setColorPickerOpen((v) => !v)}
                className="h-6 w-10 rounded border border-[#2a2a2a] transition-transform hover:scale-105"
                style={{ background: titleColor }}
                title="Choose color"
              />
              {colorPickerOpen && (
                <div className="absolute left-0 top-full z-50 mt-1">
                  <ColorPickerPopover
                    value={titleColor}
                    onChange={handleColorChange}
                    onClose={() => setColorPickerOpen(false)}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-0.5">
              <button
                onClick={() => handleTitleAlignChange('left')}
                className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
                  titleAlign === 'left' ? 'bg-white/[0.08] text-[#e8e8e8]' : 'text-[#7a7a7a] hover:text-[#c4c4c4]'
                }`}
                title="Align title left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleTitleAlignChange('center')}
                className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
                  titleAlign === 'center' ? 'bg-white/[0.08] text-[#e8e8e8]' : 'text-[#7a7a7a] hover:text-[#c4c4c4]'
                }`}
                title="Align title center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <MoreFontsModal
          open={moreFontsOpen}
          value={fontFamily}
          onSelect={handleMoreFontSelect}
          onClose={() => setMoreFontsOpen(false)}
        />

        <textarea
          ref={titleRef}
          data-page-title
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          rows={1}
          spellCheck={false}
          className={`mb-4 w-full resize-none overflow-hidden rounded bg-transparent font-bold leading-tight tracking-tight placeholder-[#3a3a3a] outline-none transition-colors hover:bg-white/[0.025] focus:bg-white/[0.04] ${fontFamily ? '' : fontClass}`}
          style={{
            fontFamily: fontFamily
              ? buildStack(fontFamily, CATALOG_BY_FAMILY[fontFamily] || 'sans')
              : (fontClass ? undefined : 'var(--app-font, Inter, sans-serif)'),
            color: titleColor,
            fontSize: `${titleSize}px`,
            textAlign: titleAlign,
          }}
          onInput={(e) => {
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
        />
      </div>

      {/* Markdown body — px-2 (0.5rem) here + a 3.5rem in-editor gutter
          (blockGutter) sum to the title's px-16 (4rem), so text lines up with
          the title while card blocks get a BlockNote-style left gutter for
          their +/⋮⋮ controls. fontFamily mirrors the BlockNote wrapper above so
          cards and text inherit the page's chosen default font, not just
          --app-font. */}
      <div
        className={`mx-auto w-full max-w-[1280px] flex-1 px-2 pb-32 ${fontFamily ? '' : fontClass}`}
        style={
          fontFamily
            ? { fontFamily: buildStack(fontFamily, CATALOG_BY_FAMILY[fontFamily] || 'sans') }
            : (fontClass ? undefined : { fontFamily: 'var(--app-font, Inter, sans-serif)' })
        }
      >
        <MarkdownEditor
          value={text}
          onChange={handleTextChange}
          autoFocus
          initialMode="edit"
          minHeight={500}
          placeholder="Type / for commands, or just write markdown — # heading, **bold**, `code`"
          enableSlashCommands
          blockGutter
        />
      </div>

      {/* Right-click → title size (no inline editor menu in markdown mode) */}
      <EditorContextMenu
        editor={null}
        titleRef={titleRef}
        titleSize={titleSize}
        onTitleSizeChange={handleTitleSizeChange}
      />

      {/* Word count */}
      <div className="fixed bottom-3 right-4 z-20 text-[11px] text-[#5a5a5a] select-none">
        {wordCount > 0 && `${wordCount.toLocaleString()} word${wordCount !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
