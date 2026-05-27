// Parse a single .md or a .zip of GitBook-style Markdown into a v3 workspace shape
// that `importWorkspace` can swallow.
//
// Output shape: each .md becomes its own markdown-mode page (page.mode =
// 'markdown', content stored as the raw markdown string). Folders become
// parent pages that contain their own README.md (if present) as content.
// No synthetic maps, no synthetic cards — what you import is what you see.
//
// Expected zip layouts:
//   • A flat or nested tree of .md files (any GitBook export, Obsidian vault,
//     plain documentation folder, etc.).
//   • A single optional wrapping directory (e.g. `red-team-notebook-md/`) is
//     auto-detected and stripped so the inner tree maps to the workspace.

import JSZip from 'jszip';

let idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(16).slice(2, 6)}`;
}

// Drop a leading `NN.NN` or `NN.` numbering prefix from a slugged filename
// and turn dashes back into spaces so the page title reads cleanly.
function titleFromName(name) {
  let s = name.replace(/\.md$/i, '');
  // Numbering prefix variants: "01.", "01.01", "01.-", "01.01-".
  s = s.replace(/^\d{1,3}(?:\.\d{1,3})?[\s\-_.]+/, '');
  return s.trim() || name;
}

// Strip a leading `# Title` line from a markdown body if present — the page
// title is already represented as page.title, so showing it again at the top
// of the markdown body would just duplicate it.
function stripLeadingH1(md) {
  const m = md.match(/^[ \t]*#\s+.+\n+/);
  if (!m) return md;
  return md.slice(m[0].length);
}

function buildSingleCardWorkspace(fileName, md) {
  // Single .md → one markdown-mode page. Title from H1 if the doc has one,
  // otherwise from the filename.
  const h1 = md.match(/^[ \t]*#\s+(.+?)\s*$/m);
  const title = h1 ? h1[1].trim() : titleFromName(fileName);
  const body = h1 ? stripLeadingH1(md) : md;
  const pageId = uid('page');
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    pages: [{
      id: pageId,
      title,
      icon: null,
      cover: null,
      parentId: null,
      order: 0,
      mode: 'markdown',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
    content: { [pageId]: body },
    mapData: {},
  };
}

async function buildWorkspaceFromZip(zip) {
  // Gather all .md paths.
  const allPaths = [];
  zip.forEach((relPath, entry) => { if (!entry.dir) allPaths.push(relPath); });
  if (!allPaths.length) throw new Error('Zip contains no files.');

  // Detect single wrapping directory.
  const segLists = allPaths.map((p) => p.split('/'));
  let rootPrefix = '';
  const firstSeg = segLists[0][0];
  if (segLists.every((s) => s.length > 1 && s[0] === firstSeg)) rootPrefix = firstSeg + '/';

  const mdPaths = [];
  for (const p of allPaths) {
    if (!p.toLowerCase().endsWith('.md')) continue;
    const rel = rootPrefix ? p.slice(rootPrefix.length) : p;
    if (rel.toLowerCase() === 'summary.md') continue;     // GitBook nav — skip
    mdPaths.push(rel);
  }
  if (!mdPaths.length) throw new Error('Zip contains no .md files.');

  // Build folder index: pathUnderRoot → { files: [...], folders: Set<string> }
  const folderIndex = new Map();
  const ensure = (path) => {
    if (!folderIndex.has(path)) folderIndex.set(path, { files: [], folders: new Set() });
    return folderIndex.get(path);
  };
  ensure('');
  for (const rel of mdPaths) {
    const parts = rel.split('/');
    const file = parts.pop();
    let acc = '';
    for (const seg of parts) {
      ensure(acc).folders.add(seg);
      acc = acc ? `${acc}/${seg}` : seg;
      ensure(acc);
    }
    ensure(acc).files.push(file);
  }

  const pages = [];
  const content = {};

  async function readMd(path) {
    const full = rootPrefix + path;
    const entry = zip.file(full);
    if (!entry) return '';
    return await entry.async('string');
  }

  function isReadme(name) {
    return name.toLowerCase() === 'readme.md';
  }

  // Recursively build pages from a folder. Each .md file becomes a child
  // page; subfolders become child pages too (their README.md content if
  // present, otherwise an empty page). The root call's `folderPath` is ''.
  async function buildFolder(folderPath, parentId, displayName) {
    const folder = folderIndex.get(folderPath);
    if (!folder) return;

    // README.md (if present) provides the body of this folder-page.
    const readme = folder.files.find(isReadme);
    let body = '';
    if (readme) {
      const raw = await readMd(folderPath ? `${folderPath}/${readme}` : readme);
      // Drop the leading "# Folder Title" since the page title carries it.
      body = stripLeadingH1(raw);
    }

    const pageId = uid('page');
    pages.push({
      id: pageId,
      title: displayName,
      icon: null,
      cover: null,
      parentId,
      order: pages.filter((p) => p.parentId === parentId).length,
      mode: 'markdown',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    content[pageId] = body;

    // Each non-README .md becomes a child markdown page.
    const childFiles = folder.files.filter((n) => !isReadme(n)).sort();
    for (const fname of childFiles) {
      const raw = await readMd(folderPath ? `${folderPath}/${fname}` : fname);
      const fileTitle = titleFromName(fname);
      const filePageId = uid('page');
      pages.push({
        id: filePageId,
        title: fileTitle,
        icon: null,
        cover: null,
        parentId: pageId,
        order: pages.filter((p) => p.parentId === pageId).length,
        mode: 'markdown',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      content[filePageId] = stripLeadingH1(raw);
    }

    // Each subfolder becomes a child page (recurse).
    const subFolders = [...folder.folders].sort();
    for (const sub of subFolders) {
      const subPath = folderPath ? `${folderPath}/${sub}` : sub;
      await buildFolder(subPath, pageId, titleFromName(sub));
    }
  }

  // Top-level folders + top-level .md files become root pages.
  const root = folderIndex.get('');
  const topFolders = [...root.folders].sort();
  const topFiles = root.files.filter((n) => !isReadme(n)).sort();

  // If there's a top-level README.md, surface it as its own root page first.
  const topReadme = root.files.find(isReadme);
  if (topReadme) {
    const raw = await readMd(topReadme);
    const h1 = raw.match(/^[ \t]*#\s+(.+?)\s*$/m);
    const title = h1 ? h1[1].trim() : 'Workspace';
    const rootPageId = uid('page');
    pages.push({
      id: rootPageId,
      title,
      icon: null,
      cover: null,
      parentId: null,
      order: 0,
      mode: 'markdown',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    content[rootPageId] = stripLeadingH1(raw);
  }

  for (const fname of topFiles) {
    const raw = await readMd(fname);
    const pageId = uid('page');
    pages.push({
      id: pageId,
      title: titleFromName(fname),
      icon: null,
      cover: null,
      parentId: null,
      order: pages.filter((p) => p.parentId === null).length,
      mode: 'markdown',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    content[pageId] = stripLeadingH1(raw);
  }

  for (const top of topFolders) {
    await buildFolder(top, null, titleFromName(top));
  }

  return { version: 3, exportedAt: new Date().toISOString(), pages, content, mapData: {} };
}

export async function importMarkdownFile(file) {
  const name = file.name || '';
  if (name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    return await buildWorkspaceFromZip(zip);
  }
  if (name.toLowerCase().endsWith('.md') || name.toLowerCase().endsWith('.markdown')) {
    const text = await file.text();
    return buildSingleCardWorkspace(name, text);
  }
  throw new Error('Unsupported Markdown import. Expected .md or .zip.');
}
