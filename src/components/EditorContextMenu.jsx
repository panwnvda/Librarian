import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline, Strikethrough, Code, Type, RotateCcw, CaseSensitive, Palette, Highlighter } from 'lucide-react';
import SizePicker from './SizePicker';
import { ColorPickerPopover } from './ColorPicker';
import { titleFontOptions } from '@/lib/pageStyleOptions';
import { FONT_STACKS } from '@/hooks/useGlobalFont';

const INLINE_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
const TITLE_SIZES  = [24, 28, 32, 36, 40, 48, 56, 64, 72, 84];

function selectWordAt(clientX, clientY) {
  try {
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range) return false;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const text = node.textContent || '';
    let s = range.startOffset, e = range.startOffset;
    const wordCh = /[\p{L}\p{N}_]/u;
    while (s > 0 && wordCh.test(text[s - 1])) s--;
    while (e < text.length && wordCh.test(text[e])) e++;
    if (s === e) return false;
    const wordRange = document.createRange();
    wordRange.setStart(node, s);
    wordRange.setEnd(node, e);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(wordRange);
    return true;
  } catch {
    return false;
  }
}

export default function EditorContextMenu({
  editor = null,
  containerRef = null,
  titleRef = null,
  titleSize = 40,
  onTitleSizeChange = null,
}) {
  // { x, y, mode } | null   — mode is 'inline' | 'title'
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  /** @type {[Record<string, any>, (next: Record<string, any>) => void]} */
  const [activeStyles, setActiveStyles] = useState({});

  const refreshStyles = useCallback(() => {
    if (!editor) return;
    try {
      const styles = editor.getActiveStyles?.() || {};
      setActiveStyles(styles);
    } catch {
      setActiveStyles({});
    }
  }, [editor]);

  // contextmenu handler — covers both the title and the editor.
  useEffect(() => {
    const titleEl = titleRef?.current;
    const editorEl = containerRef?.current;

    const onTitle = (e) => {
      e.preventDefault();
      const vw = window.innerWidth, vh = window.innerHeight;
      const W = 220, H = 360;
      setMenu({
        x: Math.min(e.clientX, vw - W - 8),
        y: Math.min(e.clientY, vh - H - 8),
        mode: 'title',
      });
    };

    const onEditor = (e) => {
      if (e.target.closest('select, input, textarea')) return;
      // Custom blocks (map, card) own their right-click — they mark
      // themselves with [data-skip-editor-context-menu] so this default
      // text-formatting menu doesn't fire on top of theirs.
      if (e.target.closest('[data-skip-editor-context-menu]')) return;
      const sel = window.getSelection();
      const had = sel && !sel.isCollapsed && sel.toString().trim().length > 0;
      if (!had) {
        if (!selectWordAt(e.clientX, e.clientY)) return;
      }
      e.preventDefault();
      refreshStyles();
      const vw = window.innerWidth, vh = window.innerHeight;
      const W = 220, H = 360;
      setMenu({
        x: Math.min(e.clientX, vw - W - 8),
        y: Math.min(e.clientY, vh - H - 8),
        mode: 'inline',
      });
    };

    if (titleEl) titleEl.addEventListener('contextmenu', onTitle);
    if (editorEl) editorEl.addEventListener('contextmenu', onEditor);
    return () => {
      if (titleEl) titleEl.removeEventListener('contextmenu', onTitle);
      if (editorEl) editorEl.removeEventListener('contextmenu', onEditor);
    };
  }, [editor, containerRef, titleRef, refreshStyles]);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(null); };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const close = () => setMenu(null);

  const applyInlineSize = (size) => {
    if (!editor) return;
    try { editor.addStyles({ fontSize: `${size}px` }); } catch {}
    close();
  };
  const resetInlineSize = () => {
    if (!editor) return;
    try { editor.removeStyles({ fontSize: '' }); } catch {}
    close();
  };
  const applyFontFamily = (stack) => {
    if (!editor) return;
    try {
      if (stack) editor.addStyles({ fontFamily: stack });
      else editor.removeStyles({ fontFamily: '' });
    } catch {}
    refreshStyles();
  };
  const applyTextColor = (hex) => {
    if (!editor) return;
    try {
      if (hex) editor.addStyles({ textColor: hex });
      else editor.removeStyles({ textColor: '' });
    } catch {}
    refreshStyles();
  };
  const applyBgColor = (hex) => {
    if (!editor) return;
    try {
      if (hex) editor.addStyles({ backgroundColor: hex });
      else editor.removeStyles({ backgroundColor: '' });
    } catch {}
    refreshStyles();
  };
  const toggleStyle = (key) => {
    if (!editor) return;
    try { editor.toggleStyles({ [key]: true }); } catch {}
    refreshStyles();
  };

  const applyTitleSize = (size) => {
    onTitleSizeChange?.(size);
    close();
  };

  if (!menu) return null;

  // ── Title mode menu ──────────────────────────────────────────────────────
  // Uses the shared SizePicker so the right-click size UX is identical across
  // the app (map column / technique titles, page title, inline text).
  if (menu.mode === 'title') {
    return createPortal(
      <SizePicker
        anchor={{ x: menu.x, y: menu.y }}
        value={titleSize}
        onChange={(s) => applyTitleSize(s)}
        onClose={close}
        presets={TITLE_SIZES}
        label="Title size"
      />,
      document.body
    );
  }

  // ── Inline-selection menu ───────────────────────────────────────────────
  // Format buttons at top, then a typeable size input + presets below
  // (matches the right-click SizePicker behavior used elsewhere).
  const currentSizeNumber = (() => {
    const v = activeStyles.fontSize;
    if (typeof v !== 'string') return null;
    const m = v.match(/^([\d.]+)/);
    return m ? Number(m[1]) : null;
  })();

  return createPortal(
    <InlineMenu
      menuRef={menuRef}
      menu={menu}
      activeStyles={activeStyles}
      toggleStyle={toggleStyle}
      currentSize={currentSizeNumber}
      applyInlineSize={applyInlineSize}
      resetInlineSize={resetInlineSize}
      applyFontFamily={applyFontFamily}
      applyTextColor={applyTextColor}
      applyBgColor={applyBgColor}
    />,
    document.body
  );
}

function InlineMenu({ menuRef, menu, activeStyles, toggleStyle, currentSize, applyInlineSize, resetInlineSize, applyFontFamily, applyTextColor, applyBgColor }) {
  const [draft, setDraft] = useState(currentSize ? String(currentSize) : '');
  const [fontOpen, setFontOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false);
  useEffect(() => { setDraft(currentSize ? String(currentSize) : ''); }, [currentSize]);
  const apply = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    applyInlineSize(Math.max(6, Math.min(96, n)));
  };

  // Currently-applied inline font, if any. Empty = inherits the page font.
  const currentFontStack = typeof activeStyles.fontFamily === 'string' ? activeStyles.fontFamily : '';
  const currentTextColor = typeof activeStyles.textColor === 'string' ? activeStyles.textColor : '';
  const currentBgColor   = typeof activeStyles.backgroundColor === 'string' ? activeStyles.backgroundColor : '';

  return (
    <div
      ref={menuRef}
      className="fixed z-[2000] w-[220px] overflow-hidden rounded-lg border border-[#373737] bg-[#252525] py-1 shadow-2xl"
      style={{ top: menu.y, left: menu.x }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 border-b border-[#373737] px-2 py-1.5">
        <FormatBtn icon={Bold}          active={!!activeStyles.bold}      onClick={() => toggleStyle('bold')}      title="Bold (⌘B)" />
        <FormatBtn icon={Italic}        active={!!activeStyles.italic}    onClick={() => toggleStyle('italic')}    title="Italic (⌘I)" />
        <FormatBtn icon={Underline}     active={!!activeStyles.underline} onClick={() => toggleStyle('underline')} title="Underline (⌘U)" />
        <FormatBtn icon={Strikethrough} active={!!activeStyles.strike}    onClick={() => toggleStyle('strike')}    title="Strikethrough" />
        <FormatBtn icon={Code}          active={!!activeStyles.code}      onClick={() => toggleStyle('code')}      title="Inline code (⌘E)" />
      </div>

      {/* Explicit labeled row for inline code — easy to miss as an icon. */}
      <button
        type="button"
        onClick={() => toggleStyle('code')}
        className={`flex w-full items-center gap-2 border-b border-[#2f2f2f] px-3 py-1.5 text-left text-[12px] transition-colors ${
          activeStyles.code
            ? 'bg-white/[0.06] text-[#e8e8e8]'
            : 'text-[#c4c4c4] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
        }`}
      >
        <Code className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1">Inline code</span>
        <span className="text-[10px] text-[#6e6e6e]">⌘E</span>
      </button>

      {/* Font picker — applies a font-family to the selection only (Google Docs style).
          The page itself has no global font; everything inherits from --app-font unless
          a selection is explicitly styled here. */}
      <div className="border-b border-[#2f2f2f] px-2 pt-2 pb-1.5">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[10.5px] font-medium uppercase tracking-wider text-[#7a7a7a]">
          <CaseSensitive className="h-3 w-3" /> Font
        </div>
        <button
          type="button"
          onClick={() => setFontOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#e8e8e8] hover:border-[#3a3a3a]"
          style={{ fontFamily: currentFontStack || undefined }}
        >
          <span className="truncate">
            {(() => {
              const match = titleFontOptions.find((o) => FONT_STACKS[o.value] === currentFontStack);
              return match ? match.label : (currentFontStack ? 'Custom' : 'Default (page font)');
            })()}
          </span>
          <span className="ml-2 text-[#6e6e6e]">▾</span>
        </button>
        {fontOpen && (
          <div className="mt-1 max-h-44 overflow-y-auto rounded border border-[#2a2a2a] bg-[#1d1d1d] py-1">
            <button
              onClick={() => { applyFontFamily(''); setFontOpen(false); }}
              className={`flex w-full items-center justify-between px-2 py-1 text-left text-[12px] transition-colors ${
                !currentFontStack ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#c4c4c4] hover:bg-white/[0.045]'
              }`}
            >
              <span>Default (page font)</span>
              {!currentFontStack && <span className="text-[10px] text-[#7ea0d2]">✓</span>}
            </button>
            {titleFontOptions.map((opt) => {
              const stack = FONT_STACKS[opt.value];
              const active = currentFontStack === stack;
              return (
                <button
                  key={opt.value}
                  onClick={() => { applyFontFamily(stack); setFontOpen(false); }}
                  className={`flex w-full items-center justify-between px-2 py-1 text-left text-[12px] transition-colors ${
                    active ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#c4c4c4] hover:bg-white/[0.045]'
                  }`}
                  style={{ fontFamily: stack }}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <span className="text-[10px] text-[#7ea0d2]">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Color row — text color + highlight, like Google Docs' A/A buttons.
          Each opens the full 10×5 + neutrals + hex ColorPickerPopover. */}
      <div className="flex items-center gap-1 border-b border-[#2f2f2f] px-2 py-1.5">
        <ColorChip
          label="Text"
          icon={Palette}
          underline={currentTextColor || '#e8e8e8'}
          open={textColorOpen}
          onToggle={() => { setTextColorOpen((v) => !v); setBgColorOpen(false); }}
          onPick={(hex) => { applyTextColor(hex); setTextColorOpen(false); }}
          onReset={() => { applyTextColor(''); setTextColorOpen(false); }}
          currentValue={currentTextColor}
        />
        <ColorChip
          label="Highlight"
          icon={Highlighter}
          underline={currentBgColor || '#fff59d'}
          open={bgColorOpen}
          onToggle={() => { setBgColorOpen((v) => !v); setTextColorOpen(false); }}
          onPick={(hex) => { applyBgColor(hex); setBgColorOpen(false); }}
          onReset={() => { applyBgColor(''); setBgColorOpen(false); }}
          currentValue={currentBgColor}
        />
      </div>

      <div className="px-2 pt-2 pb-1">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[10.5px] font-medium uppercase tracking-wider text-[#7a7a7a]">
          <Type className="h-3 w-3" /> Font size
        </div>
        <input
          type="number"
          step="0.5"
          min={6}
          max={96}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(draft);
          }}
          onBlur={() => { if (draft && Number(draft) !== currentSize) apply(draft); }}
          placeholder="Type a size (decimals ok)"
          className="mb-1 w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#e8e8e8] outline-none focus:border-[#3a3a3a]"
        />
        <div className="max-h-56 overflow-y-auto">
          {INLINE_SIZES.map((s) => {
            const isActive = currentSize === s;
            return (
              <button
                key={s}
                onClick={() => applyInlineSize(s)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[13px] transition-colors ${
                  isActive
                    ? 'bg-white/[0.07] text-[#e8e8e8]'
                    : 'text-[#c4c4c4] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
                }`}
              >
                <span style={{ fontSize: Math.min(s, 18) }}>{s}px</span>
                {isActive && <span className="text-[10px] text-[#7ea0d2]">✓</span>}
              </button>
            );
          })}
          {currentSize && (
            <button
              onClick={resetInlineSize}
              className="mt-1 flex w-full items-center gap-1.5 rounded border-t border-[#373737] px-2 py-1.5 pt-2 text-[12.5px] text-[#9a9a9a] transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
            >
              <RotateCcw className="h-3 w-3" /> Reset to default
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Google-Docs-style A/highlight button: icon with a small color bar underneath
// showing the currently-applied color, plus a popover with the full color picker.
function ColorChip({ label, icon: Icon, underline, open, onToggle, onPick, onReset, currentValue }) {
  return (
    <div className="relative flex-1">
      <button
        type="button"
        title={label}
        onClick={onToggle}
        className={`flex w-full flex-col items-center gap-0.5 rounded px-2 py-1 transition-colors ${
          open
            ? 'bg-white/[0.08] text-[#e8e8e8]'
            : 'text-[#c4c4c4] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
        }`}
      >
        <div className="flex items-center gap-1 text-[10.5px]">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="h-1 w-6 rounded-sm" style={{ background: underline }} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-[2200] mt-1.5 -translate-x-1/2">
          <ColorPickerPopover
            value={currentValue || '#5b86c8'}
            onChange={onPick}
            onClose={() => onToggle()}
          />
          {currentValue && (
            <button
              onClick={onReset}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-[#373737] bg-[#252525] px-2 py-1 text-[11.5px] text-[#9a9a9a] hover:text-[#e8e8e8]"
            >
              <RotateCcw className="h-3 w-3" /> Reset {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormatBtn({ icon: Icon, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active
          ? 'bg-white/[0.08] text-[#e8e8e8]'
          : 'text-[#9a9a9a] hover:bg-white/[0.05] hover:text-[#e8e8e8]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
