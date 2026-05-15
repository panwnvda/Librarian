import { useState, useEffect, useCallback } from 'react';
import {
  loadPages,
  createPage as storeCreate,
  updatePageMeta,
  deletePage as storeDelete,
  reorderPages as storeReorder,
  movePage as storeMovePage,
  loadPageContent,
  savePageContent,
} from '@/lib/pageStore';

export function usePages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages().then((data) => {
      setPages(data);
      setLoading(false);
    });
  }, []);

  const createPage = useCallback(async (opts = {}) => {
    const page = await storeCreate(opts);
    setPages((prev) => [...prev, page]);
    return page;
  }, []);

  const updatePage = useCallback(async (id, updates) => {
    const updated = await updatePageMeta(id, updates);
    setPages((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const deletePage = useCallback(async (id) => {
    const deletedIds = await storeDelete(id);
    setPages((prev) => prev.filter((p) => !deletedIds.includes(p.id)));
    return deletedIds;
  }, []);

  const getChildren = useCallback(
    (parentId = null) =>
      pages
        .filter((p) => p.parentId === parentId)
        .sort((a, b) => a.order - b.order),
    [pages]
  );

  const getPage = useCallback((id) => pages.find((p) => p.id === id) ?? null, [pages]);

  const reorderPages = useCallback(async (parentId, orderedIds) => {
    const next = await storeReorder(parentId, orderedIds);
    setPages(next);
  }, []);

  const movePage = useCallback(async (pageId, newParentId, newIndex) => {
    const next = await storeMovePage(pageId, newParentId, newIndex);
    setPages(next);
  }, []);

  return {
    pages,
    loading,
    createPage,
    updatePage,
    deletePage,
    reorderPages,
    movePage,
    getChildren,
    getPage,
    loadPageContent,
    savePageContent,
  };
}
