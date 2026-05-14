import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight, Plus, Trash2, MoreHorizontal,
  FileText, Home, PanelLeftClose,
  Download, Upload, Star, Settings, Search, Shield,
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { exportWorkspace, importWorkspace } from '@/lib/pageStore';
import { renderIcon } from '@/lib/iconRegistry';

// ─── FloatingMenu ─────────────────────────────────────────────────────────────
// A menu rendered in document.body via portal, positioned next to an anchor element.
// Escapes sidebar overflow clipping.

function FloatingMenu({ anchorRef, open, onClose, children, placement = 'below', width = 192 }) {
  const [pos, setPos] = useState(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top;
    if (placement === 'above') {
      top = rect.top - 4;
    } else {
      // Default: below — but flip to above if there isn't space.
      const estimatedHeight = 160;
      top = rect.bottom + 4;
      if (top + estimatedHeight > vh - 8 && rect.top - estimatedHeight > 8) {
        top = rect.top - estimatedHeight - 4;
      }
    }

    // Anchor on the right edge so the menu opens to the right of the trigger
    // and never overflows the viewport on the right.
    let left = rect.left;
    if (left + width > vw - 8) left = vw - width - 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [open, anchorRef, placement, width]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ top: pos.top, left: pos.left, width }}
      className="fixed z-[1000] overflow-hidden rounded-lg border border-[#373737] bg-[#252525] py-1 shadow-2xl"
    >
      {children}
    </div>,
    document.body
  );
}

// ─── PageRow ──────────────────────────────────────────────────────────────────

function PageRow({
  page, depth, index, getChildren,
  onCreateChild, onDelete, onRename, onToggleFavorite, currentId,
}) {
  const children = getChildren(page.id);
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(page.title);
  const inputRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const isActive = currentId === page.id;

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    if (!renaming) setRenameVal(page.title);
  }, [page.title, renaming]);

  const commitRename = () => {
    const trimmed = renameVal.trim() || 'Untitled';
    onRename(page.id, trimmed);
    setRenaming(false);
  };

  return (
    <Draggable draggableId={page.id} index={index}>
      {(drag, snap) => (
        <div ref={drag.innerRef} {...drag.draggableProps} className={snap.isDragging ? 'opacity-60' : ''}>
          <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
            <div
              {...drag.dragHandleProps}
              className={`group relative flex items-center gap-1 rounded-[5px] pr-1 transition-colors
                ${isActive
                  ? 'bg-white/[0.085] text-[#e8e8e8]'
                  : 'text-[#b4b4b4] hover:bg-white/[0.045]'
                }`}
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
            >
              {/* Collapse toggle */}
              <Collapsible.Trigger asChild>
                <button
                  className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-[#c4c4c4] ${
                    hasChildren ? 'visible' : 'invisible'
                  }`}
                  onClick={(e) => { e.stopPropagation(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                  />
                </button>
              </Collapsible.Trigger>

              {/* Icon */}
              <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center text-[14px] leading-none">
                {page.icon ? renderIcon(page.icon) : <FileText className="h-[14px] w-[14px] text-[#7a7a7a]" />}
              </span>

              {/* Title / rename */}
              {renaming ? (
                <input
                  ref={inputRef}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') { setRenameVal(page.title); setRenaming(false); }
                  }}
                  className="min-w-0 flex-1 bg-transparent py-[5px] text-[13.5px] text-[#e8e8e8] outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <Link
                  to={`/page/${page.id}`}
                  className="min-w-0 flex-1 truncate py-[5px] text-[13.5px] leading-none"
                  onDoubleClick={(e) => { e.preventDefault(); setRenaming(true); }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {page.title || 'Untitled'}
                </Link>
              )}

              {/* Action buttons */}
              <div className="invisible flex flex-shrink-0 items-center gap-0.5 group-hover:visible">
                <button
                  ref={menuTriggerRef}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-[#e8e8e8]"
                  title="More"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
                <FloatingMenu
                  anchorRef={menuTriggerRef}
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  width={192}
                >
                  <button
                    onClick={() => { setMenuOpen(false); setRenaming(true); setRenameVal(page.title); }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onToggleFavorite(page.id, !page.isFavorite); }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
                  >
                    <Star className={`h-3.5 w-3.5 ${page.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-[#7a7a7a]'}`} />
                    {page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  </button>
                  <div className="my-1 h-px bg-[#373737]" />
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(page.id); }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#e57373] transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </FloatingMenu>
                <button
                  title="Add sub-page"
                  onClick={(e) => { e.stopPropagation(); onCreateChild(page.id); setExpanded(true); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-[#e8e8e8]"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Children */}
            {hasChildren && (
              <Collapsible.Content>
                <PageLevel
                  pages={children}
                  depth={depth + 1}
                  droppableId={`children:${page.id}`}
                  getChildren={getChildren}
                  onCreateChild={onCreateChild}
                  onDelete={onDelete}
                  onRename={onRename}
                  onToggleFavorite={onToggleFavorite}
                  currentId={currentId}
                />
              </Collapsible.Content>
            )}
          </Collapsible.Root>
        </div>
      )}
    </Draggable>
  );
}

// ─── PageLevel ────────────────────────────────────────────────────────────────

function PageLevel({ pages, depth, droppableId, getChildren, onCreateChild, onDelete, onRename, onToggleFavorite, currentId }) {
  return (
    <Droppable droppableId={droppableId}>
      {(drop) => (
        <div ref={drop.innerRef} {...drop.droppableProps} className="space-y-px">
          {pages.map((page, index) => (
            <PageRow
              key={page.id}
              page={page}
              depth={depth}
              index={index}
              getChildren={getChildren}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              onRename={onRename}
              onToggleFavorite={onToggleFavorite}
              currentId={currentId}
            />
          ))}
          {drop.placeholder}
        </div>
      )}
    </Droppable>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[11px] font-medium text-[#7a7a7a]">
      {children}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ getChildren, createPage, updatePage, deletePage, reorderPages, onCollapse, pages = [] }) {
  const { id: currentId } = useParams();
  const navigate = useNavigate();
  const importRef = useRef(null);
  const settingsRef = useRef(null);
  const [ioStatus, setIoStatus] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    const h = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [settingsOpen]);

  const handleCreateRoot = async () => {
    const page = await createPage({ title: 'Untitled' });
    navigate(`/page/${page.id}`);
  };

  const handleCreateChild = async (parentId) => {
    const page = await createPage({ title: 'Untitled', parentId });
    navigate(`/page/${page.id}`);
  };

  const handleRename = (id, title) => updatePage(id, { title });
  const handleToggleFavorite = (id, val) => updatePage(id, { isFavorite: val });

  const favoritePages = pages.filter((p) => p.isFavorite);

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    if (source.droppableId !== destination.droppableId) return;

    const parentId = source.droppableId === 'root'
      ? null
      : source.droppableId.replace('children:', '');
    const siblings = getChildren(parentId);
    const reordered = [...siblings];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    reorderPages(parentId, reordered.map((p) => p.id));
  };

  const handleExport = async () => {
    setSettingsOpen(false);
    setIoStatus('exporting');
    try {
      const data = await exportWorkspace();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `librarian-${new Date().toISOString().slice(0, 10)}.library`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIoStatus('ok');
    } catch {
      setIoStatus('error');
    }
    setTimeout(() => setIoStatus(null), 2000);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSettingsOpen(false);
    setIoStatus('importing');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importWorkspace(data);
      setIoStatus('ok');
      window.location.hash = '/';
      window.location.reload();
    } catch {
      setIoStatus('error');
      setTimeout(() => setIoStatus(null), 3000);
    }
  };

  const triggerSearch = () => {
    const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    window.dispatchEvent(e);
  };

  const rootPages = getChildren(null);

  return (
    <div className="flex h-full flex-col bg-[#191919] text-[#e8e8e8]">
      {/* Header */}
      <div className="flex h-[42px] flex-shrink-0 items-center justify-between gap-1 px-3">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-[13.5px] font-semibold text-[#e8e8e8] transition-colors hover:bg-white/[0.045]"
        >
          <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border border-[#3a3a3a] bg-[#2a2a2a]">
            <Shield className="h-3.5 w-3.5 fill-[#d36868] text-[#d36868]" strokeWidth={1.5} />
          </span>
          <span className="truncate">Librarian</span>
        </Link>
        <button
          onClick={onCollapse}
          className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-[#c4c4c4]"
          title="Collapse sidebar (Ctrl+\\)"
        >
          <PanelLeftClose className="h-[15px] w-[15px]" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-2 pb-1">
        <button
          onClick={triggerSearch}
          className="flex w-full items-center gap-2 rounded-[5px] px-2 py-[5px] text-[13.5px] text-[#9a9a9a] transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
        >
          <Search className="h-[15px] w-[15px]" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded bg-white/[0.05] px-1 py-px text-[10px] font-mono text-[#7a7a7a]">⌘K</kbd>
        </button>
        <Link
          to="/"
          className={`mt-px flex items-center gap-2 rounded-[5px] px-2 py-[5px] text-[13.5px] transition-colors ${
            !currentId
              ? 'bg-white/[0.085] text-[#e8e8e8]'
              : 'text-[#b4b4b4] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
          }`}
        >
          <Home className="h-[15px] w-[15px]" />
          Home
        </Link>
      </div>

      {/* Favorites */}
      {favoritePages.length > 0 && (
        <>
          <SectionLabel>Favorites</SectionLabel>
          <div className="space-y-px px-2">
            {favoritePages.map((p) => (
              <Link
                key={p.id}
                to={`/page/${p.id}`}
                className={`flex items-center gap-1.5 rounded-[5px] px-1.5 py-[5px] text-[13.5px] transition-colors ${
                  currentId === p.id
                    ? 'bg-white/[0.085] text-[#e8e8e8]'
                    : 'text-[#b4b4b4] hover:bg-white/[0.045] hover:text-[#e8e8e8]'
                }`}
              >
                <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center text-[14px] leading-none">
                  {p.icon ? renderIcon(p.icon) : <Star className="h-3 w-3 fill-amber-400/80 text-amber-400/80" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.title || 'Untitled'}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Page tree */}
      <SectionLabel>Workspace</SectionLabel>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <DragDropContext onDragEnd={handleDragEnd}>
          <PageLevel
            pages={rootPages}
            depth={0}
            droppableId="root"
            getChildren={getChildren}
            onCreateChild={handleCreateChild}
            onDelete={deletePage}
            onRename={handleRename}
            onToggleFavorite={handleToggleFavorite}
            currentId={currentId}
          />
        </DragDropContext>
        {rootPages.length === 0 && (
          <p className="px-2 py-1 text-[12px] text-[#6e6e6e]">
            No pages yet
          </p>
        )}
        <button
          onClick={handleCreateRoot}
          className="mt-1 flex w-full items-center gap-2 rounded-[5px] px-2 py-[5px] text-[13px] text-[#7a7a7a] transition-colors hover:bg-white/[0.045] hover:text-[#c4c4c4]"
        >
          <Plus className="h-[14px] w-[14px]" />
          New page
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-[#262626] bg-[#191919] px-2 py-1.5">
        <div className="relative flex-1" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1 text-[12.5px] text-[#9a9a9a] transition-colors hover:bg-white/[0.045] hover:text-[#e8e8e8]"
            title="Workspace settings"
          >
            <Settings className="h-[14px] w-[14px]" />
            <span className="flex-1 text-left">Settings</span>
          </button>
          {settingsOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-56 overflow-hidden rounded-lg border border-[#373737] bg-[#252525] py-1 shadow-2xl">
              <button
                onClick={handleExport}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
              >
                <Download className="h-3.5 w-3.5 text-[#7a7a7a]" />
                Export workspace
              </button>
              <button
                onClick={() => importRef.current?.click()}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
              >
                <Upload className="h-3.5 w-3.5 text-[#7a7a7a]" />
                Import workspace
              </button>
              <input ref={importRef} type="file" accept=".library,.json" className="hidden" onChange={handleImport} />
            </div>
          )}
        </div>
      </div>
      {ioStatus && (
        <div className="px-3 pb-2">
          {ioStatus === 'exporting' && <p className="text-[11px] text-[#9a9a9a]">Exporting…</p>}
          {ioStatus === 'importing' && <p className="text-[11px] text-[#9a9a9a]">Importing…</p>}
          {ioStatus === 'ok' && <p className="text-[11px] text-emerald-400">Done</p>}
          {ioStatus === 'error' && <p className="text-[11px] text-red-400">Failed</p>}
        </div>
      )}
    </div>
  );
}
