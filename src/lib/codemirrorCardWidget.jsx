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

  const handleSave = (saved) => {
    setCardData(saved);
    onSave(saved);
    setEditing(false);
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

    const onSave = (savedCard) => {
      const newJson = JSON.stringify(savedCard);
      const newFence = '```card\n' + newJson + '\n```';
      view.dispatch({ changes: { from: this.blockFrom, to: this.blockTo, insert: newFence } });
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

  eq(other) {
    return other instanceof CardWidget && other.json === this.json;
  }

  // Let all events through so the card's buttons and expand/collapse work.
  ignoreEvent() { return false; }
}
