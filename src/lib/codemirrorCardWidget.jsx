// Renders a full TechniqueCard + CardEditorPage inside a CodeMirror WidgetType
// so that ```card fenced blocks look identical to cards in .library block pages.

import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { WidgetType } from '@codemirror/view';
import TechniqueCard from '@/components/TechniqueCard';
import CardEditorPage from '@/components/CardEditorPage';
import { Pencil } from 'lucide-react';

const DEFAULTS = {
  title: 'New Technique',
  subtitle: '',
  tags: [],
  accentColor: 'cyan',
  overview: '',
  steps: [],
  commands: [],
  subsections: [],
  subCards: [],
};

function CardWidgetUI({ json, onSave }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
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

  return (
    <div
      className="relative my-2"
      contentEditable={false}
      suppressContentEditableWarning
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
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
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <CardEditorPage card={cardData} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <TechniqueCard {...cardData} />
      )}
    </div>
  );
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
    const onSave = (savedCard) => {
      const newFence = '```card\n' + JSON.stringify(savedCard) + '\n```';
      // Defer past any in-progress CodeMirror update. CardEditorPage's debounce
      // and unmount-flush can fire mid-update; a synchronous dispatch there
      // throws "Calls to EditorView.update are not allowed while an update is
      // in progress" and tears down the editor.
      queueMicrotask(() => {
        const { doc } = view.state;
        if (blockFrom > doc.length) return;
        const startLine = doc.lineAt(blockFrom);
        // Re-derive the fence range from the live doc so growing/shrinking card
        // content can't desync a stored end offset.
        let endNum = doc.lines;
        for (let n = startLine.number + 1; n <= doc.lines; n++) {
          if (doc.line(n).text.trim() === '```') { endNum = n; break; }
        }
        const endLine = doc.line(endNum);
        if (doc.sliceString(startLine.from, endLine.to) === newFence) return;
        view.dispatch({ changes: { from: startLine.from, to: endLine.to, insert: newFence } });
      });
    };

    const root = createRoot(container);
    root.render(<CardWidgetUI json={this.json} onSave={onSave} />);
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
