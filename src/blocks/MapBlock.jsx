import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReactBlockSpec } from '@blocknote/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Trash2, GripVertical, Palette, Layers, Check, CaseSensitive, GripHorizontal, Link2, X, ExternalLink } from 'lucide-react';
import { persistGet, persistSet } from '@/lib/persistentStorage';
import { titleFontOptions } from '@/lib/pageStyleOptions';
import { FONT_STACKS } from '@/hooks/useGlobalFont';
import { ColorPickerPopover } from '@/components/ColorPicker';
import SizePicker from '@/components/SizePicker';
import { loadPages } from '@/lib/pageStore';

// ─── Storage ──────────────────────────────────────────────────────────────────

const storageKey = (mapId) => `library_map_${mapId}`;

const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;

const newColumn = (title = 'New column') => ({
  id: newId('col'),
  title,
  color: 'gray',
  // null = inherit the page's default font (--app-font from useGlobalFont).
  // The column ⋯ menu's Font picker can override this per-column.
  font: null,
  techniques: [],
});

const newTechnique = (title = '') => ({
  id: newId('tech'),
  title,
  subtitle: '',
  // Optional link: { type: 'page', id: '<page-id>' }. When set, clicking the
  // card navigates to that target instead of opening the inline editor.
  link: null,
});

// ─── Color palette ────────────────────────────────────────────────────────────
// Ordered by hue (warm → cool → fresh → neutral) so the swatch grid reads
// as a smooth spectrum. Each entry: dot (vivid swatch), text (legible on
// #1d1d1d), ring (deeper outline for selection/edit states).

const COLORS = {
  red:     { dot: '#d36868', text: '#e89797', ring: '#7d4242' },
  ruby:    { dot: '#b53a3a', text: '#e07878', ring: '#6a2828' },
  rose:    { dot: '#e16078', text: '#f59ca8', ring: '#8a3848' },
  pink:    { dot: '#d178b5', text: '#e0a8cf', ring: '#7d4d6a' },
  magenta: { dot: '#d44ec6', text: '#e88adf', ring: '#7a2e70' },
  fuchsia: { dot: '#c850c6', text: '#e288e1', ring: '#73326f' },
  purple:  { dot: '#9b7ec8', text: '#c0a8e0', ring: '#5f4d7d' },
  violet:  { dot: '#8a76e0', text: '#b3a6f0', ring: '#4f478a' },
  indigo:  { dot: '#7080d4', text: '#a0aee8', ring: '#404880' },
  blue:    { dot: '#5b86c8', text: '#86b0e3', ring: '#3d557d' },
  sky:     { dot: '#5fa5d6', text: '#8cc8e8', ring: '#3d6580' },
  cyan:    { dot: '#5bb8c8', text: '#86d4e0', ring: '#3d6a7a' },
  teal:    { dot: '#5db09e', text: '#86c8b8', ring: '#3e6c5e' },
  mint:    { dot: '#6ed4a9', text: '#a0e8c8', ring: '#3d7a5e' },
  emerald: { dot: '#5db075', text: '#86c89c', ring: '#3e6c4d' },
  green:   { dot: '#67b365', text: '#90cc8e', ring: '#456e44' },
  lime:    { dot: '#a3c95a', text: '#c4dd87', ring: '#637c34' },
  yellow:  { dot: '#cfa84b', text: '#e2c47a', ring: '#7a6432' },
  amber:   { dot: '#d4a14a', text: '#e8c378', ring: '#7a5e2c' },
  orange:  { dot: '#d68c5a', text: '#e8a87c', ring: '#7d5634' },
  brown:   { dot: '#a07458', text: '#c69f85', ring: '#624632' },
  stone:   { dot: '#78716c', text: '#a8a29e', ring: '#3f3a36' },
  slate:   { dot: '#64748b', text: '#94a3b8', ring: '#334155' },
  gray:    { dot: '#7a7a7a', text: '#c4c4c4', ring: '#3a3a3a' },
};

const COLOR_KEYS = Object.keys(COLORS);

// Custom hex support: when `column.color` is a #RRGGBB value (set via the color
// picker's hex input), derive a small palette around it instead of looking up
// the named-color table. Text/ring use opacity-adjusted variants so contrast
// remains readable on the #1d1d1d card background.
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

const hexToRgb = (hex) => {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

const mixWithBlack = (hex, amount) => {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c * (1 - amount)).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
};

const mixWithWhite = (hex, amount) => {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
};

const resolvePalette = (color) => {
  if (isHex(color)) {
    return {
      dot: color,
      text: mixWithWhite(color, 0.35),
      ring: mixWithBlack(color, 0.45),
    };
  }
  return COLORS[color] ?? COLORS.gray;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

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

// ─── Technique row ────────────────────────────────────────────────────────────

function TechniqueRow({ technique, color, fontStack, onUpdate, onDelete, dragHandleProps }) {
  // Two modes: viewing the row (clicking navigates if linked, edits if not),
  // or editing title/subtitle inline. Keeps the previous-version simplicity —
  // no embedded overview/steps/commands editor (those belong on the linked
  // page or /card block).
  const [editing, setEditing] = useState(!technique.title);
  const [draft, setDraft] = useState({ title: technique.title, subtitle: technique.subtitle });
  const [linkOpen, setLinkOpen] = useState(null); // null | { x, y }
  // Right-click size picker: `sizeFor` is 'title' | 'subtitle' | null, `sizeAnchor`
  // is the click point. Each technique stores its own `titleSize` / `subtitleSize`
  // (decimals allowed) — fall back to 10.5 if unset.
  const [sizeFor, setSizeFor] = useState(null);
  const [sizeAnchor, setSizeAnchor] = useState(null);
  const titleSize = Number(technique.titleSize) || 13;
  const subtitleSize = Number(technique.subtitleSize) || 13;
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = { title: draft.title.trim(), subtitle: draft.subtitle.trim() };
    if (!trimmed.title) { onDelete(); return; }
    onUpdate(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    if (!technique.title) { onDelete(); return; }
    setDraft({ title: technique.title, subtitle: technique.subtitle });
    setEditing(false);
  };

  useClickOutside(rootRef, commit, editing);

  const ring = resolvePalette(color).ring;
  const linked = technique.link?.type === 'page' && technique.link?.id;
  const styleFont = { fontFamily: fontStack || 'var(--app-font)' };

  if (editing) {
    return (
      <div
        ref={rootRef}
        className="rounded-md border bg-[#1a1a1a] p-2"
        style={{ borderColor: ring }}
        contentEditable={false}
      >
        <input
          ref={inputRef}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          placeholder="Technique name"
          className="w-full bg-transparent font-medium text-[#e8e8e8] placeholder-[#5a5a5a] outline-none"
          style={{ ...styleFont, fontSize: `${titleSize}px`, padding: 0, lineHeight: 1.2 }}
        />
        <input
          value={draft.subtitle}
          onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          placeholder="Notes (optional)"
          className="mt-1 w-full bg-transparent text-[#9a9a9a] placeholder-[#5a5a5a] outline-none"
          style={{ ...styleFont, fontSize: `${subtitleSize}px`, padding: 0, lineHeight: 1.2 }}
        />
      </div>
    );
  }

  // Single click → navigate if linked, else open inline editor.
  const handleOpen = (e) => {
    e.stopPropagation();
    if (linked) navigate(`/page/${technique.link.id}`);
    else setEditing(true);
  };

  return (
    <div
      className="group relative flex items-start gap-1.5 rounded-md border border-transparent bg-[#1f1f1f] p-2 transition-colors hover:border-[#3a3a3a] hover:bg-[#232323]"
      contentEditable={false}
    >
      <span
        {...dragHandleProps}
        className="mt-0.5 flex h-4 w-3 cursor-grab items-center justify-center text-[#3a3a3a] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <button
        onClick={handleOpen}
        onMouseDown={(e) => e.stopPropagation()}
        className="min-w-0 flex-1 text-left"
        title={linked ? 'Open linked page' : 'Click to edit'}
      >
        <p
          className="flex items-center gap-1 truncate font-medium leading-snug text-[#e8e8e8]"
          style={{ ...styleFont, fontSize: `${titleSize}px` }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSizeFor('title');
            setSizeAnchor({ x: e.clientX, y: e.clientY });
          }}
        >
          {technique.title || 'Untitled technique'}
          {linked && <ExternalLink className="h-3 w-3 flex-shrink-0 text-[#6e6e6e]" />}
        </p>
        {technique.subtitle && (
          <p
            className="truncate leading-snug text-[#8a8a8a]"
            style={{ ...styleFont, fontSize: `${subtitleSize}px` }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSizeFor('subtitle');
              setSizeAnchor({ x: e.clientX, y: e.clientY });
            }}
          >
            {technique.subtitle}
          </p>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setLinkOpen((v) => v ? null : { x: e.clientX, y: e.clientY });
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-opacity hover:text-[#c4c4c4] ${
          linked ? 'text-[#7ea0d2] opacity-100' : 'text-[#5a5a5a] opacity-0 group-hover:opacity-100'
        }`}
        title={linked ? 'Change link' : 'Link to a page'}
      >
        <Link2 className="h-3 w-3" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[#5a5a5a] opacity-0 transition-opacity hover:text-[#c4c4c4] group-hover:opacity-100"
        title="Rename"
      >
        <CaseSensitive className="h-3 w-3" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[#5a5a5a] opacity-0 transition-opacity hover:text-[#e57373] group-hover:opacity-100"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {linkOpen && (
        <LinkPicker
          anchor={linkOpen}
          currentLink={technique.link}
          onPick={(link) => { onUpdate({ link }); setLinkOpen(null); }}
          onClose={() => setLinkOpen(null)}
        />
      )}

      {sizeFor && sizeAnchor && (
        <SizePicker
          anchor={sizeAnchor}
          value={sizeFor === 'title' ? titleSize : subtitleSize}
          onChange={(n) => onUpdate(sizeFor === 'title' ? { titleSize: n } : { subtitleSize: n })}
          onClose={() => { setSizeFor(null); setSizeAnchor(null); }}
        />
      )}
    </div>
  );
}

// Popover that lists all pages and lets the user link the technique to one.
// Uses fixed positioning anchored at the click point and clamped to the
// viewport so it never overflows the narrow column or runs off the right
// edge of the screen.
function LinkPicker({ anchor, currentLink, onPick, onClose }) {
  const [pages, setPages] = useState([]);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    loadPages().then((data) => setPages(data || []));
  }, []);
  useClickOutside(rootRef, onClose, true);

  const filtered = pages.filter((p) =>
    (p.title || 'Untitled').toLowerCase().includes(query.trim().toLowerCase())
  );

  // Clamp so the 256px-wide / ~260px-tall popover stays on-screen.
  const W = 256, H = 280;
  const x = Math.max(8, Math.min((anchor?.x ?? 8) - 16, window.innerWidth - W - 8));
  const y = Math.max(8, Math.min((anchor?.y ?? 8) + 8, window.innerHeight - H - 8));

  return (
    <div
      ref={rootRef}
      className="fixed z-[2100] w-64 rounded-lg border border-[#373737] bg-[#252525] shadow-2xl"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 border-b border-[#2f2f2f] px-2 py-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages…"
          className="flex-1 bg-transparent text-[12px] text-[#e8e8e8] placeholder-[#5a5a5a] outline-none"
        />
        <button
          onClick={onClose}
          className="flex h-4 w-4 items-center justify-center rounded text-[#6e6e6e] hover:text-[#c4c4c4]"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {currentLink?.id && (
          <button
            onClick={() => onPick(null)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-[#e57373] transition-colors hover:bg-white/[0.05]"
          >
            <X className="h-3 w-3" /> Remove link
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-[11.5px] text-[#7a7a7a]">No pages match.</div>
        ) : (
          filtered.map((p) => {
            const active = currentLink?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onPick({ type: 'page', id: p.id })}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-[12px] transition-colors ${
                  active ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#c4c4c4] hover:bg-white/[0.045]'
                }`}
              >
                <span className="truncate">{p.title || 'Untitled'}</span>
                {active && <Check className="h-3 w-3 flex-shrink-0 text-[#7ea0d2]" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({ column, onUpdate, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const menuRef = useRef(null);
  const titleInputRef = useRef(null);

  const palette = resolvePalette(column.color);
  // null/undefined font = inherit the page's --app-font variable (set by
  // useGlobalFont). Only switch to an explicit FONT_STACKS value when the
  // user picks one in the column ⋯ menu.
  const fontStack = column.font ? (FONT_STACKS[column.font] ?? 'var(--app-font)') : 'var(--app-font)';
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    if (renaming) titleInputRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    if (!renaming) setTitleDraft(column.title);
  }, [column.title, renaming]);

  const commitRename = () => {
    const t = titleDraft.trim() || 'Untitled';
    onUpdate({ ...column, title: t });
    setRenaming(false);
  };

  const addTechnique = () => {
    onUpdate({ ...column, techniques: [...column.techniques, newTechnique()] });
  };

  const updateTechnique = (techId, patch) => {
    onUpdate({
      ...column,
      techniques: column.techniques.map((t) => (t.id === techId ? { ...t, ...patch } : t)),
    });
  };

  const deleteTechnique = (techId) => {
    onUpdate({
      ...column,
      techniques: column.techniques.filter((t) => t.id !== techId),
    });
  };

  const setColor = (color) => {
    onUpdate({ ...column, color });
  };

  const setFont = (font) => {
    onUpdate({ ...column, font });
    setFontOpen(false);
    setMenuOpen(false);
  };

  // Right-click on the column title opens the size picker at the click point.
  // Stored in column.titleSize (number, decimals allowed). Default 15px.
  const [sizePickerAt, setSizePickerAt] = useState(null);
  const titleSize = Number(column.titleSize) || 14;
  const setTitleSize = (size) => {
    onUpdate({ ...column, titleSize: size });
  };

  return (
    <div className="flex w-[220px] flex-shrink-0 flex-col" contentEditable={false}>
      {/* Header */}
      <div className="group flex items-center gap-1.5 px-1 pb-2">
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: palette.dot }}
        />
        {renaming ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { setTitleDraft(column.title); setRenaming(false); }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
            style={{ color: palette.text, fontFamily: fontStack, fontSize: `${titleSize}px` }}
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              setSizePickerAt({ x: e.clientX, y: e.clientY });
            }}
            className="min-w-0 flex-1 truncate text-left font-semibold"
            style={{ color: palette.text, fontFamily: fontStack, fontSize: `${titleSize}px` }}
            title="Right-click to change size"
          >
            {column.title}
          </button>
        )}
        {sizePickerAt && (
          <SizePicker
            anchor={sizePickerAt}
            value={titleSize}
            onChange={setTitleSize}
            onClose={() => setSizePickerAt(null)}
          />
        )}
        <span className="flex-shrink-0 text-[11px] tabular-nums text-[#6e6e6e]">
          {column.techniques.length}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex h-5 w-5 items-center justify-center rounded text-[#6e6e6e] opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-[#c4c4c4] group-hover:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-lg border border-[#373737] bg-[#252525] py-1 shadow-2xl">
              <button
                onClick={() => { setMenuOpen(false); setRenaming(true); setTitleDraft(column.title); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[12.5px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
              >
                Rename
              </button>

              {/* Color picker */}
              <div className="px-3 py-1.5">
                <div className="mb-1.5 flex items-center justify-between gap-1.5 text-[11px] text-[#7a7a7a]">
                  <span className="flex items-center gap-1.5">
                    <Palette className="h-3 w-3" /> Color
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setColorPickerOpen((v) => !v); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded-full ring-1 ring-white/20 transition-transform hover:scale-110"
                    style={{ background: palette.dot }}
                    title="Pick color"
                  />
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {COLOR_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={(e) => { e.stopPropagation(); setColor(key); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`h-4 w-4 rounded-full ring-offset-2 ring-offset-[#252525] transition-all ${
                        column.color === key ? 'ring-1 ring-white/40' : 'hover:scale-110'
                      }`}
                      style={{ background: COLORS[key].dot }}
                      title={key}
                    />
                  ))}
                </div>
                {colorPickerOpen && (
                  <div className="mt-2">
                    <ColorPickerPopover
                      value={isHex(column.color) ? column.color : palette.dot}
                      onChange={(hex) => setColor(hex)}
                      onClose={() => setColorPickerOpen(false)}
                    />
                  </div>
                )}
              </div>

              {/* Font picker */}
              <div className="px-3 py-1.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[#7a7a7a]">
                  <CaseSensitive className="h-3 w-3" /> Title font
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFontOpen((v) => !v); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`flex w-full items-center justify-between rounded-md border px-2 py-1 text-[12px] transition-colors ${
                    fontOpen
                      ? 'border-[#3a3a3a] bg-white/[0.05] text-[#e8e8e8]'
                      : 'border-[#2a2a2a] bg-[#1f1f1f] text-[#c4c4c4] hover:border-[#3a3a3a]'
                  }`}
                  style={{ fontFamily: fontStack }}
                >
                  <span className="truncate">
                    {column.font
                      ? (titleFontOptions.find((o) => o.value === column.font)?.label ?? 'Default')
                      : 'Default'}
                  </span>
                  <span className="ml-2 flex-shrink-0 text-[#5a5a5a]">▾</span>
                </button>
                {fontOpen && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-[#2a2a2a] bg-[#1d1d1d] py-1">
                    {/* "Default" sentinel — clears column.font so it falls back to --app-font. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setFont(null); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`flex w-full items-center justify-between px-2.5 py-1 text-left text-[12px] transition-colors ${
                        !column.font
                          ? 'bg-white/[0.06] text-[#e8e8e8]'
                          : 'text-[#c4c4c4] hover:bg-white/[0.045]'
                      }`}
                      style={{ fontFamily: 'var(--app-font)' }}
                    >
                      <span className="truncate">Default (page font)</span>
                      {!column.font && <Check className="h-3 w-3 flex-shrink-0 text-[#7ea0d2]" />}
                    </button>
                    {titleFontOptions.map((opt) => {
                      const active = column.font === opt.value;
                      const stack = FONT_STACKS[opt.value] ?? FONT_STACKS['font-mono'];
                      return (
                        <button
                          key={opt.value}
                          onClick={(e) => { e.stopPropagation(); setFont(opt.value); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`flex w-full items-center justify-between px-2.5 py-1 text-left text-[12px] transition-colors ${
                            active
                              ? 'bg-white/[0.06] text-[#e8e8e8]'
                              : 'text-[#c4c4c4] hover:bg-white/[0.045]'
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

              <div className="my-1 h-px bg-[#373737]" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[12.5px] text-[#e57373] transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" /> Delete column
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Color band */}
      <div
        className="h-[2px] rounded-full"
        style={{ background: palette.dot, opacity: 0.55 }}
      />

      {/* Techniques */}
      <Droppable droppableId={column.id} type="technique">
        {(drop, snap) => (
          <div
            ref={drop.innerRef}
            {...drop.droppableProps}
            className={`mt-2 flex flex-col gap-1.5 rounded-md p-1 transition-colors ${
              snap.isDraggingOver ? 'bg-white/[0.03]' : ''
            }`}
          >
            {column.techniques.map((t, index) => (
              <Draggable key={t.id} draggableId={t.id} index={index}>
                {(drag, dsnap) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    className={dsnap.isDragging ? 'opacity-70' : ''}
                  >
                    <TechniqueRow
                      technique={t}
                      color={column.color}
                      fontStack={fontStack}
                      onUpdate={(patch) => updateTechnique(t.id, patch)}
                      onDelete={() => deleteTechnique(t.id)}
                      dragHandleProps={drag.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {drop.placeholder}
            <button
              onClick={addTechnique}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-[#6e6e6e] transition-colors hover:bg-white/[0.045] hover:text-[#c4c4c4]"
            >
              <Plus className="h-3 w-3" /> Add technique
            </button>
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── MapBlock root ────────────────────────────────────────────────────────────

function MapBlockInner({ block, editor }) {
  const mapId = block.props.mapId || `map_${block.id.slice(0, 12)}`;
  const [data, setData] = useState(null);
  const saveTimer = useRef(null);

  // Height is stored as a number in block props (0 = auto-fit).
  const storedHeight = Number(block.props.height) || 0;
  const [height, setHeight] = useState(storedHeight);
  const resizingRef = useRef(null);

  useEffect(() => {
    setHeight(Number(block.props.height) || 0);
  }, [block.props.height]);

  useEffect(() => {
    if (!block.props.mapId) {
      editor.updateBlock(block, { type: 'map', props: { mapId } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persistHeight = useCallback((next) => {
    editor.updateBlock(block, { type: 'map', props: { ...block.props, mapId, height: next } });
  }, [editor, block, mapId]);

  const onResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      startY: e.clientY,
      startHeight: height || 320, // default starting height when first dragging from auto
      latest: height || 320,
    };
    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const dy = ev.clientY - resizingRef.current.startY;
      const next = Math.max(160, Math.min(2000, resizingRef.current.startHeight + dy));
      resizingRef.current.latest = next;
      setHeight(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (resizingRef.current) {
        persistHeight(resizingRef.current.latest);
        resizingRef.current = null;
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const resetHeight = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setHeight(0);
    persistHeight(0);
  };

  // Debounced save
  const save = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistSet(storageKey(mapId), next);
    }, 350);
  }, [mapId]);

  // Load — seed a single starter column on first creation so the column UX is visible immediately
  useEffect(() => {
    let cancelled = false;
    persistGet(storageKey(mapId)).then((stored) => {
      if (cancelled) return;
      if (stored?.columns && Array.isArray(stored.columns)) {
        setData(stored);
      } else {
        const initial = { columns: [newColumn('To do')] };
        setData(initial);
        persistSet(storageKey(mapId), initial);
      }
    });
    return () => { cancelled = true; };
  }, [mapId]);

  const updateData = useCallback((next) => {
    setData(next);
    save(next);
  }, [save]);

  const updateColumn = (colId, nextCol) => {
    updateData({
      ...data,
      columns: data.columns.map((c) => (c.id === colId ? nextCol : c)),
    });
  };

  const deleteColumn = (colId) => {
    updateData({
      ...data,
      columns: data.columns.filter((c) => c.id !== colId),
    });
  };

  const addColumn = () => {
    updateData({
      ...data,
      columns: [...data.columns, newColumn(`Column ${data.columns.length + 1}`)],
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    const srcCol = data.columns.find((c) => c.id === source.droppableId);
    const dstCol = data.columns.find((c) => c.id === destination.droppableId);
    if (!srcCol || !dstCol) return;

    const moved = srcCol.techniques.find((t) => t.id === draggableId);
    if (!moved) return;

    if (source.droppableId === destination.droppableId) {
      // Same column reorder
      const next = [...srcCol.techniques];
      next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      updateColumn(srcCol.id, { ...srcCol, techniques: next });
      return;
    }

    // Cross-column move
    const srcNext = srcCol.techniques.filter((t) => t.id !== draggableId);
    const dstNext = [...dstCol.techniques];
    dstNext.splice(destination.index, 0, moved);
    updateData({
      ...data,
      columns: data.columns.map((c) => {
        if (c.id === srcCol.id) return { ...c, techniques: srcNext };
        if (c.id === dstCol.id) return { ...c, techniques: dstNext };
        return c;
      }),
    });
  };

  if (!data) {
    return (
      <div
        className="my-2 flex h-24 w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#202020] text-[12px] text-[#6e6e6e]"
        contentEditable={false}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      className="my-2 w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1d1d1d]"
      contentEditable={false}
      data-skip-editor-context-menu
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] text-[#c4c4c4]">
          <Layers className="h-3.5 w-3.5 text-[#7a7a7a]" />
          <span className="font-medium">Framework</span>
          {data.columns.length > 0 && (
            <span className="text-[#6e6e6e]">
              · {data.columns.length} column{data.columns.length !== 1 ? 's' : ''},{' '}
              {data.columns.reduce((sum, c) => sum + c.techniques.length, 0)} techniques
            </span>
          )}
        </div>
        {data.columns.length > 0 && (
          <button
            onClick={addColumn}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#9a9a9a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
          >
            <Plus className="h-3 w-3" /> Add column
          </button>
        )}
      </div>

      {/* Body */}
      {data.columns.length === 0 ? (
        <div className="flex items-center justify-center px-4 py-10">
          <button
            onClick={addColumn}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-[#3a3a3a] px-3 py-1.5 text-[12.5px] text-[#9a9a9a] transition-colors hover:border-[#5a5a5a] hover:text-[#e8e8e8]"
          >
            <Plus className="h-3.5 w-3.5" /> Add column
          </button>
        </div>
      ) : (
        <div
          className="overflow-x-auto overflow-y-auto"
          style={height > 0 ? { height: `${height}px` } : undefined}
        >
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex min-w-min gap-4 p-4">
              {data.columns.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  onUpdate={(next) => updateColumn(col.id, next)}
                  onDelete={() => deleteColumn(col.id)}
                />
              ))}
              <button
                onClick={addColumn}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex w-[220px] flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-dashed border-[#3a3a3a] py-2 text-[12px] text-[#6e6e6e] transition-colors hover:border-[#5a5a5a] hover:text-[#c4c4c4]"
              >
                <Plus className="h-3 w-3" /> Add column
              </button>
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Resize handle */}
      {data.columns.length > 0 && (
        <div
          onMouseDown={onResizeStart}
          onDoubleClick={resetHeight}
          className="group flex h-3 cursor-row-resize items-center justify-center border-t border-[#2a2a2a] bg-[#1a1a1a] transition-colors hover:bg-[#222]"
          title={height > 0 ? 'Drag to resize · double-click to auto-fit' : 'Drag to set a fixed height'}
        >
          <GripHorizontal className="h-3 w-3 text-[#3a3a3a] transition-colors group-hover:text-[#7a7a7a]" />
        </div>
      )}
    </div>
  );
}

export const MapBlock = createReactBlockSpec(
  {
    type: 'map',
    propSchema: { mapId: { default: '' }, height: { default: 0 } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => <MapBlockInner block={block} editor={editor} />,
  }
);
