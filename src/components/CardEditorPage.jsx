// @ts-nocheck — memo'd inline components lose prop inference; runtime is fine
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  ArrowLeft, FileText,
  Bold, Italic, Strikethrough, Code, Code2, Link2,
  List, ListOrdered, ListChecks,
  Quote, Minus,
  Eye, Pencil, SquareSplitHorizontal,
  Undo2, Redo2,
  Target,
} from 'lucide-react';
import MarkdownView from './MarkdownView';
import { titleFontOptions } from '../lib/pageStyleOptions';
import { CARD_COLOR_OPTIONS, BLANK_BODY, cardToMarkdown, markdownToCard } from '../lib/cardMarkdown';
import { FONT_STACKS } from '../hooks/useGlobalFont';
import { ColorPickerPopover } from './ColorPicker';

// ─── Toolbar primitives ──────────────────────────────────────────────────────
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

const ViewBtn = memo(({ mode, current, setMode, icon: Icon, label }) => (
  <button
    type="button"
    onClick={() => setMode(mode)}
    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] transition-colors ${
      current === mode
        ? 'bg-white/[0.08] text-[#e8e8e8]'
        : 'text-[#9a9a9a] hover:bg-white/[0.045] hover:text-[#c4c4c4]'
    }`}
  >
    <Icon className="h-3 w-3" />
    {label}
  </button>
));

// ─── Main component ───────────────────────────────────────────────────────────
export default function CardEditorPage({ card, onSave, onCancel }) {
  const [title, setTitle]           = useState('');
  const [subtitle, setSubtitle]     = useState('');
  const [tags, setTags]             = useState('');
  const [body, setBody]             = useState(BLANK_BODY);
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [selectedFont, setSelectedFont]   = useState('');
  const [viewMode, setViewMode]     = useState('split');
  const [dirty, setDirty]           = useState(false);

  const textareaRef = useRef(null);

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
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        try { el.setSelectionRange(0, 0); } catch {}
        el.scrollTop = 0;
        el.scrollIntoView?.({ block: 'start', inline: 'nearest' });
      }
    });
  }, []);

  // ── Text helpers ──────────────────────────────────────────────────────────
  const insertWrap = useCallback((before, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = body.slice(s, e);
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next); setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }, [body]);

  const insertLinePrefix = useCallback((prefix) => {
    const el = textareaRef.current;
    if (!el) return;
    const s = el.selectionStart;
    let ls = s;
    while (ls > 0 && body[ls - 1] !== '\n') ls--;
    const next = body.slice(0, ls) + prefix + body.slice(ls);
    setBody(next); setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  }, [body]);

  const insertCodeFence = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const s = el.selectionStart; const e = el.selectionEnd;
    const sel = body.slice(s, e);
    const block = `\n\`\`\`bash\n${sel || 'code here'}\n\`\`\`\n`;
    setBody(body.slice(0, s) + block + body.slice(e)); setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      const cs = s + 8;
      el.setSelectionRange(cs, cs + (sel || 'code here').length);
    });
  }, [body]);

  const insertHRule = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const block = '\n\n---\n\n';
    setBody(body.slice(0, s) + block + body.slice(s)); setDirty(true);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + block.length, s + block.length); });
  }, [body]);

  // The textarea's selectionStart/End can get clobbered (set to 0/0) when the
  // user clicks a popover button — even with mousedown preventDefault, some
  // browsers reset selection on focus changes. We mirror the last known good
  // selection into a ref via onSelect on the textarea and read from there.
  const savedSelectionRef = useRef({ start: 0, end: 0 });
  const captureSelection = useCallback(() => {
    const el = textareaRef.current;
    if (el && document.activeElement === el) {
      savedSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
    }
  }, []);

  // Wrap the selection (or a placeholder if empty) in an HTML span with the
  // given style attribute. Reads from the saved-selection ref so it works
  // even when the textarea has been blurred by clicking the picker.
  const wrapSpan = useCallback((styleAttr, placeholder = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const { start: s, end: e } = savedSelectionRef.current;
    const sel = body.slice(s, e) || placeholder;
    const before = `<span style="${styleAttr}">`;
    const after = '</span>';
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next); setDirty(true);
    const newStart = s + before.length;
    const newEnd = newStart + sel.length;
    savedSelectionRef.current = { start: newStart, end: newEnd };
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    });
  }, [body]);

  const applyFontFamily  = useCallback((stack)  => stack && wrapSpan(`font-family: ${stack}`), [wrapSpan]);
  const applyFontSize    = useCallback((size)   => size  && wrapSpan(`font-size: ${size}px`), [wrapSpan]);
  const applyTextColor   = useCallback((color)  => color && wrapSpan(`color: ${color}`),     [wrapSpan]);
  const applyHighlight   = useCallback((color)  => color && wrapSpan(`background-color: ${color}; padding: 0 0.15em; border-radius: 2px`), [wrapSpan]);

  // Inserts the step delimiter token literally at the cursor (or replacing
  // the current selection). No newlines added, no placeholder text, no jump
  // to the Steps section — the user controls where the token lands.
  const insertStep = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const STEP_TOKEN = '<!--step-->';
    const hasFocus = document.activeElement === el;
    const s = hasFocus ? el.selectionStart : savedSelectionRef.current.start;
    const e = hasFocus ? el.selectionEnd : savedSelectionRef.current.end;
    const next = body.slice(0, s) + STEP_TOKEN + body.slice(e);
    setBody(next); setDirty(true);
    const newCaret = s + STEP_TOKEN.length;
    savedSelectionRef.current = { start: newCaret, end: newCaret };
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
    });
  }, [body]);

  const handleKeyDown = useCallback((e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); insertWrap('**'); }
    else if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); insertWrap('*'); }
    else if (mod && e.key === '`') { e.preventDefault(); insertWrap('`'); }
    else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); insertWrap('[', '](url)'); }
    else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const el = textareaRef.current;
      const s = el.selectionStart; const en = el.selectionEnd;
      setBody(body.slice(0, s) + '  ' + body.slice(en)); setDirty(true);
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  }, [body, insertWrap]);

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

  // Keep the textarea sized to its content. Re-fits on every body change
  // and on view-mode toggles so toolbar inserts (which mutate `body`)
  // grow the editor rather than hiding overflow inside a fixed-height pane.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body, viewMode]);

  const onRootKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') onCancel();
  }, [handleSave, onCancel]);

  const showEdit    = viewMode === 'edit'    || viewMode === 'split';
  const showPreview = viewMode === 'preview' || viewMode === 'split';

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

        <div className="flex items-center overflow-hidden rounded border border-[#2a2a2a]">
          <ViewBtn mode="edit"    current={viewMode} setMode={setViewMode} icon={Pencil}               label="Edit" />
          <ViewBtn mode="split"   current={viewMode} setMode={setViewMode} icon={SquareSplitHorizontal} label="Split" />
          <ViewBtn mode="preview" current={viewMode} setMode={setViewMode} icon={Eye}                  label="Preview" />
        </div>
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
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
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

            {/* Document body — textarea auto-grows with content so the page
                scrolls (Google Docs feel) instead of an inner scrollbar
                appearing inside a fixed-height editor pane. */}
            <div className={`flex flex-1 items-stretch ${viewMode === 'split' ? 'divide-x divide-[#262626]' : ''}`}>
              {showEdit && (
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value); setDirty(true);
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onSelect={captureSelection}
                  onKeyUp={captureSelection}
                  onMouseUp={captureSelection}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  autoFocus={!card}
                  placeholder="Start writing…"
                  // `w-1/2 min-w-0` + `basis-0` keeps the two panes exactly
                  // 50-50 even when the preview contains very wide content
                  // (long code lines, tables) that would otherwise force
                  // `flex-1` to grow this pane and shrink the other.
                  className={`block resize-none overflow-hidden bg-transparent text-[#d4d4d4] placeholder-[#5a5a5a] focus:outline-none ${
                    viewMode === 'split' ? 'w-1/2 min-w-0 flex-shrink-0 flex-grow-0 basis-1/2' : 'flex-1'
                  }`}
                  style={{
                    padding: '2.5rem 3.5rem',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '13.5px',
                    lineHeight: '1.85',
                    minHeight: '500px',
                  }}
                />
              )}
              {showPreview && (
                <div
                  className={`overflow-x-auto ${
                    viewMode === 'split' ? 'w-1/2 min-w-0 flex-shrink-0 flex-grow-0 basis-1/2' : 'flex-1'
                  }`}
                  style={{ padding: '2.5rem 3.5rem', minHeight: '500px' }}
                >
                  {body?.trim() ? (
                    <MarkdownView>{body}</MarkdownView>
                  ) : (
                    <p className="text-[14px] italic text-[#5a5a5a]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Nothing to preview yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-20" />
      </div>
    </div>
  );
}
