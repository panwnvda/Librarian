import React, { useEffect, useRef, useState } from 'react';
import { Check, Pipette } from 'lucide-react';

// 10 hues × 5 shades — same shape Google Drive uses for its font/highlight color popover.
// Hues read warm → cool → fresh → neutral; rows go pale → deep.
const PALETTE = [
  // pale (≈ tailwind 200)
  ['#fecaca', '#fed7aa', '#fde68a', '#fef08a', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#c7d2fe', '#e9d5ff', '#fbcfe8'],
  // soft (≈ 300)
  ['#fca5a5', '#fdba74', '#fcd34d', '#fde047', '#86efac', '#67e8f9', '#93c5fd', '#a5b4fc', '#d8b4fe', '#f9a8d4'],
  // medium (≈ 400)
  ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6'],
  // bold (≈ 500)
  ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'],
  // deep (≈ 700)
  ['#b91c1c', '#c2410c', '#b45309', '#a16207', '#15803d', '#0e7490', '#1d4ed8', '#4338ca', '#7e22ce', '#be185d'],
];

const NEUTRALS = ['#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff'];

const normalizeHex = (raw) => {
  if (!raw) return null;
  let v = raw.trim().replace(/^#/, '');
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return `#${v.toLowerCase()}`;
};

function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside, active]);
}

/**
 * ColorPicker
 *
 * @param {string} value          Current color (hex string). May be falsy.
 * @param {(hex:string)=>void} onChange  Called with a normalized #rrggbb string.
 * @param {()=>void} [onClose]    Optional — called after user picks a swatch / commits hex.
 * @param {boolean} [open]        If provided, controlled open state for the popover; otherwise renders inline.
 */
export default function ColorPicker({ value, onChange, onClose, inline = true }) {
  const [hexDraft, setHexDraft] = useState(value || '');
  const nativeRef = useRef(null);

  useEffect(() => {
    setHexDraft(value || '');
  }, [value]);

  const commitHex = (raw) => {
    const norm = normalizeHex(raw);
    if (norm) {
      onChange(norm);
    }
  };

  const handleSwatch = (hex) => {
    onChange(hex);
    onClose?.();
  };

  const isSelected = (hex) => (value || '').toLowerCase() === hex.toLowerCase();

  const content = (
    <div className="w-[248px] space-y-2 p-2.5">
      <div className="grid grid-cols-10 gap-1">
        {PALETTE.flat().map((hex) => (
          <button
            key={hex}
            onClick={(e) => { e.stopPropagation(); handleSwatch(hex); }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className="relative h-[18px] w-[18px] rounded-[3px] ring-1 ring-inset ring-black/20 transition-transform hover:scale-110"
            style={{ background: hex }}
            title={hex}
          >
            {isSelected(hex) && (
              <Check className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" strokeWidth={3} />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-10 gap-1">
        {NEUTRALS.map((hex) => (
          <button
            key={hex}
            onClick={(e) => { e.stopPropagation(); handleSwatch(hex); }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className="relative h-[18px] w-[18px] rounded-[3px] ring-1 ring-inset ring-black/20 transition-transform hover:scale-110"
            style={{ background: hex }}
            title={hex}
          >
            {isSelected(hex) && (
              <Check className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 drop-shadow ${hex === '#ffffff' || hex === '#f3f4f6' || hex === '#d1d5db' ? 'text-black' : 'text-white'}`} strokeWidth={3} />
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-[#2a2a2a] pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wider text-[#7a7a7a]">Custom</span>
          <input
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => commitHex(hexDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitHex(hexDraft); onClose?.(); }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="#5b86c8"
            className="flex-1 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 font-mono text-[11.5px] text-[#e8e8e8] outline-none placeholder:text-[#5a5a5a] focus:border-[#3a3a3a]"
          />
          <button
            onClick={(e) => { e.stopPropagation(); nativeRef.current?.click(); }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-[#9a9a9a] transition-colors hover:border-[#3a3a3a] hover:text-[#e8e8e8]"
            title="Eyedropper / native picker"
          >
            <Pipette className="h-3 w-3" />
          </button>
          <input
            ref={nativeRef}
            type="color"
            value={normalizeHex(hexDraft) || normalizeHex(value) || '#5b86c8'}
            onChange={(e) => { setHexDraft(e.target.value); onChange(e.target.value); }}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );

  if (inline) return content;
  return content;
}

/**
 * Popover wrapper — renders the picker as a floating panel anchored below a trigger,
 * closing on outside click.
 */
export function ColorPickerPopover({ value, onChange, onClose, className = '' }) {
  const ref = useRef(null);
  useClickOutside(ref, () => onClose?.(), true);

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-lg border border-[#373737] bg-[#252525] shadow-2xl ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ColorPicker value={value} onChange={onChange} onClose={onClose} />
    </div>
  );
}
