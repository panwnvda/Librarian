import { persistGet, persistSet, persistDelete } from '@/lib/persistentStorage';

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

// Moves a page to a different parent (or to a different position under the
// same parent). Refuses no-ops (page === parent) and cycles (moving a page
// into one of its own descendants would create one). Reassigns order for the
// destination siblings so the dropped page sits at `newIndex`.
export async function movePage(pageId, newParentId, newIndex) {
  const pages = await loadPages();
  const moved = pages.find((p) => p.id === pageId);
  if (!moved) return pages;
  if (pageId === newParentId) return pages;

  let cursor = newParentId;
  while (cursor) {
    if (cursor === pageId) return pages;
    cursor = pages.find((p) => p.id === cursor)?.parentId ?? null;
  }

  const newSiblings = pages
    .filter((p) => p.parentId === newParentId && p.id !== pageId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const clampedIdx = Math.max(0, Math.min(newIndex ?? newSiblings.length, newSiblings.length));
  newSiblings.splice(clampedIdx, 0, { ...moved, parentId: newParentId });

  const orderMap = new Map();
  newSiblings.forEach((p, i) => orderMap.set(p.id, i));

  const next = pages.map((p) => {
    if (p.id === pageId) {
      return { ...p, parentId: newParentId, order: orderMap.get(pageId), updatedAt: Date.now() };
    }
    if (p.parentId === newParentId && orderMap.has(p.id)) {
      return { ...p, order: orderMap.get(p.id) };
    }
    return p;
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

// Additive import: imported pages and maps are given fresh IDs (so nothing
// collides with the existing workspace) and grafted onto the sidebar as new
// top-level subtrees. References inside imported content — /map blocks'
// `mapId`, /pagelink blocks' `pageId`, and map techniques' `link.id` — are
// rewritten to the new IDs so cross-page navigation still works after import.
//
// The data shape is the v3 export format produced by `exportWorkspace` and by
// `scripts/convert-cybernotes-to-library.mjs`:
//   { pages: [...], content: { pageId: blocks }, mapData: { mapId: {...} } }
function remapBlockRefs(blocks, mapIdMap, pageIdMap) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    const next = { ...block };
    if (block.props && typeof block.props === 'object') {
      next.props = { ...block.props };
      if (block.type === 'map' && next.props.mapId && mapIdMap.has(next.props.mapId)) {
        next.props.mapId = mapIdMap.get(next.props.mapId);
      } else if (block.type === 'pagelink' && next.props.pageId && pageIdMap.has(next.props.pageId)) {
        next.props.pageId = pageIdMap.get(next.props.pageId);
      }
    }
    if (Array.isArray(block.children) && block.children.length) {
      next.children = remapBlockRefs(block.children, mapIdMap, pageIdMap);
    }
    return next;
  });
}

function remapMapContent(mapContent, pageIdMap) {
  if (!mapContent || !Array.isArray(mapContent.columns)) return mapContent;
  return {
    ...mapContent,
    columns: mapContent.columns.map((col) => ({
      ...col,
      techniques: (col.techniques || []).map((tech) => {
        const link = tech.link;
        if (link && link.type === 'page' && link.id && pageIdMap.has(link.id)) {
          return { ...tech, link: { ...link, id: pageIdMap.get(link.id) } };
        }
        return tech;
      }),
    })),
  };
}

export async function importWorkspace(data) {
  if (!data || !Array.isArray(data.pages)) throw new Error('Invalid workspace file.');

  // Build collision-free ID mappings before writing anything.
  const pageIdMap = new Map();
  for (const p of data.pages) pageIdMap.set(p.id, newId());
  const mapIdMap = new Map();
  for (const oldMapId of Object.keys(data.mapData || {})) {
    mapIdMap.set(oldMapId, 'map_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 6));
  }

  const existing = await loadPages();
  const baseOrder = existing.length ? Math.max(...existing.map((p) => p.order ?? 0)) + 1 : 0;

  const importedPages = data.pages.map((p, i) => ({
    ...p,
    id: pageIdMap.get(p.id),
    parentId: p.parentId && pageIdMap.has(p.parentId) ? pageIdMap.get(p.parentId) : null,
    order: baseOrder + i,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }));

  await savePages([...existing, ...importedPages]);

  for (const [oldPageId, blocks] of Object.entries(data.content || {})) {
    const newPageId = pageIdMap.get(oldPageId);
    if (!newPageId) continue;
    await persistSet(contentKey(newPageId), remapBlockRefs(blocks, mapIdMap, pageIdMap));
  }

  for (const [oldMapId, mapContent] of Object.entries(data.mapData || {})) {
    const newMapId = mapIdMap.get(oldMapId);
    if (!newMapId) continue;
    await persistSet(`library_map_${newMapId}`, remapMapContent(mapContent, pageIdMap));
  }

  return importedPages;
}
