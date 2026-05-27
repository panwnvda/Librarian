// @ts-nocheck — memo'd inline components lose prop inference; runtime is fine
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  ArrowLeft, FileText,
  Bold, Italic, Strikethrough, Code, Code2, Link2,
  List, ListOrdered, ListChecks,
  Quote, Minus,
  Undo2, Redo2,
  Target,
} from 'lucide-react';
import MarkdownEditor from './MarkdownEditor';
import { titleFontOptions } from '../lib/pageStyleOptions';
import { CARD_COLOR_OPTIONS, BLANK_BODY, cardToMarkdown, markdownToCard } from '../lib/cardMarkdown';
import { FONT_STACKS } from '../hooks/useGlobalFont';
import { ColorPickerPopover } from './ColorPicker';

// ─── Toolbar primitives ──────────────────────────────────────────────────────
// Walk up the DOM until we find the nearest ancestor that actually scrolls.
// Used by the textarea auto-grow logic so we can snapshot+restore its
// scrollTop across the brief height='auto' collapse — without this the
// page jumps every time the user adds or deletes content while scrolled.
function findScrollParent(el) {
  let node = el?.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

const ToolDivider = memo(() => (
  <div className="mx-1 h-4 w-px flex-shrink-0 bg-[#2f2f2f]" />
));

const ToolBtn = memo(({ icon: Icon, label, title, onClick, active, disabled }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-1 rounded px-2 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
      active
        ? 'bg-white/[0.08] text-[#e8e8e8]'
        : 'text-[#9a9a9a] hover:bg-white/[0.05] hover:text-[#e8e8e8]'
    }`}
  >
    {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
    {label && <span className="leading-none">{label}</span>}
  </button>
));

// Font family dropdown — Google-Docs-style toolbar control. Picking a font
// wraps the current selection in <span style="font-family: ...">.
const FontFamilyMenu = memo(({ onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Font family"
        className="flex items-center gap-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-0.5 text-[12px] text-[#c4c4c4] hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
      >
        <span className="min-w-[80px] truncate text-left">Font</span>
        <span className="text-[10px] text-[#6e6e6e]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-52 overflow-y-auto rounded-md border border-[#373737] bg-[#252525] py-1 shadow-2xl">
          {titleFontOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onPick(FONT_STACKS[opt.value]); setOpen(false); }}
              className="flex w-full items-center px-3 py-1 text-left text-[12px] text-[#c4c4c4] transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
              style={{ fontFamily: FONT_STACKS[opt.value] }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// Font size dropdown — typeable input + preset list, decimals OK.
const FontSizeMenu = memo(({ onPick }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const presets = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
  const apply = (v) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) { onPick(Math.max(6, Math.min(96, n))); setOpen(false); }
  };
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Font size"
        className="flex items-center gap-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-0.5 text-[12px] text-[#c4c4c4] hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
      >
        <span className="min-w-[28px] text-left">Size</span>
        <span className="text-[10px] text-[#6e6e6e]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-md border border-[#373737] bg-[#252525] py-1 shadow-2xl">
          <div className="px-2 py-1">
            <input
              autoFocus
              type="number"
              step="0.5"
              min={6}
              max={96}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply(draft); }}
              placeholder="px"
              className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-0.5 text-[12px] text-[#e8e8e8] outline-none focus:border-[#3a3a3a]"
            />
          </div>
          <div className="max-h-44 overflow-y-auto border-t border-[#2f2f2f] py-1">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => { onPick(p); setOpen(false); }}
                className="flex w-full items-center px-3 py-0.5 text-left text-[12px] text-[#c4c4c4] hover:bg-white/[0.045] hover:text-[#e8e8e8]"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Text-color / highlight-color button — opens the full ColorPickerPopover.
// onMouseDown is preventDefaulted everywhere the user could click so the
// textarea keeps focus + selection while interacting with the picker —
// otherwise clicking the button blurs the textarea, the selection is lost,
// and the colour ends up wrapping the literal word "text" at cursor 0
// instead of whatever the user had highlighted.
const ColorBtn = memo(({ label, title, onPick, kind }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref} onMouseDown={(e) => e.preventDefault()}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        title={title}
        className="flex h-6 items-center justify-center rounded px-2 text-[12px] text-[#9a9a9a] hover:bg-white/[0.05] hover:text-[#e8e8e8]"
      >
        <span className={kind === 'text' ? 'font-bold underline decoration-2 underline-offset-2' : 'leading-none'}>{label}</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ColorPickerPopover
            value="#5b86c8"
            onChange={(hex) => { onPick(hex); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function CardEditorPage({ card, onSave, onCancel }) {
  const [title, setTitle]           = useState('');
  const [subtitle, setSubtitle]     = useState('');
  const [tags, setTags]             = useState('');
  const [body, setBody]             = useState(BLANK_BODY);
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [selectedFont, setSelectedFont]   = useState('');
  const [dirty, setDirty]           = useState(false);

  const editorRef = useRef(null);

  // Seed state from `card` exactly once, on mount. CardEditorPage is
  // unmounted/remounted by its parent (CardBlockInner) whenever `editing`
  // toggles, so a single Edit click = one fresh mount with one seed. We
  // deliberately DON'T re-seed on subsequent re-renders — auto-save updates
  // the parent block which triggers a re-render with the same logical card,
  // and re-seeding would clobber the user's in-flight edits + jump the cursor.
  // Imported cards (from .library import) have no `id` field, so a
  // ref-equality / id-based guard doesn't work — we just gate on mount.
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (hasSeededRef.current) return;
    hasSeededRef.current = true;
    if (card) {
      setTitle(card.title || '');
      setSubtitle(card.subtitle || '');
      setTags((card.tags || []).join(', '));
      setBody(cardToMarkdown(card));
      setSelectedColor(card.accentColor || 'cyan');
      setSelectedFont(card.font || '');
    } else {
      setTitle(''); setSubtitle(''); setTags('');
      setBody(BLANK_BODY); setSelectedColor('cyan'); setSelectedFont('');
    }
    setDirty(false);
  }, []);

  // ── Text helpers — all dispatch through the MarkdownEditor's ref so they
  // operate on the live CodeMirror view. CodeMirror tracks selection itself,
  // so we don't need a saved-selection mirror anymore.
  const insertWrap = useCallback((before, after = before) => {
    editorRef.current?.wrap(before, after);
  }, []);

  const insertLinePrefix = useCallback((prefix) => {
    editorRef.current?.insertLinePrefix(prefix);
  }, []);

  const insertCodeFence = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { from, to, text } = ed.getSelection();
    const sel = text || 'code here';
    const block = `\n\`\`\`bash\n${sel}\n\`\`\`\n`;
    ed.insertAt(from, to, block, from + 8 + sel.length);
  }, []);

  const insertHRule = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { from } = ed.getSelection();
    const block = '\n\n---\n\n';
    ed.insertAt(from, from, block, from + block.length);
  }, []);

  // Wrap the current selection (or a placeholder) in an HTML span with the
  // given style attribute. Used by the font/color toolbar.
  const wrapSpan = useCallback((styleAttr, placeholder = 'text') => {
    const ed = editorRef.current;
    if (!ed) return;
    const { from, to, text } = ed.getSelection();
    const sel = text || placeholder;
    const before = `<span style="${styleAttr}">`;
    const after = '</span>';
    ed.insertAt(from, to, before + sel + after, from + before.length + sel.length);
  }, []);

  const applyFontFamily  = useCallback((stack)  => stack && wrapSpan(`font-family: ${stack}`), [wrapSpan]);
  const applyFontSize    = useCallback((size)   => size  && wrapSpan(`font-size: ${size}px`), [wrapSpan]);
  const applyTextColor   = useCallback((color)  => color && wrapSpan(`color: ${color}`),     [wrapSpan]);
  const applyHighlight   = useCallback((color)  => color && wrapSpan(`background-color: ${color}; padding: 0 0.15em; border-radius: 2px`), [wrapSpan]);

  // Inserts the step delimiter token at the cursor (or replacing the current
  // selection). The token is what cardMarkdown.js uses to split steps.
  const insertStep = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const STEP_TOKEN = '<!--step-->';
    const { from, to } = ed.getSelection();
    ed.insertAt(from, to, STEP_TOKEN, from + STEP_TOKEN.length);
  }, []);

  // Save-state machine for the manual Save button feedback ('idle' | 'saved'
  // for the green flash). Auto-save still keeps the dirty indicator in sync.
  const [saveFlash, setSaveFlash] = useState(false);
  const handleSave = useCallback(() => {
    const { overview, steps, commands } = markdownToCard(body);
    onSave({
      id: card ? card.id : `card-${Date.now()}`,
      title: title.trim() || 'New Technique',
      subtitle,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      overview, steps, commands,
      accentColor: selectedColor, font: selectedFont,
    });
    setDirty(false);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  }, [title, subtitle, tags, body, selectedColor, selectedFont, card, onSave]);

  // Debounced auto-save: any edit settles to the parent block after 400ms of
  // inactivity, so the user can close the editor by hitting Back/Escape
  // without explicitly saving. Skip the first run after the initial load
  // (the seeding useEffect already set everything to the card's current values).
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (!dirty) return;
    const t = setTimeout(() => { handleSave(); }, 400);
    return () => clearTimeout(t);
  }, [dirty, title, subtitle, tags, body, selectedColor, selectedFont, handleSave]);

  // Always flush pending edits to the parent before the editor unmounts,
  // even if the 400ms debounce hasn't fired yet. We mirror `dirty` and the
  // latest `handleSave` into refs so the unmount cleanup (which runs only
  // once with stale closure-captured values) can read the current state.
  const dirtyRef = useRef(false);
  const saveRef = useRef(handleSave);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { saveRef.current = handleSave; }, [handleSave]);
  useEffect(() => {
    return () => { if (dirtyRef.current) saveRef.current?.(); };
  }, []);

  const onRootKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') onCancel();
  }, [handleSave, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]"
      onKeyDown={onRootKeyDown}
      spellCheck={false}
    >
      {/* ══ Title bar ════════════════════════════════════════════════════════ */}
      <div className="flex h-[42px] flex-shrink-0 items-center gap-2 border-b border-[#262626] bg-[#1f1f1f] px-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] text-[#9a9a9a] transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="mx-0.5 h-4 w-px bg-[#2f2f2f]" />
        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#6e6e6e]" />

        <input
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setDirty(true); }}
          placeholder="Untitled"
          className="min-w-0 max-w-sm flex-1 bg-transparent text-[13px] text-[#e8e8e8] placeholder-[#5a5a5a] focus:outline-none"
        />

        <span className={`flex-shrink-0 text-[11px] ${dirty ? 'text-[#c8a347]' : 'text-[#5a8a5a]'}`}>
          {dirty ? 'Saving…' : 'Saved'}
        </span>

        <div className="flex-1" />

        {/* Color dots */}
        <div className="flex items-center gap-1.5">
          {CARD_COLOR_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              title={opt.value}
              onClick={() => setSelectedColor(opt.value)}
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full transition-all ${opt.dot} ${
                selectedColor === opt.value
                  ? 'scale-125 ring-1 ring-white/40 ring-offset-2 ring-offset-[#1f1f1f]'
                  : 'opacity-40 hover:opacity-90'
              }`}
            />
          ))}
        </div>

        <div className="mx-1 h-4 w-px bg-[#2f2f2f]" />

        <select
          value={selectedFont}
          onChange={e => { setSelectedFont(e.target.value); setDirty(true); }}
          className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[11.5px] text-[#c4c4c4] outline-none"
        >
          <option value="">Default (page font)</option>
          {titleFontOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSave}
          className={`flex flex-shrink-0 items-center gap-1.5 rounded-md border px-3 py-1 text-[11.5px] font-medium transition-colors ${
            saveFlash
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              : dirty
                ? 'border-[#5b86c8] bg-[#5b86c8]/20 text-[#86b0e3] hover:bg-[#5b86c8]/30'
                : 'border-[#3a3a3a] bg-[#1a1a1a] text-[#9a9a9a] hover:border-[#4a4a4a] hover:text-[#c4c4c4]'
          }`}
          title="Save now (Ctrl+S) — auto-save also runs in the background"
        >
          {saveFlash ? '✓ Saved' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-[#e8e8e8] px-3 py-1 text-[11.5px] font-medium text-[#1a1a1a] transition-colors hover:bg-white"
          title="Done editing (changes auto-save)"
        >
          Done
        </button>
      </div>

      {/* ══ Ribbon toolbar ═══════════════════════════════════════════════════ */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-0.5 border-b border-[#262626] bg-[#1d1d1d] px-3 py-1.5">
        <ToolBtn icon={Undo2} title="Undo (⌘Z)" onClick={() => document.execCommand('undo')} />
        <ToolBtn icon={Redo2} title="Redo (⌘Y)" onClick={() => document.execCommand('redo')} />
        <ToolDivider />

        <ToolBtn label="H1" title="Heading 1" onClick={() => insertLinePrefix('# ')} />
        <ToolBtn label="H2" title="Heading 2" onClick={() => insertLinePrefix('## ')} />
        <ToolBtn label="H3" title="Heading 3" onClick={() => insertLinePrefix('### ')} />
        <ToolDivider />

        <FontFamilyMenu onPick={applyFontFamily} />
        <FontSizeMenu   onPick={applyFontSize} />
        <ToolDivider />

        <ColorBtn label="A" title="Text color" onPick={applyTextColor} kind="text" />
        <ColorBtn label="🖍" title="Highlight color" onPick={applyHighlight} kind="bg" />
        <ToolDivider />

        <ToolBtn icon={Bold}          title="Bold (⌘B)"        onClick={() => insertWrap('**')} />
        <ToolBtn icon={Italic}        title="Italic (⌘I)"       onClick={() => insertWrap('*')} />
        <ToolBtn icon={Strikethrough} title="Strikethrough"     onClick={() => insertWrap('~~')} />
        <ToolBtn icon={Code}          title="Inline code (⌘`)" onClick={() => insertWrap('`')} />
        <ToolDivider />

        <ToolBtn icon={List}        title="Bullet list"   onClick={() => insertLinePrefix('- ')} />
        <ToolBtn icon={ListOrdered} title="Numbered list" onClick={() => insertLinePrefix('1. ')} />
        <ToolBtn icon={ListChecks}  title="Task list"     onClick={() => insertLinePrefix('- [ ] ')} />
        <ToolBtn icon={Target}      title="Add step (numbered circle + progress bar in card)" onClick={insertStep} />
        <ToolDivider />

        <ToolBtn icon={Quote} title="Blockquote"      onClick={() => insertLinePrefix('> ')} />
        <ToolBtn icon={Code2} title="Code block"      onClick={insertCodeFence} />
        <ToolBtn icon={Minus} title="Horizontal rule" onClick={insertHRule} />
        <ToolDivider />

        <ToolBtn icon={Link2} title="Link (⌘K)" onClick={() => insertWrap('[', '](url)')} />

        <div className="flex-1" />
      </div>

      {/* ══ Canvas ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto bg-[#1a1a1a]">
        <div className="flex min-h-full justify-center px-6 py-8">
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1f1f1f]"
            style={{ minHeight: 'calc(100vh - 11rem)' }}
          >
            {/* Document header — title is click-to-edit right in the body
                (like a Google Docs document title). */}
            <div className="flex-shrink-0 border-b border-[#262626] px-14 pb-8 pt-12">
              <textarea
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                placeholder="Untitled"
                rows={1}
                className="mb-5 w-full resize-none overflow-hidden bg-transparent text-[36px] font-bold leading-tight tracking-tight text-[#e8e8e8] placeholder-[#3a3a3a] outline-none"
                style={{ fontFamily: 'Inter, sans-serif' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  const scroller = findScrollParent(el);
                  const prev = scroller ? scroller.scrollTop : 0;
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                  if (scroller) scroller.scrollTop = prev;
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              />
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={subtitle}
                  onChange={e => { setSubtitle(e.target.value); setDirty(true); }}
                  placeholder="Add a subtitle…"
                  className="flex-1 bg-transparent text-[14px] text-[#9a9a9a] placeholder-[#5a5a5a] focus:outline-none"
                />
                <div className="h-3 w-px flex-shrink-0 bg-[#2f2f2f]" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#6e6e6e]">Tags</span>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => { setTags(e.target.value); setDirty(true); }}
                    placeholder="tag1, tag2"
                    className="w-40 bg-transparent text-[12px] text-[#9a9a9a] placeholder-[#5a5a5a] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Document body — live-preview Markdown editor. Type `# Heading`
                and the line styles as a heading as soon as the cursor leaves
                the line. No split-view; what you see is what you get. */}
            <div
              className="flex-1"
              style={{ padding: '2.5rem 3.5rem', minHeight: '500px' }}
            >
              <MarkdownEditor
                ref={editorRef}
                value={body}
                onChange={(v) => { setBody(v); setDirty(true); }}
                autoFocus={!card}
                placeholder="Start writing…"
                minHeight={500}
              />
            </div>
          </div>
        </div>
        <div className="h-20" />
      </div>
    </div>
  );
}
