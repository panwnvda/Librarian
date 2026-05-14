import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, SearchX, FileText, Home as HomeIcon, Plus, Clock, Star, AlignLeft } from 'lucide-react';
import { loadPageContent } from '@/lib/pageStore';
import { renderIcon } from '@/lib/iconRegistry';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function extractText(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map((block) => {
    const inline = (block.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const children = extractText(block.children || []);
    return [inline, children].filter(Boolean).join(' ');
  }).join(' ');
}

export default function CommandPalette({ pages = [], createPage, recentIds = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contentMap, setContentMap] = useState(null);
  const loadingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    // Load content index in background on first open
    if (contentMap !== null || loadingRef.current) return;
    loadingRef.current = true;
    Promise.all(
      pages.map(async (p) => {
        const blocks = await loadPageContent(p.id);
        return /** @type {[string, string]} */ ([p.id, extractText(blocks || [])]);
      })
    ).then((entries) => {
      setContentMap(new Map(entries));
      loadingRef.current = false;
    });
  }, [open, pages]);

  const close = useCallback(() => setOpen(false), []);
  const run = useCallback((fn) => () => { fn(); close(); }, [close]);

  if (!open) return null;

  const isEmpty = query === '';

  const sorted = [...pages].sort((a, b) =>
    (a.title || 'Untitled').localeCompare(b.title || 'Untitled')
  );

  const contentMatches = !isEmpty && contentMap && query.length > 1
    ? pages.filter((p) => {
        const titleHit = (p.title || '').toLowerCase().includes(query.toLowerCase());
        if (titleHit) return false;
        const text = contentMap.get(p.id) || '';
        return text.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  const recentPages = recentIds
    .map((id) => pages.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 5);

  const favoritePages = pages.filter((p) => p.isFavorite);

  const itemClass =
    'flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer rounded-md text-[#b0b0b0] text-[13.5px] data-[selected=true]:bg-[#2a2a2a] data-[selected=true]:text-[#e8e8e8] transition-colors';
  const groupClass =
    '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[#7a7a7a]';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[15vh]"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#3a3a3a] bg-[#202020] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Command palette"
          filter={(value, search) => {
            // Content-match items are pre-filtered by our own logic — always show them
            if (value.startsWith('__content__')) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-3 py-3">
            <Search className="h-4 w-4 flex-shrink-0 text-[#6e6e6e]" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages…"
              className="w-full bg-transparent text-sm text-[#e8e8e8] placeholder-[#6e6e6e] focus:outline-none"
            />
            <kbd className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-[#6e6e6e]">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto px-2 py-2">
            <Command.Empty className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-[#6e6e6e]">
              <SearchX className="h-5 w-5 text-[#3a3a3a]" />
              No pages found
            </Command.Empty>

            {/* Actions — always shown */}
            <Command.Group heading="Actions" className={groupClass}>
              <Command.Item
                value="home workspace"
                onSelect={run(() => navigate('/'))}
                className={itemClass}
              >
                <HomeIcon className="h-3.5 w-3.5 text-[#6e6e6e]" />
                Home
              </Command.Item>
              <Command.Item
                value="new page create"
                onSelect={run(async () => {
                  const page = await createPage({ title: 'Untitled' });
                  navigate(`/page/${page.id}`);
                })}
                className={itemClass}
              >
                <Plus className="h-3.5 w-3.5 text-[#6e6e6e]" />
                New page
              </Command.Item>
            </Command.Group>

            {/* Favorites — shown when no query */}
            {isEmpty && favoritePages.length > 0 && (
              <Command.Group heading="Favorites" className={groupClass}>
                {favoritePages.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={p.id}
                    onSelect={run(() => navigate(`/page/${p.id}`))}
                    className={itemClass}
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-sm leading-none">
                      {p.icon ? renderIcon(p.icon) : <FileText className="h-3.5 w-3.5 text-[#6e6e6e]" />}
                    </span>
                    <span className="flex-1 truncate">{p.title || 'Untitled'}</span>
                    <Star className="h-3 w-3 flex-shrink-0 fill-amber-400 text-amber-400" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Recent — shown when no query */}
            {isEmpty && recentPages.length > 0 && (
              <Command.Group heading="Recent" className={groupClass}>
                {recentPages.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={p.id}
                    onSelect={run(() => navigate(`/page/${p.id}`))}
                    className={itemClass}
                  >
                    <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#6e6e6e]" />
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-sm leading-none">
                      {p.icon ? renderIcon(p.icon) : <FileText className="h-3.5 w-3.5 text-[#6e6e6e]" />}
                    </span>
                    <span className="flex-1 truncate">{p.title || 'Untitled'}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* All pages — shown when searching */}
            {!isEmpty && sorted.length > 0 && (
              <Command.Group heading="Pages" className={groupClass}>
                {sorted.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`${p.title || 'Untitled'} ${p.id}`}
                    onSelect={run(() => navigate(`/page/${p.id}`))}
                    className={itemClass}
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-sm leading-none">
                      {p.icon ? renderIcon(p.icon) : <FileText className="h-3.5 w-3.5 text-[#6e6e6e]" />}
                    </span>
                    <span className="flex-1 truncate">{p.title || 'Untitled'}</span>
                    {p.isFavorite && (
                      <Star className="h-3 w-3 flex-shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Content matches — pages where content (not title) matches */}
            {contentMatches.length > 0 && (
              <Command.Group heading="In content" className={groupClass}>
                {contentMatches.map((p) => (
                  <Command.Item
                    key={`content-${p.id}`}
                    value={`__content__${p.id}`}
                    onSelect={run(() => navigate(`/page/${p.id}`))}
                    className={itemClass}
                  >
                    <AlignLeft className="h-3.5 w-3.5 flex-shrink-0 text-[#6e6e6e]" />
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-sm leading-none">
                      {p.icon ? renderIcon(p.icon) : <FileText className="h-3.5 w-3.5 text-[#6e6e6e]" />}
                    </span>
                    <span className="flex-1 truncate">{p.title || 'Untitled'}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-[10px] text-[#6e6e6e]">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="rounded bg-[#202020] px-1 py-0.5">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="rounded bg-[#202020] px-1 py-0.5">↵</kbd> open
              </span>
            </div>
            <span>
              <kbd className="rounded bg-[#202020] px-1 py-0.5">{isMac ? '⌘' : 'Ctrl+'}K</kbd> toggle
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
