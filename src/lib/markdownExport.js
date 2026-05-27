// Export the current workspace to a GitBook-style Markdown zip.
//
// Output layout:
//   README.md                          (workspace title + summary)
//   SUMMARY.md                         (sidebar navigation)
//   <Page Title>/README.md             (root-level page)
//   <Page Title>/<Column>/<Card>.md    (cards on a map page)
//   <Parent>/<Child>/...               (nested pages)
//
// Card markdown follows the GitBook layout:
//   # Title
//   > Subtitle
//   ## Overview ... ## Steps - ... - ... ## Commands ### Title ```lang code ```

import JSZip from 'jszip';
import { exportWorkspace } from './pageStore';

const slashRe = /\//g;
const fsName = (s) => (s ?? '').toString().replace(slashRe, '-').trim() || 'Untitled';

function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function cardToMarkdown(card) {
  const out = [];
  out.push(`# ${card.title || 'Untitled'}`);
  out.push('');
  const subtitle = (card.subtitle || '').trim();
  if (subtitle) {
    out.push(`> ${subtitle.replace(/\n/g, '\n> ')}`);
    out.push('');
  }
  const overview = sanitize(card.overview || '');
  if (overview) {
    out.push('## Overview');
    out.push('');
    out.push(overview);
    out.push('');
  }
  const steps = (card.steps || []).map(sanitize).filter(Boolean);
  if (steps.length) {
    out.push('## Steps');
    out.push('');
    for (const step of steps) {
      // Each step is a single bullet. Internal newlines indent on continuation.
      const oneLine = step.split('\n').map((l, i) => (i === 0 ? `- ${l}` : `  ${l}`)).join('\n');
      out.push(oneLine);
    }
    out.push('');
  }
  const cmds = (card.commands || []).filter(c => (c.code || '').trim());
  if (cmds.length) {
    out.push('## Commands');
    out.push('');
    for (const c of cmds) {
      if (c.title) {
        out.push(`### ${c.title}`);
        out.push('');
      }
      const lang = c.language || 'text';
      out.push('```' + lang);
      out.push(c.code.replace(/\n+$/, ''));
      out.push('```');
      out.push('');
    }
  }
  // SubCards (nested H2 per sub-card).
  const subs = card.subCards || [];
  if (subs.length) {
    out.push('## Tools');
    out.push('');
    for (const s of subs) {
      out.push(`### ${s.title || 'Untitled'}`);
      out.push('');
      const ss = (s.subtitle || '').trim();
      if (ss) {
        out.push(`> ${ss}`);
        out.push('');
      }
      const sov = sanitize(s.overview || '');
      if (sov) {
        out.push('#### Overview');
        out.push('');
        out.push(sov);
        out.push('');
      }
      const ssteps = (s.steps || []).map(sanitize).filter(Boolean);
      if (ssteps.length) {
        out.push('#### Steps');
        out.push('');
        for (const st of ssteps) {
          out.push(`- ${st.replace(/\n/g, '\n  ')}`);
        }
        out.push('');
      }
      const scmds = (s.commands || []).filter(c => (c.code || '').trim());
      if (scmds.length) {
        out.push('#### Commands');
        out.push('');
        for (const c of scmds) {
          if (c.title) { out.push(`##### ${c.title}`); out.push(''); }
          out.push('```' + (c.language || 'text'));
          out.push(c.code.replace(/\n+$/, ''));
          out.push('```');
          out.push('');
        }
      }
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// Build a children index for the pages tree.
function buildTree(pages) {
  const byParent = new Map();
  for (const p of pages) {
    const k = p.parentId || null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(p);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return byParent;
}

// Extract the map block (if any) on a page; cards are matched against its
// columns/techniques. Pages without a map use a flat dump.
function findMapBlock(blocks) {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) if (b?.type === 'map' && b.props?.mapId) return b;
  return null;
}

function collectCardData(blocks) {
  const cards = [];
  if (!Array.isArray(blocks)) return cards;
  for (const b of blocks) {
    if (b?.type !== 'card') continue;
    const raw = b.props?.data;
    if (!raw) continue;
    try {
      cards.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {}
  }
  return cards;
}

function encodePath(p) {
  return p.split('/').map((seg) => encodeURIComponent(seg)).join('/');
}

export async function exportWorkspaceAsMarkdown() {
  const ws = await exportWorkspace();
  const zip = new JSZip();
  const byParent = buildTree(ws.pages);
  const summaryLines = ['# Summary', '', '* [Workspace](README.md)'];

  // Root README
  zip.file('README.md', '# Workspace\n\nExported from Librarian.\n');

  // Walk top-level pages and recurse.
  const writePage = (page, parentPath, depth) => {
    const pageDir = `${parentPath}${fsName(page.title)}`;
    const pageContent = ws.content[page.id] || [];
    const mapBlock = findMapBlock(pageContent);
    const mapData = mapBlock ? ws.mapData[mapBlock.props.mapId] : null;
    const cards = collectCardData(pageContent);
    const cardsByTitle = new Map(cards.map((c) => [c.title || '', c]));

    const indent = '  '.repeat(depth + 1);
    summaryLines.push(`${indent}* [${page.title}](${encodePath(`${pageDir}/README.md`)})`);

    // Page README. For markdown-mode pages (content stored as a raw string),
    // the README *is* the page body — just prepend the title as an H1.
    // For block-based pages with a map, fall back to a column-summary.
    const readmeParts = [`# ${page.title}`, ''];
    if (typeof pageContent === 'string' && pageContent.trim()) {
      readmeParts.push(pageContent.replace(/^[ \t]*#\s+.+\n+/, ''));
    } else if (mapData && mapData.columns?.length) {
      readmeParts.push('Map of column groupings:');
      readmeParts.push('');
      for (const col of mapData.columns) {
        readmeParts.push(`- **${col.title}** — ${col.techniques?.length || 0} entries`);
      }
    }
    zip.file(`${pageDir}/README.md`, readmeParts.join('\n') + '\n');

    // Write cards. If the page has a map, group by column.
    if (mapData && mapData.columns?.length) {
      for (const col of mapData.columns) {
        const colDir = `${pageDir}/${fsName(col.title)}`;
        const colIndent = '  '.repeat(depth + 2);
        summaryLines.push(`${colIndent}* ${fsName(col.title)}`);
        for (const tech of col.techniques || []) {
          const card = cardsByTitle.get(tech.title);
          if (!card) continue;
          const file = `${colDir}/${fsName(card.title)}.md`;
          zip.file(file, cardToMarkdown(card));
          const cardIndent = '  '.repeat(depth + 3);
          summaryLines.push(`${cardIndent}* [${card.title}](${encodePath(file)})`);
        }
      }
    } else {
      // Flat dump of every card directly under the page folder.
      for (const card of cards) {
        const file = `${pageDir}/${fsName(card.title)}.md`;
        zip.file(file, cardToMarkdown(card));
        const cardIndent = '  '.repeat(depth + 2);
        summaryLines.push(`${cardIndent}* [${card.title}](${encodePath(file)})`);
      }
    }

    // Recurse into child pages.
    const children = byParent.get(page.id) || [];
    for (const child of children) writePage(child, `${pageDir}/`, depth + 1);
  };

  const rootPages = byParent.get(null) || [];
  for (const page of rootPages) writePage(page, '', 0);

  zip.file('SUMMARY.md', summaryLines.join('\n') + '\n');
  return zip.generateAsync({ type: 'blob' });
}

export async function downloadWorkspaceAsMarkdown() {
  const blob = await exportWorkspaceAsMarkdown();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `librarian-${new Date().toISOString().slice(0, 10)}-markdown.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
