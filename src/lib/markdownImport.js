// Parse a single .md or a .zip of GitBook-style Markdown into a v3 workspace shape
// that `importWorkspace` can swallow.
//
// Expected zip layout (from exportWorkspaceAsMarkdown / the Python GitBook script):
//   README.md                   (workspace root)
//   SUMMARY.md                  (optional — used as hierarchy hint)
//   <Page>/README.md            (page root)
//   <Page>/<Column>/<Card>.md   (card under a column)
//
// A single .md file produces one page containing one card block.

import JSZip from 'jszip';

const COLORS = [
  'red','ruby','rose','pink','magenta','fuchsia','purple','violet','indigo','blue',
  'sky','cyan','teal','mint','emerald','green','lime','yellow','amber','orange',
];

let idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(16).slice(2, 6)}`;
}

// Extract one section (## Heading) from a markdown body. Returns the text
// between the heading and the next H2 (or end of file). Heading match is
// case-insensitive and tolerates extra whitespace.
function extractSection(md, name) {
  const re = new RegExp(`^##\\s+${name}\\s*$`, 'im');
  const m = re.exec(md);
  if (!m) return '';
  const after = md.slice(m.index + m[0].length);
  const next = after.search(/^##\s/m);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

function extractTitleAndSubtitle(md) {
  // First H1 → title.
  const h1 = md.match(/^#\s+(.+?)\s*$/m);
  const title = h1 ? h1[1].trim() : 'Untitled';
  // Subtitle = first blockquote line right after the H1.
  let subtitle = '';
  if (h1) {
    const after = md.slice(h1.index + h1[0].length).replace(/^\n+/, '');
    const bq = after.match(/^>\s*(.+?)(?:\n(?!>)|$)/s);
    if (bq) subtitle = bq[1].trim();
  }
  return { title, subtitle };
}

// Split a `## Steps` body into individual steps. Each step is a top-level
// `- ` bullet; continuation lines are 2-space indented.
function parseSteps(body) {
  if (!body) return [];
  const lines = body.split('\n');
  const steps = [];
  let current = null;
  for (const line of lines) {
    const m = /^- (.*)$/.exec(line);
    if (m) {
      if (current) steps.push(current.trim());
      current = m[1];
    } else if (current !== null) {
      // Continuation — 2-space indent OR blank line.
      const cont = line.replace(/^  /, '');
      current += '\n' + cont;
    }
  }
  if (current) steps.push(current.trim());
  return steps.filter(Boolean);
}

// Parse a `## Commands` (or `## Technical Notes`) body into command objects.
// Recognizes:  ### Title\n```lang\ncode\n```
// Falls back to anonymous code fences when no ### heading precedes them.
function parseCommands(body) {
  if (!body) return [];
  const cmds = [];
  const reH = /###\s+(.+?)\n```(\w+)?\n([\s\S]*?)```/g;
  let m;
  while ((m = reH.exec(body)) !== null) {
    cmds.push({ title: m[1].trim(), language: m[2] || 'bash', code: m[3].replace(/\n+$/, '') });
  }
  if (cmds.length) return cmds;
  const reB = /```(\w+)?\n([\s\S]*?)```/g;
  while ((m = reB.exec(body)) !== null) {
    cmds.push({ title: '', language: m[1] || 'bash', code: m[2].replace(/\n+$/, '') });
  }
  return cmds;
}

// Parse one card markdown → card data object.
export function parseCardMarkdown(md, fallbackTitle = 'Untitled') {
  const { title, subtitle } = extractTitleAndSubtitle(md);
  const overview = extractSection(md, 'Overview');
  const stepsBody = extractSection(md, 'Steps');
  const cmdBody = extractSection(md, 'Commands') || extractSection(md, 'Technical Notes');
  return {
    title: title || fallbackTitle,
    subtitle,
    overview,
    steps: parseSteps(stepsBody),
    commands: parseCommands(cmdBody),
    subsections: [],
    subCards: [],
    tags: [],
    accentColor: 'cyan',
    font: null,
  };
}

// Build a v3 workspace object containing one page with one card from a .md file.
function buildSingleCardWorkspace(fileName, md) {
  const card = parseCardMarkdown(md, fileName.replace(/\.md$/i, ''));
  const pageId = uid('page');
  const mapId = uid('map');
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    pages: [{
      id: pageId,
      title: card.title,
      icon: null,
      cover: null,
      parentId: null,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
    content: {
      [pageId]: [
        { type: 'map', props: { mapId, height: 600 } },
        { type: 'card', props: { data: JSON.stringify(card) } },
      ],
    },
    mapData: {
      [mapId]: {
        columns: [{
          id: uid('col'),
          title: '01. Imported',
          color: COLORS[0],
          font: 'font-title-oswald',
          techniques: [{ id: uid('tech'), title: card.title, subtitle: '', link: null }],
        }],
      },
    },
  };
}

// Build a v3 workspace from a zip whose layout matches our GitBook export.
// Each top-level folder is treated as a root page. Each subfolder is treated
// either as a child page OR — when it directly contains .md files — as a
// column on the parent page's map.
async function buildWorkspaceFromZip(zip) {
  // Collect file paths and detect the common root prefix (if the zip was
  // produced with a single wrapping folder, e.g. `red-team-notebook-md/`).
  const allPaths = [];
  zip.forEach((relPath, entry) => { if (!entry.dir) allPaths.push(relPath); });
  if (!allPaths.length) throw new Error('Zip contains no files.');

  // Detect single wrapping directory.
  const segLists = allPaths.map((p) => p.split('/'));
  let rootPrefix = '';
  const firstSeg = segLists[0][0];
  if (segLists.every((s) => s.length > 1 && s[0] === firstSeg)) rootPrefix = firstSeg + '/';

  // Index relevant files by their path-under-root.
  const fileMap = new Map(); // pathUnderRoot → markdown string (lazy via promises)
  for (const p of allPaths) {
    if (!p.toLowerCase().endsWith('.md')) continue;
    const rel = rootPrefix ? p.slice(rootPrefix.length) : p;
    fileMap.set(rel, p);
  }

  // Build folder index: folder path → { files: [filename], folders: [folder name] }
  const folderIndex = new Map();
  const addFolder = (path) => { if (!folderIndex.has(path)) folderIndex.set(path, { files: [], folders: new Set() }); };
  addFolder('');
  for (const rel of fileMap.keys()) {
    const parts = rel.split('/');
    const file = parts.pop();
    let acc = '';
    for (const seg of parts) {
      addFolder(acc);
      const nextAcc = acc ? `${acc}/${seg}` : seg;
      folderIndex.get(acc).folders.add(seg);
      acc = nextAcc;
    }
    addFolder(acc);
    folderIndex.get(acc).files.push(file);
  }

  // Determine page folders (those containing >0 md files OR >0 subfolders that
  // contain md files). Skip empty folders.
  function folderHasContent(path) {
    const f = folderIndex.get(path);
    if (!f) return false;
    if (f.files.length) return true;
    for (const sub of f.folders) if (folderHasContent(path ? `${path}/${sub}` : sub)) return true;
    return false;
  }

  // A folder is a "column" (not a sub-page) when it contains only .md files
  // and no further sub-folders. Else it's a sub-page.
  function isColumnFolder(path) {
    const f = folderIndex.get(path);
    if (!f) return false;
    if (f.folders.size > 0) return false;
    return f.files.some((n) => n.toLowerCase() !== 'readme.md');
  }

  const pages = [];
  const content = {};
  const mapData = {};

  async function readMd(path) {
    const full = rootPrefix + path;
    const entry = zip.file(full);
    if (!entry) return '';
    return await entry.async('string');
  }

  // For card filenames we strip the .md and any leading NN.NN- numbering prefix.
  function titleFromFilename(name) {
    return name.replace(/\.md$/i, '').replace(/^\d{2}\.?\d{0,2}[\s\-_.]+/, '').trim() || name;
  }

  async function buildPage(folderPath, parentId, order, titleOverride) {
    const folder = folderIndex.get(folderPath);
    if (!folder) return null;

    const folderName = folderPath.split('/').pop();
    const pageTitle = (titleOverride || folderName || 'Workspace').trim();
    const pageId = uid('page');

    pages.push({
      id: pageId,
      title: pageTitle,
      icon: null,
      cover: null,
      parentId,
      order,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const blocks = [];
    const folderColumns = [...folder.folders].filter((sub) => isColumnFolder(folderPath ? `${folderPath}/${sub}` : sub));
    const folderSubPages = [...folder.folders].filter((sub) => !folderColumns.includes(sub));

    // Direct .md files (non-README) at this level go into a default "Notes" column.
    const directCards = folder.files.filter((n) => n.toLowerCase() !== 'readme.md');

    if (folderColumns.length || directCards.length) {
      const mapId = uid('map');
      const columns = [];

      if (directCards.length) {
        const techniques = [];
        for (const fname of directCards.sort()) {
          const md = await readMd(folderPath ? `${folderPath}/${fname}` : fname);
          const card = parseCardMarkdown(md, titleFromFilename(fname));
          blocks.push({ type: 'card', props: { data: JSON.stringify(card) } });
          techniques.push({ id: uid('tech'), title: card.title, subtitle: '', link: null });
        }
        columns.push({
          id: uid('col'),
          title: 'Notes',
          color: COLORS[columns.length % COLORS.length],
          font: 'font-title-oswald',
          techniques,
        });
      }

      for (const subName of folderColumns.sort()) {
        const subPath = folderPath ? `${folderPath}/${subName}` : subName;
        const subFolder = folderIndex.get(subPath);
        if (!subFolder) continue;
        const cardFiles = subFolder.files.filter((n) => n.toLowerCase() !== 'readme.md').sort();
        const techniques = [];
        for (const fname of cardFiles) {
          const md = await readMd(`${subPath}/${fname}`);
          const card = parseCardMarkdown(md, titleFromFilename(fname));
          blocks.push({ type: 'card', props: { data: JSON.stringify(card) } });
          techniques.push({ id: uid('tech'), title: card.title, subtitle: '', link: null });
        }
        columns.push({
          id: uid('col'),
          title: subName,
          color: COLORS[columns.length % COLORS.length],
          font: 'font-title-oswald',
          techniques,
        });
      }

      if (columns.length) {
        mapData[mapId] = { columns };
        blocks.unshift({ type: 'map', props: { mapId, height: 600 } });
      }
    }

    content[pageId] = blocks;

    // Recurse into sub-pages.
    let subOrder = 0;
    for (const subName of folderSubPages.sort()) {
      const subPath = folderPath ? `${folderPath}/${subName}` : subName;
      await buildPage(subPath, pageId, subOrder++);
    }
    return pageId;
  }

  // Build from top-level folders.
  const root = folderIndex.get('');
  let topOrder = 0;
  for (const top of [...root.folders].sort()) {
    if (!folderHasContent(top)) continue;
    await buildPage(top, null, topOrder++);
  }

  return { version: 3, exportedAt: new Date().toISOString(), pages, content, mapData };
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
