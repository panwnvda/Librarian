import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight, Plus, Trash2, MoreHorizontal,
  FileText, Home, PanelLeftClose,
  Download, Upload, Star, Settings, Search, Shield,
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { exportWorkspace, importWorkspace } from '@/lib/pageStore';
import { downloadWorkspaceAsMarkdown } from '@/lib/markdownExport';
import { importMarkdownFile } from '@/lib/markdownImport';
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
// Native HTML5 drag-and-drop. During a drag, two transparent overlay strips
// (one at the top of the row, one at the bottom) are absolutely positioned
// over the row's edges. The strips capture "insert as sibling above/below"
// drops. The middle of the row stays clear for "nest inside". Because the
// strips are absolutely positioned, the row's layout height never changes
// during a drag — the sidebar list stays the same size whether you're
// dragging or not.

function PageRow({
  page, depth, parentId, index, getChildren,
  onCreateChild, onDelete, onRename, onToggleFavorite, currentId,
  draggingId, dropIndicator, onDragStart, onRowDragOver, onInsertDragOver, onDragEnd, onDrop,
  onMoveToTopLevel, onMoveOutOneLevel, parentPage,
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
  const isDragging = draggingId === page.id;
  const isNestTarget =
    dropIndicator?.kind === 'nest' && dropIndicator.targetId === page.id;

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

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-page-id', page.id);
    onDragStart(page.id);
  };

  const handleRowDragOver = (e) => {
    onRowDragOver(page.id, e);
  };

  const showAboveLine =
    dropIndicator?.kind === 'insert' &&
    dropIndicator.parentId === parentId &&
    dropIndicator.index === index;
  const showBelowLine =
    dropIndicator?.kind === 'insert' &&
    dropIndicator.parentId === parentId &&
    dropIndicator.index === index + 1;
  // Active during any drag — even the row being dragged keeps its overlays
  // so the user can immediately drop "above me" / "below me" without first
  // moving off the source row.
  const overlaysActive = !!draggingId;

  return (
    <div className="relative">
      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <div className="relative">
          {/* Visual indicator lines — purely decorative, no event handlers. */}
          {showAboveLine && (
            <div
              className="pointer-events-none absolute -top-px left-0 right-0 z-20 h-[2px] rounded-full bg-[#5b86c8]"
              style={{ marginLeft: `${depth * 14 + 6}px`, marginRight: '4px' }}
            />
          )}
          {showBelowLine && (
            <div
              className="pointer-events-none absolute -bottom-px left-0 right-0 z-20 h-[2px] rounded-full bg-[#5b86c8]"
              style={{ marginLeft: `${depth * 14 + 6}px`, marginRight: '4px' }}
            />
          )}
          {/* Edge hit-strips — only present while a drag is in progress.
              Absolute positioning means they take no layout space; the
              sidebar's row heights stay constant. 10px tall is the largest
              we can go without eating the row body's "nest inside" zone. */}
          {overlaysActive && (
            <>
              <div
                onDragOver={(e) => onInsertDragOver(parentId, index, e)}
                onDrop={onDrop}
                className="absolute left-0 right-0 top-0 z-10 h-[10px]"
              />
              <div
                onDragOver={(e) => onInsertDragOver(parentId, index + 1, e)}
                onDrop={onDrop}
                className="absolute bottom-0 left-0 right-0 z-10 h-[10px]"
              />
            </>
          )}
          <div
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleRowDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            className={`group relative flex items-center gap-1 rounded-[5px] pr-1 transition-colors
              ${isNestTarget
                ? 'bg-[#5b86c8]/15 ring-1 ring-[#5b86c8]/40'
                : isActive
                  ? 'bg-white/[0.085] text-[#e8e8e8]'
                  : 'text-[#b4b4b4] hover:bg-white/[0.045]'
            }
            ${isDragging ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          <Collapsible.Trigger asChild>
            <button
              className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-white/[0.06] hover:text-[#c4c4c4] ${
                hasChildren ? 'text-[#7a7a7a]' : 'text-[#5a5a5a]'
              }`}
              onClick={(e) => { e.stopPropagation(); }}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          </Collapsible.Trigger>

          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center text-[14px] leading-none">
            {page.icon ? renderIcon(page.icon) : <FileText className="h-[14px] w-[14px] text-[#7a7a7a]" />}
          </span>

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
              draggable={false}
            />
          ) : (
            <Link
              to={`/page/${page.id}`}
              className="min-w-0 flex-1 truncate py-[5px] text-[13.5px] leading-none"
              onDoubleClick={(e) => { e.preventDefault(); setRenaming(true); }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
            >
              {page.title || 'Untitled'}
            </Link>
          )}

          <div className="invisible flex flex-shrink-0 items-center gap-0.5 group-hover:visible">
            <button
              ref={menuTriggerRef}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
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
              {/* Move operations — bulletproof click-based alternatives to
                  drag-and-drop. Only shown when the page is currently nested. */}
              {parentId !== null && (
                <>
                  <div className="my-1 h-px bg-[#373737]" />
                  {parentPage && parentPage.parentId !== null && (
                    <button
                      onClick={() => { setMenuOpen(false); onMoveOutOneLevel?.(page.id); }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
                      title={`Move out of "${parentPage.title || 'Untitled'}"`}
                    >
                      Move out one level
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); onMoveToTopLevel?.(page.id); }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
                  >
                    Move to top level
                  </button>
                </>
              )}
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
              draggable={false}
              className="flex h-[18px] w-[18px] items-center justify-center rounded text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-[#e8e8e8]"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        </div>

        <Collapsible.Content>
          <PageLevel
            parentId={page.id}
            parentPage={page}
            pages={children}
            depth={depth + 1}
            getChildren={getChildren}
            onCreateChild={onCreateChild}
            onDelete={onDelete}
            onRename={onRename}
            onToggleFavorite={onToggleFavorite}
            currentId={currentId}
            draggingId={draggingId}
            dropIndicator={dropIndicator}
            onDragStart={onDragStart}
            onRowDragOver={onRowDragOver}
            onInsertDragOver={onInsertDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onMoveToTopLevel={onMoveToTopLevel}
            onMoveOutOneLevel={onMoveOutOneLevel}
          />
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}

// ─── PageLevel ────────────────────────────────────────────────────────────────

function PageLevel({
  parentId = null,
  parentPage = null,
  pages, depth, getChildren, onCreateChild, onDelete, onRename, onToggleFavorite, currentId,
  draggingId, dropIndicator,
  onDragStart, onRowDragOver, onInsertDragOver, onDragEnd, onDrop,
  onMoveToTopLevel, onMoveOutOneLevel,
}) {
  // The insertion drop targets are now absolute-positioned strips inside
  // each PageRow (see PageRow above), so this component is just a flat list.
  return (
    <div>
      {pages.map((page, i) => (
        <PageRow
          key={page.id}
          page={page}
          depth={depth}
          parentId={parentId}
          parentPage={parentPage}
          index={i}
          getChildren={getChildren}
          onCreateChild={onCreateChild}
          onDelete={onDelete}
          onRename={onRename}
          onToggleFavorite={onToggleFavorite}
          currentId={currentId}
          draggingId={draggingId}
          dropIndicator={dropIndicator}
          onDragStart={onDragStart}
          onRowDragOver={onRowDragOver}
          onInsertDragOver={onInsertDragOver}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onMoveToTopLevel={onMoveToTopLevel}
          onMoveOutOneLevel={onMoveOutOneLevel}
        />
      ))}
    </div>
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

export default function Sidebar({ getChildren, createPage, updatePage, deletePage, reorderPages, movePage, onCollapse, pages = [] }) {
  const { id: currentId } = useParams();
  const navigate = useNavigate();
  const importRef = useRef(null);
  const settingsRef = useRef(null);
  const [ioStatus, setIoStatus] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Native HTML5 drag-and-drop state. `draggingId` is the id of the page
  // currently being dragged (so we can style the source row). `dropIndicator`
  // describes where the drop will land — { targetId, zone } where zone is
  // 'above', 'inside', or 'below'. The Sidebar holds this state; PageRow
  // reports back via the callbacks below.
  const [draggingId, setDraggingId] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  // Ref kept in sync with `dropIndicator` so the drop handler sees the latest
  // value without depending on stale state inside a closure.
  const dropIndicatorRef = useRef(null);

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

  // Returns true if `descendantId` is `pageId` itself or one of its
  // descendants — used to refuse drops that would create a cycle (e.g.
  // dropping page A "inside" one of A's own sub-pages).
  const isSelfOrDescendant = (pageId, descendantId) => {
    if (pageId === descendantId) return true;
    const stack = [pageId];
    while (stack.length) {
      const id = stack.pop();
      const children = getChildren(id);
      for (const child of children) {
        if (child.id === descendantId) return true;
        stack.push(child.id);
      }
    }
    return false;
  };

  // Click-based fallbacks for the operations that drag-and-drop covers.
  // These are exposed in the page row's "More" menu so the user always has
  // a guaranteed way to perform each move regardless of drag accuracy.
  const handleMoveToTopLevel = (pageId) => {
    if (!movePage) return;
    const rootCount = getChildren(null).length;
    movePage(pageId, null, rootCount);
  };
  const handleMoveOutOneLevel = (pageId) => {
    if (!movePage) return;
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const parent = pages.find((p) => p.id === page.parentId);
    if (!parent) return;
    // Insert right after the parent in the grandparent's child list.
    const grandparentId = parent.parentId;
    const siblings = getChildren(grandparentId);
    const parentIdx = siblings.findIndex((p) => p.id === parent.id);
    movePage(pageId, grandparentId, parentIdx + 1);
  };

  const handleRowDragStart = (pageId) => {
    setDraggingId(pageId);
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  };

  // Cursor is over a page row — interpret as "nest inside this page".
  // Refuse the drop (no preventDefault) if it would create a cycle.
  const handleRowDragOver = (targetId, e) => {
    if (!draggingId || draggingId === targetId) return;
    if (isSelfOrDescendant(draggingId, targetId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cur = dropIndicatorRef.current;
    if (!cur || cur.kind !== 'nest' || cur.targetId !== targetId) {
      const next = { kind: 'nest', targetId };
      dropIndicatorRef.current = next;
      setDropIndicator(next);
    }
  };

  // Cursor is over an insertion line — interpret as "insert as sibling at
  // this slot under parentId". Refuse if the slot is inside the dragged
  // page's own subtree (cycle).
  const handleInsertDragOver = (parentId, index, e) => {
    if (!draggingId) return;
    if (parentId !== null && isSelfOrDescendant(draggingId, parentId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cur = dropIndicatorRef.current;
    if (!cur || cur.kind !== 'insert' || cur.parentId !== parentId || cur.index !== index) {
      const next = { kind: 'insert', parentId, index };
      dropIndicatorRef.current = next;
      setDropIndicator(next);
    }
  };

  const handleRowDragEnd = () => {
    setDraggingId(null);
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  };

  const handleRowDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/x-page-id') || draggingId;
    const indicator = dropIndicatorRef.current;
    setDraggingId(null);
    dropIndicatorRef.current = null;
    setDropIndicator(null);
    if (!draggedId || !indicator || !movePage) return;

    if (indicator.kind === 'nest') {
      if (draggedId === indicator.targetId) return;
      if (isSelfOrDescendant(draggedId, indicator.targetId)) return;
      movePage(draggedId, indicator.targetId, 0);
      return;
    }
    // kind === 'insert'
    const { parentId, index } = indicator;
    if (parentId !== null && isSelfOrDescendant(draggedId, parentId)) return;
    // Adjust the target index when moving inside the same parent and the
    // dragged page currently sits above the slot — without this, removing
    // the page shifts everything below it up by one and the drop lands one
    // slot too low.
    const draggedPage = pages.find((p) => p.id === draggedId);
    let insertAt = index;
    if (draggedPage && draggedPage.parentId === parentId) {
      const siblings = getChildren(parentId);
      const oldIdx = siblings.findIndex((p) => p.id === draggedId);
      if (oldIdx !== -1 && oldIdx < index) insertAt = index - 1;
    }
    movePage(draggedId, parentId, insertAt);
  };

  const handleExport = async (format = 'library') => {
    setSettingsOpen(false);
    setIoStatus('exporting');
    try {
      if (format === 'markdown') {
        await downloadWorkspaceAsMarkdown();
      } else {
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
      }
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
      const lower = (file.name || '').toLowerCase();
      let data;
      if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.zip')) {
        data = await importMarkdownFile(file);
      } else {
        const text = await file.text();
        data = JSON.parse(text);
      }
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
        <PageLevel
          parentId={null}
          parentPage={null}
          pages={rootPages}
          depth={0}
          getChildren={getChildren}
          onCreateChild={handleCreateChild}
          onDelete={deletePage}
          onRename={handleRename}
          onToggleFavorite={handleToggleFavorite}
          currentId={currentId}
          draggingId={draggingId}
          dropIndicator={dropIndicator}
          onDragStart={handleRowDragStart}
          onRowDragOver={handleRowDragOver}
          onInsertDragOver={handleInsertDragOver}
          onDragEnd={handleRowDragEnd}
          onDrop={handleRowDrop}
          onMoveToTopLevel={handleMoveToTopLevel}
          onMoveOutOneLevel={handleMoveOutOneLevel}
        />
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
        {/* Big obvious "drop here to move out / to top level" target. Only
            appears during a drag so it doesn't take up sidebar space when
            you're not dragging. Drops here always make the page top-level
            at the end of the list — the simplest "get me out of wherever
            I am" escape hatch. */}
        {draggingId && (
          <div
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const next = { kind: 'insert', parentId: null, index: rootPages.length, isFooter: true };
              const cur = dropIndicatorRef.current;
              if (!cur || !cur.isFooter) {
                dropIndicatorRef.current = next;
                setDropIndicator(next);
              }
            }}
            onDrop={handleRowDrop}
            className={`mt-3 rounded-md border border-dashed py-4 text-center text-[12px] transition-colors ${
              dropIndicator?.isFooter
                ? 'border-[#5b86c8] bg-[#5b86c8]/15 text-[#86b0e3]'
                : 'border-[#3a3a3a] bg-white/[0.02] text-[#7a7a7a]'
            }`}
          >
            Drop here to move to top level
          </div>
        )}
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
                onClick={() => handleExport('library')}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
              >
                <Download className="h-3.5 w-3.5 text-[#7a7a7a]" />
                Export as .library
              </button>
              <button
                onClick={() => handleExport('markdown')}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
              >
                <Download className="h-3.5 w-3.5 text-[#7a7a7a]" />
                Export as Markdown
              </button>
              <div className="my-1 h-px bg-white/[0.06]" />
              <button
                onClick={() => importRef.current?.click()}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05]"
              >
                <Upload className="h-3.5 w-3.5 text-[#7a7a7a]" />
                Import (.library / .md / .zip)
              </button>
              <input ref={importRef} type="file" accept=".library,.json,.md,.markdown,.zip" className="hidden" onChange={handleImport} />
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
