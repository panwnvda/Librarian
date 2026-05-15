import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { titleFontOptions } from '@/lib/pageStyleOptions';
import { FONT_STACKS } from '@/hooks/useGlobalFont';

// Right-click size picker, Google-Docs style. Positioned at the click point
// passed in as `anchor: { x, y }`. Number input accepts decimals; preset
// buttons cover common sizes. Closes on Escape / outside-click / preset pick.
//
// If `onFontChange` is provided, a Font row is rendered above the size
// controls — same popover gives both. Pass `font` (current value, or null
// for default) and `onFontChange(value|null)`.
//
// Used by:
//   - MapBlock (column titles, technique titles, technique subtitles)
//   - EditorContextMenu (page title + inline text selection)
//   - PageEditor (anywhere else size needs to change)
export default function SizePicker({
  anchor,
  value,
  onChange,
  onClose,
  presets = [9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 48, 64],
  label = 'Size',
  min = 6,
  max = 96,
  font,
  onFontChange,
}) {
  const [fontOpen, setFontOpen] = useState(false);
  const rootRef = useRef(null);
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => { setDraft(String(value ?? '')); }, [value]);

  // Close on click outside.
  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const apply = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    onChange?.(Math.max(min, Math.min(max, n)));
  };

  // Keep popover on-screen near the click point. Slightly taller when the
  // optional font picker is shown (extra ~36px for the row + dropdown).
  const W = 176, H = onFontChange ? 340 : 280;
  const x = Math.max(8, Math.min(anchor.x, window.innerWidth - W - 8));
  const y = Math.max(8, Math.min(anchor.y, window.innerHeight - H - 8));
  const currentFontLabel = font
    ? (titleFontOptions.find((o) => o.value === font)?.label ?? 'Default')
    : 'Default (inherit)';

  // Portal to document.body so `position: fixed` resolves against the
  // viewport. Without this, the picker is rendered as a descendant of
  // BlockNote's block-outer divs which carry transform/will-change
  // properties — those create new containing blocks for fixed-positioned
  // descendants, which is why the leftmost column's popover appeared
  // clipped off the left edge.
  const popover = (
    <div
      ref={rootRef}
      className="fixed z-[2200] w-44 rounded-lg border border-[#373737] bg-[#252525] py-1 shadow-2xl"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      {onFontChange && (
        <div className="px-3 py-1.5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-[#7a7a7a]">Font</div>
          <button
            onClick={() => setFontOpen((v) => !v)}
            className={`flex w-full items-center justify-between rounded border px-2 py-1 text-[12px] transition-colors ${
              fontOpen
                ? 'border-[#3a3a3a] bg-white/[0.05] text-[#e8e8e8]'
                : 'border-[#2a2a2a] bg-[#1a1a1a] text-[#c4c4c4] hover:border-[#3a3a3a]'
            }`}
            style={{ fontFamily: font ? (FONT_STACKS[font] ?? 'var(--app-font)') : 'var(--app-font)' }}
          >
            <span className="truncate">{currentFontLabel}</span>
            <span className="ml-2 flex-shrink-0 text-[#5a5a5a]">▾</span>
          </button>
          {fontOpen && (
            <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-[#2a2a2a] bg-[#1d1d1d] py-1">
              <button
                onClick={() => { onFontChange(null); setFontOpen(false); }}
                className={`flex w-full items-center justify-between px-2.5 py-1 text-left text-[11.5px] transition-colors ${
                  !font ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#c4c4c4] hover:bg-white/[0.045]'
                }`}
                style={{ fontFamily: 'var(--app-font)' }}
              >
                <span className="truncate">Default (inherit)</span>
                {!font && <Check className="h-3 w-3 flex-shrink-0 text-[#7ea0d2]" />}
              </button>
              {titleFontOptions.map((opt) => {
                const active = font === opt.value;
                const stack = FONT_STACKS[opt.value] ?? FONT_STACKS['font-mono'];
                return (
                  <button
                    key={opt.value}
                    onClick={() => { onFontChange(opt.value); setFontOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1 text-left text-[11.5px] transition-colors ${
                      active ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#c4c4c4] hover:bg-white/[0.045]'
                    }`}
                    style={{ fontFamily: stack }}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && <Check className="h-3 w-3 flex-shrink-0 text-[#7ea0d2]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {onFontChange && <div className="mx-2 my-0.5 h-px bg-[#2f2f2f]" />}
      <div className="px-3 py-1.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-[#7a7a7a]">{label}</div>
        <input
          autoFocus
          type="number"
          step="0.5"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { apply(draft); onClose?.(); }
            else if (e.key === 'Escape') onClose?.();
          }}
          onBlur={() => apply(draft)}
          placeholder="Type a size (decimals ok)"
          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-[12px] text-[#e8e8e8] outline-none focus:border-[#3a3a3a]"
        />
      </div>
      <div className="max-h-52 overflow-y-auto border-t border-[#2f2f2f] py-1">
        {presets.map((p) => {
          const active = Math.abs((Number(value) || 0) - p) < 0.01;
          return (
            <button
              key={p}
              onClick={() => { onChange?.(p); setDraft(String(p)); onClose?.(); }}
              className={`flex w-full items-center justify-between px-3 py-1 text-left text-[12px] transition-colors ${
                active ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#c4c4c4] hover:bg-white/[0.045]'
              }`}
            >
              <span>{p}</span>
              {active && <Check className="h-3 w-3 text-[#7ea0d2]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
  return createPortal(popover, document.body);
}
