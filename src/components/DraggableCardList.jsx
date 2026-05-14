// @ts-nocheck — uses shadcn ContextMenu primitive (vendor-typed)
import React, { memo, useRef, useState } from 'react';
import { GripVertical, X, Pencil, Plus } from 'lucide-react';
import TechniqueCard from './TechniqueCard';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

function DraggableCardList({
  cards,
  onDelete,
  onReorder,
  onEdit,
  onAddSubCard,
  onEditSubCard,
  onDeleteSubCard,
  onReorderSubCard,
}) {
  // ── parent drag state ──
  const dragIndex = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  // ── sub-card drag state ──
  const subDragRef = useRef({ parentId: null, subIdx: null });
  const [subDragOver, setSubDragOver] = useState(null); // { parentId, subIdx }

  const [expandedCards, setExpandedCards] = useState(new Set());

  const setCardExpanded = (cardId, isExpanded) =>
    setExpandedCards(prev => {
      const next = new Set(prev);
      isExpanded ? next.add(cardId) : next.delete(cardId);
      return next;
    });

  // ── parent handlers ──
  const handleDragStart = (e, i) => { dragIndex.current = i; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver  = (e, i) => { e.preventDefault(); setDragOver(i); };
  const handleDrop = (e, i) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== i) onReorder(dragIndex.current, i);
    dragIndex.current = null; setDragOver(null);
  };
  const handleDragEnd = () => { dragIndex.current = null; setDragOver(null); };

  // ── sub-card handlers ──
  const handleSubDragStart = (e, parentId, subIdx) => {
    e.stopPropagation();
    subDragRef.current = { parentId, subIdx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleSubDragOver = (e, parentId, subIdx) => {
    e.preventDefault();
    e.stopPropagation();
    setSubDragOver({ parentId, subIdx });
  };
  const handleSubDrop = (e, parentCard, toIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const { parentId, subIdx: fromIdx } = subDragRef.current;
    if (parentId === parentCard.id && fromIdx !== null && fromIdx !== toIdx && onReorderSubCard) {
      onReorderSubCard(parentCard, fromIdx, toIdx);
    }
    subDragRef.current = { parentId: null, subIdx: null };
    setSubDragOver(null);
  };
  const handleSubDragEnd = () => {
    subDragRef.current = { parentId: null, subIdx: null };
    setSubDragOver(null);
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {cards.map((card, i) => {
        const isExpanded = expandedCards.has(card.id);
        const subCards = card.subCards || [];

        return (
          <div key={card.id} className="flex flex-col">
            {/* Parent technique card with right-click context menu */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  draggable={!isExpanded}
                  onDragStart={(e) => { if (isExpanded) { e.preventDefault(); return; } handleDragStart(e, i); }}
                  onDragOver={(e) => { if (isExpanded) return; handleDragOver(e, i); }}
                  onDrop={(e) => { if (isExpanded) return; handleDrop(e, i); }}
                  onDragEnd={handleDragEnd}
                  className={`relative group transition-all ${dragOver === i ? 'opacity-50 scale-[0.99]' : ''}`}
                  id={card.id}
                >
                  <div className="absolute top-3 right-3 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div
                      className={`${isExpanded ? 'cursor-default opacity-40' : 'cursor-grab'} p-1`}
                      title={isExpanded ? 'Collapse to reorder' : 'Drag to reorder'}
                    >
                      <GripVertical className="w-4 h-4 text-slate-600" />
                    </div>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(card)}
                        className="text-slate-600 hover:text-cyan-400 transition-colors p-1"
                        title="Edit card"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(card.id)}
                      className="text-slate-700 hover:text-red-400 transition-colors p-1"
                      title="Delete card"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="pr-8">
                    <TechniqueCard
                      title={card.title}
                      subtitle={card.subtitle}
                      tags={card.tags}
                      accentColor={card.accentColor}
                      font={card.font}
                      overview={card.overview}
                      steps={card.steps}
                      commands={card.commands}
                      subsections={card.subsections}
                      onExpandedChange={(next) => setCardExpanded(card.id, next)}
                    />
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52 bg-[#202020] border-[#3a3a3a] text-slate-200">
                {onAddSubCard && (
                  <ContextMenuItem
                    className="gap-2 cursor-pointer focus:bg-[#2a2a2a] focus:text-slate-100"
                    onClick={() => onAddSubCard(card)}
                  >
                    <Plus className="w-4 h-4" />
                    Add Sub-technique
                  </ContextMenuItem>
                )}
                {onAddSubCard && (onEdit || onDelete) && (
                  <ContextMenuSeparator className="bg-[#3a3a3a]" />
                )}
                {onEdit && (
                  <ContextMenuItem
                    className="gap-2 cursor-pointer focus:bg-[#2a2a2a] focus:text-slate-100"
                    onClick={() => onEdit(card)}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  className="gap-2 cursor-pointer text-red-400 focus:bg-[#2a2a2a] focus:text-red-400"
                  onClick={() => onDelete(card.id)}
                >
                  <X className="w-4 h-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {/* Sub-technique cards — indented, drag-and-drop within parent */}
            {subCards.length > 0 && (
              <div className="ml-5 mt-1.5 pl-4 border-l-2 border-[#2a2a2a] flex flex-col gap-2">
                {subCards.map((sub, k) => {
                  const isSubDragOver =
                    subDragOver?.parentId === card.id && subDragOver?.subIdx === k;
                  return (
                    <div
                      key={sub.id || k}
                      id={sub.id}
                      draggable
                      onDragStart={(e) => handleSubDragStart(e, card.id, k)}
                      onDragOver={(e) => handleSubDragOver(e, card.id, k)}
                      onDrop={(e) => handleSubDrop(e, card, k)}
                      onDragEnd={handleSubDragEnd}
                      className={`relative group/sub transition-all ${isSubDragOver ? 'opacity-50 scale-[0.99]' : ''}`}
                    >
                      <div className="absolute top-3 right-3 flex flex-col items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity z-10">
                        <div className="cursor-grab p-1" title="Drag to reorder">
                          <GripVertical className="w-4 h-4 text-slate-600" />
                        </div>
                        {onEditSubCard && (
                          <button
                            onClick={() => onEditSubCard(card, sub)}
                            className="text-slate-600 hover:text-cyan-400 transition-colors p-1"
                            title="Edit sub-technique"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteSubCard && (
                          <button
                            onClick={() => onDeleteSubCard(card, sub.id)}
                            className="text-slate-700 hover:text-red-400 transition-colors p-1"
                            title="Delete sub-technique"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="pr-8">
                        <TechniqueCard
                          title={sub.title}
                          subtitle={sub.subtitle}
                          tags={sub.tags}
                          accentColor={sub.accentColor || card.accentColor}
                          font={sub.font || card.font}
                          overview={sub.overview}
                          steps={sub.steps}
                          commands={sub.commands}
                          subsections={sub.subsections}
                          onExpandedChange={(next) => setCardExpanded(sub.id, next)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(DraggableCardList);
