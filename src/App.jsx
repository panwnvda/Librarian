import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { HashRouter as Router, Route, Routes, useParams } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { useState, useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import CommandPalette from '@/components/CommandPalette';
import Layout from './pages/Layout.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import PageEditor from './components/PageEditor.jsx';
import PageNotFound from './lib/PageNotFound';
import { usePages } from './hooks/usePages.js';
import { useRecentPages } from './hooks/useRecentPages.js';
import { loadPageContent } from './lib/pageStore.js';
import { PagesContext } from './contexts/PagesContext.jsx';

function PageEditorRoute({ pages, updatePage, savePageContent, createPage, trackVisit }) {
  const { id } = useParams();
  const page = pages.find((p) => p.id === id);
  const [initialBlocks, setInitialBlocks] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    setInitialBlocks(null);
    if (!id) return;
    loadPageContent(id).then((blocks) => {
      setInitialBlocks(blocks);
      setReady(true);
    });
    trackVisit(id);
  }, [id]);

  if (!page) return <PageNotFound />;
  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3a3a3a] border-t-[#5b86c8]" />
      </div>
    );
  }

  return (
    <PageEditor
      key={id}
      page={page}
      allPages={pages}
      initialBlocks={initialBlocks}
      updatePage={updatePage}
      saveContent={savePageContent}
      createPage={createPage}
    />
  );
}

function AppContent() {
  const {
    pages, loading, createPage, updatePage, deletePage,
    reorderPages, movePage, getChildren, savePageContent,
  } = usePages();
  const { recentIds, trackVisit } = useRecentPages();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3a3a3a] border-t-[#5b86c8]" />
      </div>
    );
  }

  return (
    <PagesContext.Provider value={pages}>
      <CommandPalette pages={pages} createPage={createPage} recentIds={recentIds} />
      <Layout
        pages={pages}
        getChildren={getChildren}
        createPage={createPage}
        updatePage={updatePage}
        deletePage={deletePage}
        reorderPages={reorderPages}
        movePage={movePage}
      >
        <Routes>
          <Route
            path="/"
            element={<WorkspacePage pages={pages} createPage={createPage} />}
          />
          <Route
            path="/page/:id"
            element={
              <PageEditorRoute
                pages={pages}
                updatePage={updatePage}
                savePageContent={savePageContent}
                createPage={createPage}
                trackVisit={trackVisit}
              />
            }
          />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Layout>
    </PagesContext.Provider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <MantineProvider defaultColorScheme="dark">
        <Router>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </Router>
        <Toaster />
      </MantineProvider>
    </QueryClientProvider>
  );
}
