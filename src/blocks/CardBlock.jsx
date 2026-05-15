import React, { useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import TechniqueCard from '@/components/TechniqueCard';
import CardEditorPage from '@/components/CardEditorPage';
import { Pencil } from 'lucide-react';

const DEFAULTS = {
  title: 'New Technique',
  subtitle: '',
  tags: [],
  accentColor: 'cyan',
  // null = inherit the page's --app-font setting (TechniqueCard treats null
  // the same as a missing font: it falls through to default styling).
  font: null,
  overview: '',
  steps: [],
  commands: [],
  subsections: [],
  subCards: [],
};

function CardBlockInner({ block, editor }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);

  let card = { ...DEFAULTS };
  try {
    if (block.props.data) card = { ...DEFAULTS, ...JSON.parse(block.props.data) };
  } catch {}

  // Persist edits silently — auto-save shouldn't close the editor. The
  // editor only closes when the user explicitly hits Done/Back/Escape
  // (which calls onCancel from CardEditorPage).
  const handleSave = (saved) => {
    editor.updateBlock(block, { type: 'card', props: { data: JSON.stringify(saved) } });
  };

  return (
    <div
      className="group relative my-1 w-full"
      contentEditable={false}
      data-skip-editor-context-menu
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Block the browser's native HTML5 text-drag from kicking in inside
      // the card. Without this, dragging from text content starts a
      // text-copy drag and the drop pastes a duplicate of the card content.
      // BlockNote's own drag handle (in the left-side overlay) is a
      // separate element — block-reordering still works from there.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      // Stop mousedown/mouseup from bubbling up to BlockNote/ProseMirror.
      // ProseMirror auto-creates a NodeSelection on mousedown inside any
      // `contentEditable=false` block, which prevents the browser from
      // building a normal text-range selection — that's why you couldn't
      // highlight text inside a card. Stopping propagation here lets the
      // browser handle the click natively, so dragging selects text and
      // single clicks still reach our own onClick handlers (the Edit
      // button + the card's expand/collapse toggle) because they're
      // descendants, not ancestors, of this element.
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      // Text selection is always enabled so users can highlight and copy
      // anything inside the card (title, overview, steps, code).
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      {hovered && (
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
      <TechniqueCard {...card} />
      {editing && (
        <div onClick={(e) => e.stopPropagation()}>
          <CardEditorPage card={card} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

export const CardBlock = createReactBlockSpec(
  {
    type: 'card',
    propSchema: { data: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => <CardBlockInner block={block} editor={editor} />,
  }
);
