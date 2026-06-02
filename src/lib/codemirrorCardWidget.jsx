// Renders a full TechniqueCard + CardEditorPage inside a CodeMirror WidgetType
// so that ```card fenced blocks look identical to cards in .library block pages.
// A BlockNote-style left gutter (+ / ⋮⋮) provides add-line-below, duplicate,
// delete, and drag-to-reorder for the card block.

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WidgetType } from '@codemirror/view';
import TechniqueCard from '@/components/TechniqueCard';
import CardEditorPage from '@/components/CardEditorPage';
import { Pencil, Plus, GripVertical, Copy, Trash2, ArrowDownToLine } from 'lucide-react';

const DEFAULTS = {
  title: 'New Technique',
  subtitle: '',
  tags: [],
  accentColor: 'cyan',
  // null = inherit the page's --app-font setting (matches CardBlock.jsx).
  font: null,
  overview: '',
  steps: [],
  stepBlocks: [],
  commands: [],
  subsections: [],
  subCards: [],
};

function CardWidgetUI({ json, onSave, ops }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cardData, setCardData] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(json) }; } catch { return { ...DEFAULTS }; }
  });

  // CardEditorPage auto-saves on a 400ms debounce while open. We only sync the
  // preview state + write through to the doc here — we do NOT close the editor
  // (that would slam it shut every time the debounce fires). Closing is the
  // Back/Escape job (onCancel) below.
  const handleSave = (saved) => {
    setCardData(saved);
    onSave(saved);
  };

  // The ⋮⋮ handle uses POINTER capture (not HTML5 drag): a real drag would feed
  // a text payload into CodeMirror's drop handler, which inserts the literal
  // word "card". With pointer capture there's no dataTransfer at all — nothing
  // can be inserted — and the whole pointermove/up stream is guaranteed to land
  // here regardless of what's underneath. A move past the 4px threshold reorders
  // the block; a plain click toggles the options menu.
  const drag = React.useRef(null);

  const onHandlePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not all envs */ }
    drag.current = { startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moved: false };
  };

  const onHandlePointerMove = (e) => {
    const s = drag.current;
    if (!s) return;
    s.x = e.clientX; s.y = e.clientY;
    if (!s.moved && (Math.abs(e.clientX - s.startX) > 4 || Math.abs(e.clientY - s.startY) > 4)) {
      s.moved = true;
      setMenuOpen(false);
      setDragging(true);
    }
  };

  const onHandlePointerUp = (e) => {
    const s = drag.current;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!s) return;
    if (s.moved) {
      setDragging(false);
      ops.moveToCoords(e.clientX, e.clientY);
    } else {
      setMenuOpen((o) => !o);
    }
  };

  const menuAction = (fn) => (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    fn();
  };

  return (
    <div
      // The card box itself is flush with the surrounding markdown content
      // (w-full, no left inset). The +/⋮⋮ controls live in the editor's 3rem
      // blockGutter strip to the left via a negative offset — that strip is
      // padding inside .cm-content, so it isn't clipped by .cm-scroller.
      className="group relative my-1 w-full"
      contentEditable={false}
      suppressContentEditableWarning
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      // Block the browser's native HTML5 text-drag inside the card, and stop
      // mousedown/mouseup from reaching CodeMirror so text can be selected and
      // the card's own buttons still receive clicks.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      style={{ userSelect: 'text', WebkitUserSelect: 'text', opacity: dragging ? 0.4 : 1 }}
    >
      {/* Transparent hover bridge filling the gutter, flush with the card's
          left edge. Without it the pointer leaves the wrapper the instant it
          crosses into the gutter (firing onMouseLeave → controls vanish before
          they can be clicked). As a wrapper descendant it keeps `hovered` true
          the whole way across to the +/⋮⋮ controls. */}
      {hovered && !editing && (
        <div className="absolute -left-12 top-0 bottom-0 w-12 z-10" contentEditable={false} aria-hidden="true" />
      )}

      {hovered && !editing && (
        <div
          className="absolute -left-12 top-1 z-20 flex items-center gap-0.5"
          contentEditable={false}
        >
          <button
            title="Add line below"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); ops.addLineBelow(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#9d9d9d] transition-colors hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            title="Drag to move · click for options"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            className={`flex h-6 w-5 items-center justify-center rounded text-[#9d9d9d] transition-colors hover:bg-[#2a2a2a] hover:text-[#e8e8e8] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      )}

      {menuOpen && !editing && (
        <div
          className="absolute -left-12 top-9 z-30 min-w-[10rem] overflow-hidden rounded-md border border-[#2a2a2a] bg-[#202020] py-1 text-sm text-[#cfcfcf] shadow-lg"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button onClick={menuAction(ops.addLineBelow)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2a2a]">
            <ArrowDownToLine className="h-3.5 w-3.5" /> Add line below
          </button>
          <button onClick={menuAction(ops.duplicate)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2a2a]">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button onClick={menuAction(ops.remove)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[#e89797] hover:bg-[#2a2a2a]">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {hovered && !editing && (
        <div className="absolute right-2 top-2 z-10">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="flex items-center gap-1 rounded-md bg-[#2a2a2a] px-2 py-1 text-xs text-[#9d9d9d] shadow-md transition-colors hover:bg-[#3a3a3a] hover:text-[#e8e8e8]"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
      )}

      <TechniqueCard {...cardData} />

      {editing && (
        <div onClick={(e) => e.stopPropagation()}>
          <CardEditorPage card={cardData} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

// Re-derive the fence's [startLine, endLine] from the live doc so growing/
// shrinking card content can't desync a stored end offset.
function deriveBlockRange(doc, blockFrom) {
  if (blockFrom > doc.length) return null;
  const startLine = doc.lineAt(blockFrom);
  let endNum = doc.lines;
  for (let n = startLine.number + 1; n <= doc.lines; n++) {
    if (doc.line(n).text.trim() === '```') { endNum = n; break; }
  }
  return { startLine, endLine: doc.line(endNum) };
}

export class CardWidget extends WidgetType {
  constructor(json, blockFrom, blockTo) {
    super();
    this.json = json;
    this.blockFrom = blockFrom;
    this.blockTo = blockTo;
  }

  toDOM(view) {
    const container = document.createElement('div');
    container.setAttribute('contenteditable', 'false');
    container.className = 'cm-card-widget';

    const blockFrom = this.blockFrom;

    // All doc edits are deferred past any in-progress CodeMirror update:
    // CardEditorPage's debounce/unmount-flush and our own gesture handlers can
    // fire mid-update, and a synchronous dispatch there throws "Calls to
    // EditorView.update are not allowed while an update is in progress".
    const onSave = (savedCard) => {
      const newFence = '```card\n' + JSON.stringify(savedCard) + '\n```';
      queueMicrotask(() => {
        const range = deriveBlockRange(view.state.doc, blockFrom);
        if (!range) return;
        const { startLine, endLine } = range;
        if (view.state.doc.sliceString(startLine.from, endLine.to) === newFence) return;
        view.dispatch({ changes: { from: startLine.from, to: endLine.to, insert: newFence } });
      });
    };

    const ops = {
      addLineBelow: () => queueMicrotask(() => {
        const range = deriveBlockRange(view.state.doc, blockFrom);
        if (!range) return;
        const at = range.endLine.to;
        view.dispatch({ changes: { from: at, insert: '\n' }, selection: { anchor: at + 1 } });
        view.focus();
      }),
      duplicate: () => queueMicrotask(() => {
        const range = deriveBlockRange(view.state.doc, blockFrom);
        if (!range) return;
        const text = view.state.doc.sliceString(range.startLine.from, range.endLine.to);
        view.dispatch({ changes: { from: range.endLine.to, insert: '\n' + text } });
      }),
      remove: () => queueMicrotask(() => {
        const range = deriveBlockRange(view.state.doc, blockFrom);
        if (!range) return;
        const to = Math.min(range.endLine.to + 1, view.state.doc.length);
        view.dispatch({ changes: { from: range.startLine.from, to, insert: '' } });
      }),
      moveToCoords: (x, y) => queueMicrotask(() => {
        const range = deriveBlockRange(view.state.doc, blockFrom);
        if (!range) return;
        const { doc } = view.state;
        const blockStart = range.startLine.from;
        const blockEnd = Math.min(range.endLine.to + 1, doc.length);
        const text = doc.sliceString(blockStart, blockEnd);
        // precise=false → snaps to the nearest position instead of returning
        // null when the drop lands in a margin/gutter or just off a glyph.
        const pos = view.posAtCoords({ x, y }, false);
        if (pos == null) return;
        const targetLine = doc.lineAt(pos);

        // Drop point relative to the target line's vertical midpoint decides
        // whether the card lands above or below that line. Without this, a drop
        // onto the line directly under the card always resolves to "before it"
        // (its own start = the block's end) and reads as a no-op — the card
        // never moves down past adjacent text.
        const lineCoords = view.coordsAtPos(targetLine.from);
        const after = lineCoords ? y > (lineCoords.top + lineCoords.bottom) / 2 : false;

        let insertAt;
        if (after) {
          insertAt =
            targetLine.number < doc.lines
              ? doc.line(targetLine.number + 1).from
              : doc.length; // last line — append below
        } else {
          insertAt = targetLine.from;
        }

        if (insertAt > blockStart && insertAt < blockEnd) return; // interior of self

        const atDocEnd = insertAt === doc.length && (doc.length === 0 || doc.sliceString(doc.length - 1) !== '\n');
        const body = text.endsWith('\n') ? text : text + '\n';
        const insert = atDocEnd ? '\n' + (body.endsWith('\n') ? body.slice(0, -1) : body) : body;

        // Both changes reference original positions; one dispatch maps them.
        view.dispatch({
          changes: [
            { from: blockStart, to: blockEnd, insert: '' },
            { from: insertAt, insert },
          ],
        });
      }),
    };

    const root = createRoot(container);
    root.render(<CardWidgetUI json={this.json} onSave={onSave} ops={ops} />);
    container._cmCardRoot = root;
    return container;
  }

  destroy(dom) {
    if (dom._cmCardRoot) {
      dom._cmCardRoot.unmount();
      dom._cmCardRoot = null;
    }
  }

  // Identity is the fence's start position, NOT its JSON. If we compared JSON,
  // every auto-save (which rewrites the fence) would make CodeMirror destroy
  // and recreate this widget — unmounting the open CardEditorPage and losing
  // the edit session. Keying on position lets the widget (and its React state)
  // survive content edits; the live card data is held in CardWidgetUI state.
  eq(other) {
    return other instanceof CardWidget && other.blockFrom === this.blockFrom;
  }

  // Let all events through so the card's buttons and expand/collapse work.
  ignoreEvent() { return false; }
}
