import React, { useState, useEffect } from 'react';
import { ExternalLink, Plus, X, Pencil, Check, Search } from 'lucide-react';
import { persistGet, persistSet } from '../../lib/persistentStorage';
import {
  titleColorOptions,
  titleFontOptions,
  getTitleColorClass,
  getTitleFontClass,
} from '../../lib/pageStyleOptions';

const colorOptions = titleColorOptions;

const colorPreview = Object.fromEntries(colorOptions.map((option) => [option.value, option.bg]));

export default function ResourcePage({ pageKey }) {
  const defaultMeta = { titleLeft: 'My', titleRight: 'Resources', titleLeftColor: 'cyan', titleFont: 'font-mono', description: '', descriptionFont: 'font-mono' };

  const localLoad = (key, fb) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fb; } catch { return fb; } };

  const [meta, setMetaRaw] = useState(() => localLoad(`library_meta_${pageKey}`, defaultMeta));
  const [categories, setCategoriesRaw] = useState(() => localLoad(`library_resource_${pageKey}`, []));
  const [editingMeta, setEditingMeta] = useState(false);
  const [draftMeta, setDraftMeta] = useState(meta);
  const [search, setSearch] = useState('');

  // Section add modal
  const [modalStep, setModalStep] = useState(null);
  const [columnName, setColumnName] = useState('');
  const [selectedColor, setSelectedColor] = useState('cyan');

  // Resource add modal
  const [addResourceModal, setAddResourceModal] = useState(null); // catIndex or null
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    persistGet(`library_meta_${pageKey}`).then(val => { if (val) { setMetaRaw(val); setDraftMeta(val); } });
    persistGet(`library_resource_${pageKey}`).then(val => { if (val) setCategoriesRaw(val); });
  }, [pageKey]);

  const updateMeta = (m) => { setMetaRaw(m); persistSet(`library_meta_${pageKey}`, m); };
  const updateCategories = (c) => { setCategoriesRaw(c); persistSet(`library_resource_${pageKey}`, c); };

  const handleSaveMeta = () => { updateMeta(draftMeta); setEditingMeta(false); };

  const handleAddSectionStart = () => { setColumnName(''); setModalStep('name'); };
  const handleNameSubmit = () => { if (columnName.trim()) setModalStep('color'); };
  const handleColorSubmit = () => {
    updateCategories([...categories, { name: columnName.trim(), color: selectedColor, links: [] }]);
    setModalStep(null); setSelectedColor('cyan'); setColumnName('');
  };
  const handleDeleteCategory = (i) => updateCategories(categories.filter((_, idx) => idx !== i));

  const openAddResource = (catIndex) => {
    setNewLinkName(''); setNewLinkDesc(''); setNewLinkUrl('');
    setAddResourceModal(catIndex);
  };
  const closeAddResource = () => { setAddResourceModal(null); setNewLinkName(''); setNewLinkDesc(''); setNewLinkUrl(''); };

  const handleAddResource = () => {
    if (!newLinkName.trim()) return;
    const newLink = { name: newLinkName, desc: newLinkDesc, url: newLinkUrl };
    updateCategories(categories.map((cat, idx) => idx !== addResourceModal ? cat : { ...cat, links: [...cat.links, newLink] }));
    closeAddResource();
  };

  const handleDeleteLink = (catIndex, link) => {
    updateCategories(categories.map((cat, idx) => idx !== catIndex ? cat : { ...cat, links: cat.links.filter(l => l !== link) }));
  };

  const titleLeft = meta.titleLeft ?? 'My';
  const titleRight = meta.titleRight ?? 'Resources';
  const titleLeftColor = meta.titleLeftColor ?? 'cyan';
  const leftColorClass = getTitleColorClass(titleLeftColor);
  const titleFontClass = getTitleFontClass(meta.titleFont);

  const filtered = search.trim()
    ? categories.map(cat => ({
        ...cat,
        links: cat.links.filter(l =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          (l.desc || '').toLowerCase().includes(search.toLowerCase()) ||
          (l.url || '').toLowerCase().includes(search.toLowerCase())
        )
      }))
    : categories;

  const totalLinks = categories.reduce((sum, cat) => sum + cat.links.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className={`text-3xl md:text-5xl font-bold tracking-tight mb-3 ${titleFontClass}`}>
          <span className="text-slate-200">{titleLeft}</span>
          {titleLeft && titleRight && ' '}
          <span className={leftColorClass}>{titleRight}</span>
        </h1>
        {meta.description ? (
          <p className={`text-slate-500 ${meta.descriptionFont || 'font-mono'} text-sm`}>{meta.description}</p>
        ) : totalLinks > 0 ? (
          <p className="text-slate-500 font-mono text-sm">
            {totalLinks} {totalLinks === 1 ? 'resource' : 'resources'} across {categories.length} {categories.length === 1 ? 'section' : 'sections'}
          </p>
        ) : null}
        {!editingMeta && (
          <button
            onClick={() => { setDraftMeta({ ...meta, titleLeft, titleRight, titleLeftColor }); setEditingMeta(true); }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all"
          >
            <Pencil className="w-3 h-3" /> Edit Header
          </button>
        )}
      </div>

      {/* Edit Header Form */}
      {editingMeta && (
        <div className="bg-[#1a1a1a] border border-slate-800 rounded-xl p-6 max-w-xl mx-auto text-left space-y-4 mb-10">
          <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">Edit Page Header</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">TITLE LEFT (white)</label>
              <input type="text" value={draftMeta.titleLeft ?? titleLeft} onChange={e => setDraftMeta({ ...draftMeta, titleLeft: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">TITLE RIGHT (colored)</label>
              <input type="text" value={draftMeta.titleRight ?? titleRight} onChange={e => setDraftMeta({ ...draftMeta, titleRight: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:outline-none focus:border-slate-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 mb-2">TITLE RIGHT COLOR</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(opt => (
                <button key={opt.value} onClick={() => setDraftMeta({ ...draftMeta, titleLeftColor: opt.value })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${(draftMeta.titleLeftColor ?? titleLeftColor) === opt.value ? 'border-slate-400 bg-slate-700 text-slate-100' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${opt.bg}`} />{opt.label}
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
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${(draftMeta.titleFont ?? meta.titleFont) === opt.value ? 'border-slate-400 bg-slate-700 text-slate-100' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'} ${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1">DESCRIPTION</label>
            <textarea value={draftMeta.description || ''} onChange={e => setDraftMeta({ ...draftMeta, description: e.target.value })}
              placeholder="Brief description..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-slate-500 h-20" />
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
          <div className="flex gap-2">
            <button onClick={() => setEditingMeta(false)} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-mono text-sm">Cancel</button>
            <button onClick={handleSaveMeta} className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-mono text-sm font-semibold flex items-center justify-center gap-1">
              <Check className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex justify-center mb-10">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources..."
            className="w-full bg-[#111827] border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
        </div>
      </div>

      {/* Section grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((cat, catIdx) => {
          const colorOpt = colorOptions.find(c => c.value === cat.color) || colorOptions[0];
          return (
            <div key={catIdx} className="group">
              {/* Section header */}
              <div className={`flex items-center justify-between pb-2 mb-4 border-b ${colorOpt.border}`}>
                <h2 className={`font-mono text-xs font-bold tracking-[0.08em] ${colorOpt.text}`}>
                  {cat.name}
                  {cat.links.length > 0 && (
                    <span className="ml-2 text-slate-600 font-normal">({cat.links.length})</span>
                  )}
                </h2>
                <button onClick={() => handleDeleteCategory(catIdx)} className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Links list */}
              <ul className="space-y-3">
                {cat.links.map((link, linkIdx) => (
                  <li key={linkIdx} className="flex items-start gap-2 group/item">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${colorPreview[cat.color] || 'bg-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {link.url && link.url !== '#' ? (
                          <a href={link.url} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-sm font-semibold text-slate-200 hover:text-white transition-colors truncate">
                            {link.name}
                          </a>
                        ) : (
                          <span className="font-mono text-sm font-semibold text-slate-200 truncate">{link.name}</span>
                        )}
                        {link.url && link.url !== '#' && (
                          <ExternalLink className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        )}
                        <button onClick={() => handleDeleteLink(catIdx, link)}
                          className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 flex-shrink-0 ml-auto">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {link.desc && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{link.desc}</p>}
                    </div>
                  </li>
                ))}

                <li>
                  <button onClick={() => openAddResource(catIdx)}
                    className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add resource
                  </button>
                </li>
              </ul>
            </div>
          );
        })}

        {/* Add Section card */}
        <div>
          <button onClick={handleAddSectionStart}
            className="w-full h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-800 rounded-lg hover:border-slate-600 hover:bg-slate-800/20 transition-all">
            <Plus className="w-5 h-5 text-slate-600" />
            <span className="text-xs font-mono text-slate-600">Add Section</span>
          </button>
        </div>
      </div>

      {/* Add Section modal */}
      {modalStep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-slate-800 rounded-lg p-6 max-w-sm w-full mx-4">
            {modalStep === 'name' && (
              <div className="space-y-4">
                <h3 className="text-lg font-mono font-bold text-slate-200">Section Name</h3>
                <input type="text" value={columnName} onChange={e => setColumnName(e.target.value)} placeholder="e.g., Reference Docs"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-slate-500"
                  autoFocus onKeyDown={e => e.key === 'Enter' && handleNameSubmit()} />
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
                    <button key={option.value} onClick={() => setSelectedColor(option.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all flex items-center gap-2 ${selectedColor === option.value ? `${colorPreview[option.value]} text-slate-900` : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                      <div className={`w-3 h-3 rounded-full ${colorPreview[option.value]}`} />{option.label}
                    </button>
                  ))}
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

      {/* Add Resource modal */}
      {addResourceModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-slate-800 rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-mono font-bold text-slate-200">Add Resource</h3>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">NAME *</label>
              <input type="text" value={newLinkName} onChange={e => setNewLinkName(e.target.value)}
                placeholder="Resource name"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-slate-500"
                autoFocus />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">DESCRIPTION</label>
              <input type="text" value={newLinkDesc} onChange={e => setNewLinkDesc(e.target.value)}
                placeholder="Brief description (optional)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-slate-500" />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1">LINK / URL</label>
              <input type="text" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
                placeholder="https://... (optional)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-slate-500"
                onKeyDown={e => { if (e.key === 'Enter') handleAddResource(); if (e.key === 'Escape') closeAddResource(); }} />
            </div>

            <div className="flex gap-2">
              <button onClick={closeAddResource} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors font-mono text-sm">Cancel</button>
              <button onClick={handleAddResource} className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-mono text-sm font-semibold flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
