import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, FileText, Clock, Star } from 'lucide-react';
import { renderIcon } from '@/lib/iconRegistry';

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WorkspacePage({ pages, createPage }) {
  const navigate = useNavigate();
  const [view, setView] = useState('list');

  const handleCreate = async () => {
    const page = await createPage({ title: 'Untitled' });
    navigate(`/page/${page.id}`);
  };

  const rootPages = pages.filter((p) => !p.parentId);
  const sorted = [...rootPages].sort((a, b) => b.updatedAt - a.updatedAt);
  const favorites = pages.filter((p) => p.isFavorite).slice(0, 4);
  const recent = [...pages]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl px-12 py-16">
      {/* Greeting */}
      <div className="mb-10">
        <h1 className="text-[28px] font-bold tracking-tight text-[#e8e8e8]">
          {timeGreeting()}
        </h1>
        <p className="mt-1 text-[14px] text-[#8a8a8a]">
          {pages.length === 0
            ? 'Create your first page to get started.'
            : `You have ${pages.length} page${pages.length !== 1 ? 's' : ''} in your workspace.`}
        </p>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#7a7a7a]">
            <Star className="h-3 w-3 fill-amber-400/80 text-amber-400/80" />
            Favorites
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {favorites.map((page) => (
              <button
                key={page.id}
                onClick={() => navigate(`/page/${page.id}`)}
                className="group flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#232323] px-3 py-2.5 text-left transition-all hover:border-[#3a3a3a] hover:bg-[#272727]"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[16px] leading-none">
                  {page.icon ? renderIcon(page.icon) : <FileText className="h-4 w-4 text-[#7a7a7a]" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[#e8e8e8]">
                  {page.title || 'Untitled'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recently edited */}
      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#7a7a7a]">
            <Clock className="h-3 w-3" />
            Recently edited
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((page) => (
              <button
                key={page.id}
                onClick={() => navigate(`/page/${page.id}`)}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#232323] text-left transition-all hover:border-[#3a3a3a] hover:bg-[#272727]"
              >
                <div
                  className="h-16 w-full flex-shrink-0 bg-cover bg-center"
                  style={
                    page.cover
                      ? { backgroundImage: `url(${page.cover})` }
                      : { background: 'linear-gradient(135deg, #2a2a2a 0%, #232323 100%)' }
                  }
                />
                <div className="flex items-start gap-2 p-3">
                  <span className="flex-shrink-0 text-[17px] leading-none">
                    {page.icon ? renderIcon(page.icon) : <FileText className="h-4 w-4 text-[#7a7a7a]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-[#e8e8e8]">
                      {page.title || 'Untitled'}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[#7a7a7a]">
                      {formatDate(page.updatedAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* All pages */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-[#7a7a7a]">
            All pages
            {pages.length > rootPages.length && (
              <span className="ml-2 normal-case tracking-normal text-[#5a5a5a]">
                · {rootPages.length} root, {pages.length} total
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md border border-[#2a2a2a] bg-[#1f1f1f] p-0.5">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] transition-colors ${
                  view === 'list'
                    ? 'bg-white/[0.06] text-[#e8e8e8]'
                    : 'text-[#7a7a7a] hover:text-[#c4c4c4]'
                }`}
              >
                <List className="h-3 w-3" />
                List
              </button>
              <button
                onClick={() => setView('gallery')}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] transition-colors ${
                  view === 'gallery'
                    ? 'bg-white/[0.06] text-[#e8e8e8]'
                    : 'text-[#7a7a7a] hover:text-[#c4c4c4]'
                }`}
              >
                <LayoutGrid className="h-3 w-3" />
                Gallery
              </button>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-md bg-[#e8e8e8] px-2.5 py-1 text-[11.5px] font-medium text-[#1a1a1a] transition-colors hover:bg-white"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#2a2a2a] py-16 text-center">
            <FileText className="h-8 w-8 text-[#3a3a3a]" strokeWidth={1.5} />
            <p className="text-[13.5px] text-[#8a8a8a]">No pages yet</p>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-md bg-[#e8e8e8] px-3 py-1.5 text-[12.5px] font-medium text-[#1a1a1a] transition-colors hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Create your first page
            </button>
          </div>
        ) : view === 'list' ? (
          <div className="overflow-hidden rounded-lg border border-[#2a2a2a]">
            {sorted.map((page, i) => (
              <button
                key={page.id}
                onClick={() => navigate(`/page/${page.id}`)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035] ${
                  i !== sorted.length - 1 ? 'border-b border-[#262626]' : ''
                }`}
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[15px] leading-none">
                  {page.icon ? renderIcon(page.icon) : <FileText className="h-4 w-4 text-[#7a7a7a]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-[#e8e8e8]">
                    {page.title || 'Untitled'}
                  </div>
                </div>
                <div className="flex-shrink-0 text-[11.5px] text-[#6e6e6e]">
                  {formatDate(page.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sorted.map((page) => (
              <button
                key={page.id}
                onClick={() => navigate(`/page/${page.id}`)}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#232323] text-left transition-all hover:border-[#3a3a3a] hover:bg-[#272727]"
              >
                <div
                  className="h-24 w-full flex-shrink-0 bg-cover bg-center"
                  style={
                    page.cover
                      ? { backgroundImage: `url(${page.cover})` }
                      : { background: 'linear-gradient(135deg, #2a2a2a 0%, #232323 100%)' }
                  }
                />
                <div className="flex items-center gap-2 p-3">
                  <span className="flex-shrink-0 text-[18px] leading-none">
                    {page.icon ? renderIcon(page.icon) : <FileText className="h-4 w-4 text-[#7a7a7a]" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[#e8e8e8]">
                    {page.title || 'Untitled'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
