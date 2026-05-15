import React, { useState, useEffect } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Sidebar from '@/components/Sidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { persistGet, persistSet } from '@/lib/persistentStorage';

export default function Layout({ children, pages, getChildren, createPage, updatePage, deletePage, reorderPages, movePage }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    persistGet('library_sidebar_collapsed').then((val) => {
      if (val != null) setOpen(!val);
    });
  }, []);

  const collapse = () => {
    setOpen(false);
    persistSet('library_sidebar_collapsed', true);
  };

  const expand = () => {
    setOpen(true);
    persistSet('library_sidebar_collapsed', false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1a1a]">
      {!open && (
        <button
          onClick={expand}
          title="Expand sidebar"
          className="fixed left-3 top-3 z-50 flex h-7 w-7 items-center justify-center rounded-md text-[#6e6e6e] transition-colors hover:bg-white/[0.06] hover:text-[#c4c4c4]"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <PanelGroup direction="horizontal" autoSaveId="librarian-sidebar">
        {open && (
          <>
            <Panel defaultSize={17} minSize={12} maxSize={32} id="sidebar" order={1}>
              <Sidebar
                pages={pages}
                getChildren={getChildren}
                createPage={createPage}
                updatePage={updatePage}
                deletePage={deletePage}
                reorderPages={reorderPages}
                movePage={movePage}
                onCollapse={collapse}
              />
            </Panel>
            <PanelResizeHandle className="group relative flex w-px flex-shrink-0 cursor-col-resize items-center justify-center bg-[#262626] transition-colors hover:bg-[#3a3a3a] data-[resize-handle-active=pointer]:bg-[#5b86c8]/60">
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </PanelResizeHandle>
          </>
        )}
        <Panel id="main" order={2}>
          <main className={`h-full overflow-y-auto bg-[#1f1f1f] ${!open ? 'pl-12' : ''}`}>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
}
