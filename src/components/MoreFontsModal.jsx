import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { GOOGLE_FONTS_CATALOG, ensureGoogleFonts, buildStack } from '@/lib/googleFonts';

const CATEGORY_LABELS = {
  all: 'All',
  sans: 'Sans serif',
  serif: 'Serif',
  display: 'Display',
  mono: 'Monospace',
};

/**
 * MoreFontsModal — Google-Fonts-catalog picker with live previews and search.
 *
 * Props:
 *   open: boolean
 *   value: currently selected family name (string) | null
 *   onSelect: (family: string, category: string) => void
 *   onClose: () => void
 */
export default function MoreFontsModal({ open, value, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GOOGLE_FONTS_CATALOG.filter(([family, cat]) => {
      if (category !== 'all' && cat !== category) return false;
      if (!q) return true;
      return family.toLowerCase().includes(q);
    });
  }, [query, category]);

  // Lazy-load the fonts that are visible so previews render in their real face.
  useEffect(() => {
    if (!open) return;
    const families = filtered.slice(0, 80).map(([f]) => f);
    ensureGoogleFonts(families);
  }, [filtered, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 p-6 pt-20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#373737] bg-[#1f1f1f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
          <span className="text-[13px] font-medium text-[#e8e8e8]">More fonts</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + category filter */}
        <div className="border-b border-[#2a2a2a] px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5a5a5a]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              className="w-full rounded-md border border-[#2a2a2a] bg-[#1a1a1a] py-1.5 pl-8 pr-3 text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#5a5a5a] focus:border-[#3a3a3a]"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`rounded-full px-2.5 py-0.5 text-[11.5px] transition-colors ${
                  category === key
                    ? 'bg-white/[0.1] text-[#e8e8e8]'
                    : 'bg-white/[0.03] text-[#9a9a9a] hover:bg-white/[0.06] hover:text-[#c4c4c4]'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-[#5a5a5a]">
              {filtered.length} font{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-[#7a7a7a]">No fonts match “{query}”</div>
          ) : (
            filtered.map(([family, cat]) => {
              const active = value === family;
              return (
                <button
                  key={family}
                  onClick={() => { onSelect(family, cat); onClose(); }}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2 text-left transition-colors ${
                    active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-[18px] text-[#e8e8e8]" style={{ fontFamily: buildStack(family, cat) }}>
                    {family}
                  </span>
                  <span className="flex-shrink-0 text-[10.5px] uppercase tracking-wider text-[#5a5a5a]">{cat}</span>
                  {active && <Check className="h-4 w-4 flex-shrink-0 text-[#7ea0d2]" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
