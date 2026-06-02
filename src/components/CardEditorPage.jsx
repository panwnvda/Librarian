import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import MarkdownEditor from './MarkdownEditor';
import { titleFontOptions } from '../lib/pageStyleOptions';
import { CARD_COLOR_OPTIONS, BLANK_BODY, cardToMarkdown, markdownToCard } from '../lib/cardMarkdown';
import { FONT_STACKS } from '../hooks/useGlobalFont';

// Walk up the DOM until we find the nearest ancestor that actually scrolls.
// Used by the title textarea auto-grow logic so we can snapshot+restore its
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function CardEditorPage({ card, onSave, onCancel }) {
  const [title, setTitle]           = useState('');
  const [subtitle, setSubtitle]     = useState('');
  const [tags, setTags]             = useState('');
  const [body, setBody]             = useState(BLANK_BODY);
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [selectedFont, setSelectedFont]   = useState('');
  const [dirty, setDirty]           = useState(false);

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

  // Save-state machine for the manual Save button feedback ('idle' | 'saved'
  // for the green flash). Auto-save still keeps the dirty indicator in sync.
  const [saveFlash, setSaveFlash] = useState(false);
  const handleSave = useCallback(() => {
    const { overview, steps, stepBlocks, commands } = markdownToCard(body);
    onSave({
      id: card ? card.id : `card-${Date.now()}`,
      title: title.trim() || 'New Technique',
      subtitle,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      overview, steps, stepBlocks, commands,
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

  // Mirror the page editor: the chosen font cascades from the document wrapper
  // so the title, body text, and cards all inherit it (falling back to the
  // app-wide default when the card has no explicit font).
  const bodyFont = (selectedFont && FONT_STACKS[selectedFont]) || 'var(--app-font, Inter, sans-serif)';

  // Portal to <body> so the fixed overlay covers the real viewport. The editor
  // is rendered inside a CodeMirror card-widget whose container scopes `fixed`
  // positioning (CodeMirror applies contain/transform on its scroller), which
  // otherwise offsets the overlay to wherever the card sits in the document.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1f1f1f]"
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

      {/* ══ Canvas — full-bleed document, identical layout to the page editor:
          a max-w-[1280px] column with a px-16 title header, then a px-2 body
          whose 3.5rem in-editor blockGutter sums to the title's 4rem so text
          lines up with the title exactly as it does on a page. ═══════════════ */}
      <div className="flex-1 overflow-y-auto bg-[#1f1f1f]" style={{ fontFamily: bodyFont }}>
        {/* Title header */}
        <div className="mx-auto w-full max-w-[1280px] px-16 pt-12">
          <textarea
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            placeholder="Untitled"
            rows={1}
            spellCheck={false}
            className="mb-1 w-full resize-none overflow-hidden rounded bg-transparent font-bold leading-tight tracking-tight text-[#e8e8e8] placeholder-[#3a3a3a] outline-none transition-colors hover:bg-white/[0.025] focus:bg-white/[0.04]"
            style={{ fontFamily: bodyFont, fontSize: '40px' }}
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
          <input
            type="text"
            value={subtitle}
            onChange={e => { setSubtitle(e.target.value); setDirty(true); }}
            placeholder="Add a subtitle…"
            className="mb-2 w-full bg-transparent text-[15px] text-[#9a9a9a] placeholder-[#5a5a5a] focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#6e6e6e]">Tags</span>
            <input
              type="text"
              value={tags}
              onChange={e => { setTags(e.target.value); setDirty(true); }}
              placeholder="tag1, tag2"
              className="flex-1 bg-transparent text-[12px] text-[#9a9a9a] placeholder-[#5a5a5a] focus:outline-none"
            />
          </div>
        </div>

        {/* Body — live-preview Markdown editor */}
        <div className="mx-auto w-full max-w-[1280px] px-2 pb-32 pt-6">
          <MarkdownEditor
            value={body}
            onChange={(v) => { setBody(v); setDirty(true); }}
            autoFocus={!card}
            placeholder="Start writing…"
            minHeight={500}
            enableSlashCommands
            blockGutter
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
