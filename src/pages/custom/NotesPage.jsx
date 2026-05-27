import React, { useState, useEffect, useMemo } from 'react';
import MapNode from '../../components/MapNode';
import CardEditorPage from '../../components/CardEditorPage';
import DraggableCardList from '../../components/DraggableCardList';
import MarkdownView from '../../components/MarkdownView';
import MarkdownEditor from '../../components/MarkdownEditor';
import { usePageStorage } from '../../hooks/usePageStorage';
import { useDragScroll } from '../../hooks/useDragScroll';
import { persistGet, persistSet } from '../../lib/persistentStorage';
import { Plus, X, Pencil, Check, Layers } from 'lucide-react';
import {
  titleColorOptions,
  titleFontOptions,
  getTitleColorClass,
  getTitleFontClass,
} from '../../lib/pageStyleOptions';

const colorOptions = titleColorOptions;

const headerColorMap = Object.fromEntries(
  titleColorOptions.map(opt => [opt.value, `${opt.text} ${opt.border}`])
);

const colorPreview = Object.fromEntries(
  titleColorOptions.map(opt => [opt.value, opt.bg])
);

export default function NotesPage({ pageKey }) {
  const defaultMeta = { title: 'My Notes', titleColor: 'cyan', titleFont: 'font-mono', titleSize: 'h2', description: '', descriptionFont: 'font-mono', tags: [], showLineCounts: true };

  const loadMeta = (key) => {
    try { const s = localStorage.getItem(`library_meta_${key}`); return s ? JSON.parse(s) : defaultMeta; } catch { return defaultMeta; }
  };

  const [meta, setMetaRaw] = useState(() => loadMeta(pageKey));
  const [editingMeta, setEditingMeta] = useState(false);
  const [draftMeta, setDraftMeta] = useState(meta);
  const [draftTagsRaw, setDraftTagsRaw] = useState('');

  useEffect(() => {
    const localMeta = loadMeta(pageKey);
    setMetaRaw(localMeta);
    setDraftMeta(localMeta);
    setEditingMeta(false);
    persistGet(`library_meta_${pageKey}`).then(val => { if (val) { setMetaRaw(val); setDraftMeta(val); } });
  }, [pageKey]);

  const updateMeta = (newMeta) => { setMetaRaw(newMeta); persistSet(`library_meta_${pageKey}`, newMeta); };

  const handleSaveMeta = () => {
    const parsedTags = draftTagsRaw.split(',').map(t => t.trim()).filter(t => t);
    updateMeta({ ...draftMeta, tags: parsedTags });
    setEditingMeta(false);
  };

  const { columns, setColumns, allCards, addCustomCard, updateCard, deleteCard, reorderCards } =
    usePageStorage(pageKey, [], []);

  const [modalStep, setModalStep] = useState(null);
  const [columnName, setColumnName] = useState('');
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [selectedColumnFont, setSelectedColumnFont] = useState('font-mono');
  const [addingTopicCol, setAddingTopicCol] = useState(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicTags, setTopicTags] = useState('');
  const [topicTechniques, setTopicTechniques] = useState('');
  const [selectedTopicFont, setSelectedTopicFont] = useState('font-mono');
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [subCardParent, setSubCardParent] = useState(null);
  const [editingSubCard, setEditingSubCard] = useState(null);
  const mapDragScroll = useDragScroll();
  const [groupByType, setGroupByType] = useState(false);
  const [showMapDescriptions, setShowMapDescriptions] = useState(false);
  const [addingChildKey, setAddingChildKey] = useState(null);
  const [childDraft, setChildDraft] = useState({ title: '', tags: '', techniques: '' });
  const [editingColIndex, setEditingColIndex] = useState(null);
  const [editingColDraft, setEditingColDraft] = useState(null);
  const [editingNodeKey, setEditingNodeKey] = useState(null);
  const [editingNodeDraft, setEditingNodeDraft] = useState(null);

  const subTechRegex = /^[A-Z]\d+\.\d+\s/;
  const displayColumns = useMemo(() => {
    if (!groupByType) return columns;
    const bases = [];
    const subs = [];
    for (const col of columns) {
      for (const node of col.nodes) {
        if (subTechRegex.test(node.title)) {
          subs.push({ ...node, accentColor: col.color, children: [] });
        } else {
          bases.push({ ...node, accentColor: col.color, children: [] });
          for (const child of (node.children || [])) {
            subs.push({ ...child, accentColor: col.color });
          }
        }
      }
    }
    const firstColor = columns[0]?.color || 'cyan';
    const lastColor = columns[columns.length - 1]?.color || 'cyan';
    const font = columns[0]?.font || 'font-mono';
    const result = [];
    if (bases.length) result.push({ header: 'Techniques', color: firstColor, font, nodes: bases });
    if (subs.length) result.push({ header: 'Sub-techniques', color: lastColor, font, nodes: subs });
    return result;
  }, [columns, groupByType]);

  const resetTopicForm = () => {
    setAddingTopicCol(null);
    setTopicTitle('');
    setTopicTags('');
    setTopicTechniques('');
    setSelectedTopicFont('font-mono');
  };

  const handleCardSubmit = (card) => {
    if (subCardParent) {
      const current = allCards.find(c => c.id === subCardParent.id) || subCardParent;
      if (editingSubCard) {
        updateCard({ ...current, subCards: (current.subCards || []).map(s => s.id === card.id ? card : s) });
      } else {
        updateCard({ ...current, subCards: [...(current.subCards || []), card] });
      }
      setSubCardParent(null); setEditingSubCard(null);
    } else if (editingCard) {
      updateCard(card); setEditingCard(null);
    } else {
      addCustomCard(card);
    }
  };

  const handleDeleteSubCard = (parentCard, subCardId) => {
    const current = allCards.find(c => c.id === parentCard.id) || parentCard;
    updateCard({ ...current, subCards: (current.subCards || []).filter(s => s.id !== subCardId) });
  };

  const handleReorderSubCard = (parentCard, fromIdx, toIdx) => {
    const current = allCards.find(c => c.id === parentCard.id) || parentCard;
    const subs = [...(current.subCards || [])];
    const [moved] = subs.splice(fromIdx, 1);
    subs.splice(toIdx, 0, moved);
    updateCard({ ...current, subCards: subs });
  };

  const closeEditor = () => {
    setCardModalOpen(false);
    setEditingCard(null);
    setSubCardParent(null);
    setEditingSubCard(null);
  };

  const handleAddColumnStart = () => setModalStep('name');
  const handleNameSubmit = () => { if (columnName.trim()) setModalStep('color'); };
  const handleColorSubmit = () => {
    setColumns([...columns, { header: columnName.trim(), color: selectedColor, font: selectedColumnFont, nodes: [] }]);
    setModalStep(null); setSelectedColor('cyan'); setSelectedColumnFont('font-mono'); setColumnName('');
  };
  const handleDeleteColumn = (i) => setColumns(columns.filter((_, idx) => idx !== i));
  const handleAddTopic = (colIndex) => {
    const title = topicTitle.trim();
    const tags = topicTags.split(',').map(t => t.trim()).filter(t => t);
    const techniques = topicTechniques.split('\n').map(t => t.trim()).filter(t => t);

    if (title) {
      const newNode = { title, subtitle: tags.length > 0 ? tags.join(' • ') : '', tags, techniques, font: selectedTopicFont, id: `topic-${Date.now()}` };
      setColumns(columns.map((col, idx) => idx !== colIndex ? col : { ...col, nodes: [...col.nodes, newNode] }));
      resetTopicForm();
    }
  };
  const handleDeleteTopic = (colIndex, nodeIndex) => {
    setColumns(columns.map((col, idx) => idx !== colIndex ? col : { ...col, nodes: col.nodes.filter((_, ni) => ni !== nodeIndex) }));
  };
  const handleDeleteChild = (colIndex, nodeIndex, childIndex) => {
    const updated = columns.map((col, ci) => {
      if (ci !== colIndex) return col;
      return { ...col, nodes: col.nodes.map((node, ni) => {
        if (ni !== nodeIndex) return node;
        return { ...node, children: (node.children || []).filter((_, ki) => ki !== childIndex) };
      })};
    });
    setColumns(updated);
  };

  const handleEditColumnStart = (i) => {
    setEditingColIndex(i);
    setEditingColDraft({ header: columns[i].header, color: columns[i].color, font: columns[i].font || 'font-mono' });
  };
  const handleEditColumnSave = () => {
    if (!editingColDraft?.header?.trim()) return;
    setColumns(columns.map((col, i) => i === editingColIndex ? { ...col, ...editingColDraft } : col));
    setEditingColIndex(null); setEditingColDraft(null);
  };
  const handleEditColumnCancel = () => { setEditingColIndex(null); setEditingColDraft(null); };

  const handleEditNodeStart = (colIndex, nodeIndex, childIndex) => {
    const col = columns[colIndex];
    const node = childIndex !== undefined ? (col.nodes[nodeIndex].children || [])[childIndex] : col.nodes[nodeIndex];
    const key = childIndex !== undefined ? `${colIndex}-${nodeIndex}-c${childIndex}` : `${colIndex}-${nodeIndex}`;
    setEditingNodeKey(key);
    setEditingNodeDraft({
      title: node.title || '',
      tags: (node.tags || []).join(', '),
      techniques: (node.techniques || []).join('\n'),
    });
  };
  const handleEditNodeSave = (colIndex, nodeIndex, childIndex) => {
    if (!editingNodeDraft?.title?.trim()) return;
    const title = editingNodeDraft.title.trim();
    const tags = editingNodeDraft.tags.split(',').map(t => t.trim()).filter(Boolean);
    const techniques = editingNodeDraft.techniques.split('\n').map(t => t.trim()).filter(Boolean);
    setColumns(columns.map((col, ci) => {
      if (ci !== colIndex) return col;
      return { ...col, nodes: col.nodes.map((node, ni) => {
        if (ni !== nodeIndex) return node;
        if (childIndex === undefined) return { ...node, title, tags, techniques };
        return { ...node, children: (node.children || []).map((child, ki) =>
          ki !== childIndex ? child : { ...child, title, tags, techniques }
        )};
      })};
    }));
    setEditingNodeKey(null); setEditingNodeDraft(null);
  };
  const handleEditNodeCancel = () => { setEditingNodeKey(null); setEditingNodeDraft(null); };

  const handleAddChildStart = (colIndex, nodeIndex) => {
    setAddingChildKey(`${colIndex}-${nodeIndex}`);
    setChildDraft({ title: '', tags: '', techniques: '' });
  };
  const handleAddChildSave = (colIndex, nodeIndex) => {
    const title = childDraft.title.trim();
    if (!title) return;
    const tags = childDraft.tags.split(',').map(t => t.trim()).filter(Boolean);
    const techniques = childDraft.techniques.split('\n').map(t => t.trim()).filter(Boolean);
    const newChild = { title, tags, techniques, subtitle: tags.join(' • '), font: columns[colIndex]?.font || 'font-mono', id: `child-${Date.now()}` };
    setColumns(columns.map((col, ci) => ci !== colIndex ? col : {
      ...col, nodes: col.nodes.map((node, ni) => ni !== nodeIndex ? node : {
        ...node, children: [...(node.children || []), newChild]
      })
    }));
    setAddingChildKey(null); setChildDraft({ title: '', tags: '', techniques: '' });
  };
  const handleAddChildCancel = () => { setAddingChildKey(null); setChildDraft({ title: '', tags: '', techniques: '' }); };

  const scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const getTopicSubtitle = (node) => {
    if (node.tags?.length > 0) return node.tags.join(' • ');
    return node.subtitle === 'Custom topic' ? '' : node.subtitle;
  };

  const titleColorClass = getTitleColorClass(meta.titleColor);
  const titleFontClass = getTitleFontClass(meta.titleFont);
  const titleSizeClass = meta.titleSize === 'h1' ? 'text-5xl' : meta.titleSize === 'h3' ? 'text-xl' : 'text-3xl';

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="mb-8 text-center">
        {!editingMeta ? (
          <div className="group relative">
            <h1 className={`font-semibold tracking-tight ${titleSizeClass} ${titleFontClass} ${titleColorClass}`}>{meta.title}</h1>
            {meta.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {meta.tags.map((tag, i) => (
                  <span key={i} className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {meta.description && (
              <div className={`text-slate-500 ${meta.descriptionFont || 'font-mono'} text-sm mt-3`}>
                <MarkdownView>{meta.description}</MarkdownView>
              </div>
            )}
            <button
              onClick={() => { setDraftMeta(meta); setDraftTagsRaw(meta.tags.join(', ')); setEditingMeta(true); }}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all"
            >
              <Pencil className="w-3 h-3" /> Edit Header
            </button>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-slate-800 rounded-xl p-6 max-w-xl mx-auto text-left space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">Edit Page Header</h3>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">TITLE</label>
              <input
                type="text"
                value={draftMeta.title}
                onChange={e => setDraftMeta({ ...draftMeta, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2">TITLE COLOR</label>
              <div className="flex flex-wrap gap-2">
                {titleColorOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraftMeta({ ...draftMeta, titleColor: opt.value })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      draftMeta.titleColor === opt.value
                        ? 'border-slate-400 bg-slate-700 text-slate-100'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${opt.bg}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2">TITLE FONT</label>
              <div className="flex flex-wrap gap-2">
                {titleFontOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraftMeta({ ...draftMeta, titleFont: opt.value })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${draftMeta.titleFont === opt.value ? 'border-slate-400 bg-slate-700 text-slate-100' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'} ${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2">TITLE SIZE</label>
              <div className="flex gap-2">
                {[{ value: 'h1', label: 'H1', cls: 'text-lg' }, { value: 'h2', label: 'H2', cls: 'text-base' }, { value: 'h3', label: 'H3', cls: 'text-sm' }].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraftMeta({ ...draftMeta, titleSize: opt.value })}
                    className={`flex-1 py-2 rounded-lg font-mono font-bold transition-all border ${opt.cls} ${(draftMeta.titleSize || 'h2') === opt.value ? 'border-slate-400 bg-slate-700 text-slate-100' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">TAGS (comma-separated)</label>
              <input
                type="text"
                value={draftTagsRaw}
                onChange={e => setDraftTagsRaw(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">DESCRIPTION</label>
              <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus-within:border-slate-500 min-h-[5rem]">
                <MarkdownEditor
                  value={draftMeta.description}
                  onChange={(v) => setDraftMeta({ ...draftMeta, description: v })}
                  placeholder="Brief description — markdown formats live as you type"
                  minHeight={64}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2">DESCRIPTION FONT</label>
              <div className="flex flex-wrap gap-2">
                {titleFontOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraftMeta({ ...draftMeta, descriptionFont: opt.value })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${(draftMeta.descriptionFont || 'font-mono') === opt.value ? 'border-slate-400 bg-slate-700 text-slate-100' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'} ${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draftMeta.showLineCounts !== false}
                onChange={e => setDraftMeta({ ...draftMeta, showLineCounts: e.target.checked })}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-xs font-mono text-slate-300">Show line counts on map nodes</span>
            </label>

            <div className="flex gap-2">
              <button onClick={() => setEditingMeta(false)} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-mono text-sm">Cancel</button>
              <button onClick={handleSaveMeta} className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-mono text-sm font-semibold flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      {columns.length > 0 && (
        <div className="flex justify-end gap-2 mb-2">
          <button
            onClick={() => setShowMapDescriptions(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-title-oswald transition-all border ${showMapDescriptions ? 'border-cyan-600 bg-cyan-900/30 text-cyan-400' : 'border-[#2a2a2a] bg-[#1a1a1a] text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}
          >
            {showMapDescriptions ? 'Hide descriptions' : 'Show descriptions'}
          </button>
          <button
            onClick={() => setGroupByType(v => !v)}
            title="Toggle between stored columns and a grouped view (Techniques / Sub-techniques)"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-title-oswald transition-all border ${groupByType ? 'border-cyan-600 bg-cyan-900/30 text-cyan-400' : 'border-[#2a2a2a] bg-[#1a1a1a] text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}
          >
            <Layers className="w-3 h-3" />
            {groupByType ? 'Grouped view' : 'Group by type'}
          </button>
        </div>
      )}
      <div
        {...mapDragScroll}
        className="map-drag-scroll overflow-x-auto pb-4 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="inline-flex gap-4 min-w-max">
          {displayColumns.map((col, i) => {
            const color = col.color || 'cyan';
            const isEditingCol = editingColIndex === i && !groupByType;
            return (
              <div key={i} className="flex flex-col gap-2 min-w-[210px] max-w-[260px] relative">
                <div className={`py-2 border-b mb-2 border-[#2a2a2a] ${headerColorMap[color]} px-2`}>
                  {isEditingCol ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        autoFocus
                        value={editingColDraft.header}
                        onChange={e => setEditingColDraft(d => ({ ...d, header: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleEditColumnSave(); if (e.key === 'Escape') handleEditColumnCancel(); }}
                        className="w-full px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400"
                      />
                      <div className="flex flex-wrap gap-1">
                        {colorOptions.map(opt => (
                          <button key={opt.value} onClick={() => setEditingColDraft(d => ({ ...d, color: opt.value }))}
                            className={`w-4 h-4 rounded-full ${colorPreview[opt.value]} transition-all ${editingColDraft.color === opt.value ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : 'opacity-60 hover:opacity-100'}`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={handleEditColumnSave} className="flex-1 px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-mono rounded transition-colors">Save</button>
                        <button onClick={handleEditColumnCancel} className="flex-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-mono rounded transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group/colhdr">
                      <span className={`flex-1 text-sm font-semibold tracking-wide ${col.font || 'font-mono'}`}>{col.header}</span>
                      {!groupByType && (
                        <div className="flex gap-0.5 opacity-0 group-hover/colhdr:opacity-100 transition-opacity">
                          <button onClick={() => handleEditColumnStart(i)} className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => handleDeleteColumn(i)} className="text-slate-500 hover:text-red-400 transition-colors p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 border border-[#2a2a2a] rounded-md p-2 bg-[#1a1a1a]">
                  {col.nodes.map((node, j) => {
                    const nodeKey = `${i}-${j}`;
                    const isEditingNode = editingNodeKey === nodeKey && !groupByType;
                    return (
                      <div key={j} className="flex flex-col gap-1 group/tech">
                        {isEditingNode ? (
                          <div className="flex flex-col gap-1 p-2 bg-[#272727] rounded border border-slate-700">
                            <input autoFocus value={editingNodeDraft.title} onChange={e => setEditingNodeDraft(d => ({ ...d, title: e.target.value }))} placeholder="Title" onKeyDown={e => e.key === 'Escape' && handleEditNodeCancel()} className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400" />
                            <input value={editingNodeDraft.tags} onChange={e => setEditingNodeDraft(d => ({ ...d, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400" />
                            <textarea value={editingNodeDraft.techniques} onChange={e => setEditingNodeDraft(d => ({ ...d, techniques: e.target.value }))} placeholder="Info lines (one per line)" rows={2} className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400 resize-none" />
                            <div className="flex gap-1">
                              <button onClick={() => handleEditNodeSave(i, j)} className="flex-1 px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-mono rounded transition-colors">Save</button>
                              <button onClick={handleEditNodeCancel} className="flex-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-mono rounded transition-colors">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1 group/node">
                            <div className="flex-1 min-w-0">
                              <MapNode title={node.title} subtitle={showMapDescriptions ? getTopicSubtitle(node) : undefined} techniques={showMapDescriptions ? (node.techniques || []) : []} accentColor={color} titleFont={node.font || 'font-mono'} onClick={() => scrollTo(node.id)} showCount={showMapDescriptions && meta.showLineCounts !== false} small />
                            </div>
                            {!groupByType && (
                              <div className="flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleAddChildStart(i, j)} title="Add sub-technique" className="text-slate-600 hover:text-cyan-400 transition-colors p-0.5"><Plus className="w-3 h-3" /></button>
                                <button onClick={() => handleEditNodeStart(i, j)} className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"><Pencil className="w-3 h-3" /></button>
                                <button onClick={() => handleDeleteTopic(i, j)} className="text-slate-600 hover:text-red-400 transition-colors p-0.5"><X className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Sub-technique children — visible on parent hover or when adding */}
                        {((node.children || []).length > 0 || addingChildKey === nodeKey) && (
                          <div className={`${addingChildKey === nodeKey ? 'flex' : 'hidden group-hover/tech:flex'} flex-col gap-1 ml-3 pl-2.5 border-l-2 border-[#2a2a2a]`}>
                            {(node.children || []).map((child, k) => {
                              const childKey = `${i}-${j}-c${k}`;
                              const isEditingChild = editingNodeKey === childKey && !groupByType;
                              return (
                                <div key={k}>
                                  {isEditingChild ? (
                                    <div className="flex flex-col gap-1 p-2 bg-[#272727] rounded border border-slate-700">
                                      <input autoFocus value={editingNodeDraft.title} onChange={e => setEditingNodeDraft(d => ({ ...d, title: e.target.value }))} placeholder="Title" onKeyDown={e => e.key === 'Escape' && handleEditNodeCancel()} className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400" />
                                      <input value={editingNodeDraft.tags} onChange={e => setEditingNodeDraft(d => ({ ...d, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400" />
                                      <textarea value={editingNodeDraft.techniques} onChange={e => setEditingNodeDraft(d => ({ ...d, techniques: e.target.value }))} placeholder="Info lines (one per line)" rows={2} className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400 resize-none" />
                                      <div className="flex gap-1">
                                        <button onClick={() => handleEditNodeSave(i, j, k)} className="flex-1 px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-mono rounded transition-colors">Save</button>
                                        <button onClick={handleEditNodeCancel} className="flex-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-mono rounded transition-colors">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-1 group/child">
                                      <div className="flex-1 min-w-0">
                                        <MapNode title={child.title} subtitle={showMapDescriptions ? getTopicSubtitle(child) : undefined} techniques={showMapDescriptions ? (child.techniques || []) : []} accentColor={color} titleFont={child.font || 'font-mono'} onClick={() => scrollTo(child.id)} showCount={showMapDescriptions && meta.showLineCounts !== false} small />
                                      </div>
                                      {!groupByType && (
                                        <div className="flex gap-0.5 opacity-0 group-hover/child:opacity-100 transition-opacity flex-shrink-0">
                                          <button onClick={() => handleEditNodeStart(i, j, k)} className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"><Pencil className="w-3 h-3" /></button>
                                          <button onClick={() => handleDeleteChild(i, j, k)} className="text-slate-600 hover:text-red-400 transition-colors p-0.5"><X className="w-3 h-3" /></button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {/* Add sub-technique form */}
                            {addingChildKey === nodeKey && !groupByType && (
                              <div className="flex flex-col gap-1 p-2 bg-[#272727] rounded border border-slate-700 mt-1">
                                <input autoFocus value={childDraft.title} onChange={e => setChildDraft(d => ({ ...d, title: e.target.value }))} placeholder="Sub-technique name" onKeyDown={e => e.key === 'Escape' && handleAddChildCancel()} className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400" />
                                <input value={childDraft.tags} onChange={e => setChildDraft(d => ({ ...d, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="px-2 py-1 bg-[#1a1a1a] border border-slate-600 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-400" />
                                <div className="flex gap-1">
                                  <button onClick={() => handleAddChildSave(i, j)} className="flex-1 px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-mono rounded transition-colors">Add</button>
                                  <button onClick={handleAddChildCancel} className="flex-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-mono rounded transition-colors">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {addingTopicCol === i ? (
                    <div className="flex flex-col gap-1">
                      <input type="text" value={topicTitle} onChange={e => setTopicTitle(e.target.value)} placeholder="Topic name" className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-slate-500" autoFocus onKeyDown={e => { if (e.key === 'Escape') resetTopicForm(); }} />
                      <input type="text" value={topicTags} onChange={e => setTopicTags(e.target.value)} placeholder="Tags (comma-separated)" className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-slate-500" onKeyDown={e => { if (e.key === 'Escape') resetTopicForm(); }} />
                      <textarea
                        value={topicTechniques}
                        onChange={e => setTopicTechniques(e.target.value)}
                        placeholder="Techniques (one per line)"
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 font-mono text-[11px] focus:outline-none focus:border-slate-500 h-24 resize-none"
                        onKeyDown={e => { if (e.key === 'Escape') resetTopicForm(); }}
                      />
                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 mb-1">TOPIC FONT</label>
                        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                          {titleFontOptions.map(option => (
                            <button
                              key={option.value}
                              onClick={() => setSelectedTopicFont(option.value)}
                              className={`px-2 py-1 rounded-md text-[10px] transition-all border ${selectedTopicFont === option.value ? 'border-slate-300 bg-slate-700/90 text-slate-100' : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500'} ${option.value}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleAddTopic(i)} className="flex-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-mono rounded transition-colors">Add</button>
                        <button onClick={resetTopicForm} className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-mono rounded transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTopicCol(i)} className="px-2 py-1 text-xs font-mono text-slate-500 hover:text-slate-300 border border-dashed border-slate-700 rounded hover:border-slate-500 transition-colors">+ Add Topic</button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-2 min-w-[180px] max-w-[200px]">
            <button onClick={handleAddColumnStart} className="h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-lg p-4 hover:border-slate-500 hover:bg-slate-800/20 transition-all">
              <Plus className="w-6 h-6 text-slate-500" /><span className="text-xs font-title-oswald text-slate-500 text-center">Add Column</span>
            </button>
          </div>
        </div>
      </div>

      {/* Column modal */}
      {modalStep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-slate-800 rounded-lg p-6 max-w-sm w-full mx-4">
            {modalStep === 'name' && (
              <div className="space-y-4">
                <h3 className="text-lg font-mono font-bold text-slate-200">Column Name</h3>
                <input type="text" value={columnName} onChange={e => setColumnName(e.target.value)} placeholder="e.g., Custom Category" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-slate-500" autoFocus onKeyDown={e => e.key === 'Enter' && handleNameSubmit()} />
                <div className="flex gap-2">
                  <button onClick={() => setModalStep(null)} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-mono text-sm">Cancel</button>
                  <button onClick={handleNameSubmit} className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-mono text-sm font-semibold">Next</button>
                </div>
              </div>
            )}
            {modalStep === 'color' && (
              <div className="space-y-4">
                <h3 className="text-lg font-mono font-bold text-slate-200">Choose Color</h3>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {colorOptions.map(option => (
                    <button key={option.value} onClick={() => setSelectedColor(option.value)} className={`px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all flex items-center gap-2 ${selectedColor === option.value ? `${colorPreview[option.value]} text-slate-900` : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                      <div className={`w-3 h-3 rounded-full ${colorPreview[option.value]}`} />{option.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-500 mb-2">COLUMN FONT</label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                    {titleFontOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedColumnFont(option.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${selectedColumnFont === option.value ? 'border-slate-300 bg-slate-700/90 text-slate-100' : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500'} ${option.value}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalStep('name')} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-mono text-sm">Back</button>
                  <button onClick={handleColorSubmit} className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-mono text-sm font-semibold">Create</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technique Cards */}
      <div className="flex items-center justify-between pt-4">
        <button onClick={() => setCardModalOpen(true)} className="px-3 py-1.5 border border-[#3a3a3a] hover:border-slate-500 bg-[#202020] hover:bg-[#272727] text-slate-300 text-xs font-title-oswald rounded-md transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Technique
        </button>
      </div>
      {(cardModalOpen || !!editingCard) && (
        <CardEditorPage
          card={editingCard || editingSubCard}
          onSave={(card) => { handleCardSubmit(card); closeEditor(); }}
          onCancel={closeEditor}
        />
      )}
      {allCards.length > 0 && (
        <div className="border-t border-slate-800/50 pt-10">
          <DraggableCardList
            cards={allCards}
            onDelete={deleteCard}
            onReorder={reorderCards}
            onEdit={(card) => setEditingCard(card)}
            onAddSubCard={(parentCard) => { setSubCardParent(parentCard); setEditingSubCard(null); setCardModalOpen(true); }}
            onEditSubCard={(parentCard, subCard) => { setSubCardParent(parentCard); setEditingSubCard(subCard); setCardModalOpen(true); }}
            onDeleteSubCard={handleDeleteSubCard}
            onReorderSubCard={handleReorderSubCard}
          />
        </div>
      )}
    </div>
  );
}
