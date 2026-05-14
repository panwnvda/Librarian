import { persistGet, persistSet, persistDelete, persistClearWorkspace } from '@/lib/persistentStorage';

const PAGES_KEY = 'library_workspace_pages';
const contentKey = (id) => `library_page_content_${id}`;

function newId() {
  return 'page_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6);
}

export async function loadPages() {
  const pages = await persistGet(PAGES_KEY);
  return Array.isArray(pages) ? pages : [];
}

export async function savePages(pages) {
  await persistSet(PAGES_KEY, pages);
}

export async function createPage({ title = 'Untitled', parentId = null, icon = null, cover = null } = {}) {
  const pages = await loadPages();
  const siblings = pages.filter((p) => p.parentId === parentId);
  const order = siblings.length > 0 ? Math.max(...siblings.map((p) => p.order)) + 1 : 0;

  const page = {
    id: newId(),
    title,
    icon,
    cover,
    parentId,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await savePages([...pages, page]);
  return page;
}

export async function updatePageMeta(id, updates) {
  const pages = await loadPages();
  const next = pages.map((p) =>
    p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
  );
  await savePages(next);
  return next.find((p) => p.id === id);
}

export async function deletePage(id) {
  const pages = await loadPages();
  const toDelete = new Set();
  const collect = (pageId) => {
    toDelete.add(pageId);
    pages.filter((p) => p.parentId === pageId).forEach((p) => collect(p.id));
  };
  collect(id);

  await savePages(pages.filter((p) => !toDelete.has(p.id)));
  await Promise.all([...toDelete].map((pid) => persistDelete(contentKey(pid))));
  return [...toDelete];
}

export async function loadPageContent(id) {
  const content = await persistGet(contentKey(id));
  return content ?? null;
}

export async function savePageContent(id, blocks) {
  await persistSet(contentKey(id), blocks);
  const pages = await loadPages();
  await savePages(pages.map((p) => p.id === id ? { ...p, updatedAt: Date.now() } : p));
}

export async function reorderPages(parentId, orderedIds) {
  const pages = await loadPages();
  const next = pages.map((p) => {
    const idx = orderedIds.indexOf(p.id);
    return idx !== -1 ? { ...p, order: idx } : p;
  });
  await savePages(next);
  return next;
}

function collectMapIds(blocks) {
  const ids = [];
  const visit = (bls) => {
    for (const block of bls || []) {
      if (block.type === 'map' && block.props?.mapId) ids.push(block.props.mapId);
      if (block.children?.length) visit(block.children);
    }
  };
  visit(blocks);
  return ids;
}

export async function exportWorkspace() {
  const pages = await loadPages();
  const content = {};
  const mapData = {};

  for (const page of pages) {
    const blocks = await persistGet(contentKey(page.id));
    if (blocks != null) {
      content[page.id] = blocks;
      for (const mapId of collectMapIds(blocks)) {
        const data = await persistGet(`library_map_${mapId}`);
        if (data != null) mapData[mapId] = data;
      }
    }
  }

  return { version: 3, exportedAt: new Date().toISOString(), pages, content, mapData };
}

export async function importWorkspace(data) {
  if (!data.pages || !Array.isArray(data.pages)) throw new Error('Invalid workspace file.');
  await persistClearWorkspace();
  await savePages(data.pages);
  for (const [id, blocks] of Object.entries(data.content || {})) {
    await persistSet(contentKey(id), blocks);
  }
  for (const [mapId, mapContent] of Object.entries(data.mapData || {})) {
    await persistSet(`library_map_${mapId}`, mapContent);
  }
  return data.pages;
}
