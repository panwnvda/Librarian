// Shared serialise / parse helpers for technique card ↔ markdown document.

// Dot colors match MapBlock's COLORS palette exactly so the picker swatches
// are identical to what the columns show.
export const CARD_COLOR_OPTIONS = [
  { value: 'red',     dot: 'bg-[#d36868]' },
  { value: 'ruby',    dot: 'bg-[#b53a3a]' },
  { value: 'rose',    dot: 'bg-[#e16078]' },
  { value: 'pink',    dot: 'bg-[#d178b5]' },
  { value: 'magenta', dot: 'bg-[#d44ec6]' },
  { value: 'fuchsia', dot: 'bg-[#c850c6]' },
  { value: 'purple',  dot: 'bg-[#9b7ec8]' },
  { value: 'violet',  dot: 'bg-[#8a76e0]' },
  { value: 'indigo',  dot: 'bg-[#7080d4]' },
  { value: 'blue',    dot: 'bg-[#5b86c8]' },
  { value: 'sky',     dot: 'bg-[#5fa5d6]' },
  { value: 'cyan',    dot: 'bg-[#5bb8c8]' },
  { value: 'teal',    dot: 'bg-[#5db09e]' },
  { value: 'mint',    dot: 'bg-[#6ed4a9]' },
  { value: 'emerald', dot: 'bg-[#5db075]' },
  { value: 'green',   dot: 'bg-[#67b365]' },
  { value: 'lime',    dot: 'bg-[#a3c95a]' },
  { value: 'yellow',  dot: 'bg-[#cfa84b]' },
  { value: 'amber',   dot: 'bg-[#d4a14a]' },
  { value: 'orange',  dot: 'bg-[#d68c5a]' },
  { value: 'brown',   dot: 'bg-[#a07458]' },
  { value: 'stone',   dot: 'bg-[#78716c]' },
  { value: 'slate',   dot: 'bg-[#64748b]' },
  { value: 'gray',    dot: 'bg-[#7a7a7a]' },
];

// Default body for a new card. Kept intentionally minimal — only the
// `## Overview` and `## Steps` headings, no Technical Notes section (users
// add that themselves with the toolbar's Code Block button under a
// `## Technical Notes` heading when they want it). The Steps section has
// no starter step either; the Steps toolbar button seeds the first one
// on demand.
export const BLANK_BODY = '## Overview\n\n\n## Steps\n\n';

// Steps are delimited by ordered-list markers (`1.`, `2.`, …) at the start of
// a line — the same syntax that the editor renders as numbered step bubbles.
// So whatever the user numbers in the body becomes a discrete step on the card.

// Defensive cleanup applied at every read+write boundary so corrupt user input
// never reaches the storage layer.
function sanitizeMarkdown(text) {
  if (typeof text !== 'string' || !text) return '';
  let s = text.replace(/\r\n?/g, '\n');
  // Drop empty code fences before they fragment the surrounding content.
  s = s.replace(/^```[ \t]*[a-zA-Z0-9_+\-]*[ \t]*\n[ \t\r\n]*```[ \t]*$/gm, '');
  // Balance unpaired fences (append closing).
  const fenceCount = (s.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) s += '\n```';
  // Intentionally NOT collapsing blank-line runs: users want the vertical
  // spacing they typed (one or more blank lines) to round-trip intact.
  return s.trim();
}

export function extractSection(md, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'm');
  const m = re.exec(md);
  if (!m) return '';
  const after = md.slice(m.index + m[0].length);
  const next = after.search(/^##\s/m);
  return (next === -1 ? after : after.slice(0, next)).trim();
}

export function cardToMarkdown(card) {
  const parts = [];
  parts.push(`## Overview\n${sanitizeMarkdown(card.overview || '')}`);
  // Prefer the ordered stepBlocks (which preserve free-text typed under Steps);
  // fall back to the flat steps[] for legacy cards that have no stepBlocks.
  let stepsBlock;
  if (Array.isArray(card.stepBlocks) && card.stepBlocks.length) {
    let n = 0;
    stepsBlock = card.stepBlocks
      .map(b => {
        const t = sanitizeMarkdown(b && b.text);
        if (!t) return '';
        if (b.type === 'step') { n += 1; return `${n}. ${t}`; }
        return t;
      })
      .filter(Boolean)
      .join('\n\n');
  } else {
    const steps = (card.steps || []).map(sanitizeMarkdown).filter(Boolean);
    stepsBlock = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  parts.push(`## Steps\n${stepsBlock}`);
  // Only emit a `## Technical Notes` section when the card actually has
  // commands. The unconditional heading injection used to make the section
  // come back on every save/reload — users would delete it from the body
  // and on the next render it would be re-injected.
  const cmds = (card.commands || []).filter(c => c.code && c.code.trim());
  if (cmds.length) {
    parts.push(`## Technical Notes\n${cmds.map(c =>
      `${c.title ? `### ${c.title}\n` : ''}\`\`\`${c.language || 'bash'}\n${c.code}\n\`\`\``
    ).join('\n\n')}`);
  }
  return parts.join('\n\n');
}

/**
 * Parse the Steps section into ordered blocks so nothing the user types is
 * lost. A line that starts with an ordered-list marker (`1.`, `2.`, … the same
 * numbers the user types) begins a `step` block — these render as the
 * interactive numbered bubbles. Any other prose is kept as a `text` block and
 * renders as plain markdown (NOT a numbered bubble). Fenced code blocks are
 * stashed first so a `1.`-looking line inside code can't split a block.
 *
 * Returns an array of `{ type: 'step' | 'text', text }` in document order.
 */
function parseStepsBlocks(stepsRaw) {
  if (!stepsRaw) return [];
  const stash = [];
  const guarded = stepsRaw.replace(/```[\s\S]*?```/g, (match) => {
    stash.push(match);
    return `STEPCODE${stash.length - 1}`;
  });
  const restore = (s) => s.replace(/STEPCODE(\d+)/g, (_, i) => stash[+i]);
  const marker = /^\d+\.\s+/m;
  const firstIdx = guarded.search(marker);

  const blocks = [];
  // Everything before the first numbered marker is free-form prose.
  const head = (firstIdx === -1 ? guarded : guarded.slice(0, firstIdx));
  const headText = restore(head).trim();
  if (headText) blocks.push({ type: 'text', text: headText });
  // Each numbered marker starts a step; following non-numbered lines stay
  // attached to it (multi-line steps).
  if (firstIdx !== -1) {
    guarded.slice(firstIdx)
      .split(marker)
      .map((s) => restore(s).trim())
      .filter(Boolean)
      .forEach((text) => blocks.push({ type: 'step', text }));
  }
  return blocks;
}

export function markdownToCard(md) {
  // Sanitize the entire document first — strips empty fences, balances orphans,
  // normalizes line endings. Prevents broken fences from fragmenting steps.
  const clean = sanitizeMarkdown(md);
  const overview     = sanitizeMarkdown(extractSection(clean, 'Overview'));
  const stepsRaw     = extractSection(clean, 'Steps');
  const commandsRaw  = extractSection(clean, 'Technical Notes');

  const stepBlocks = parseStepsBlocks(stepsRaw)
    .map(b => ({ type: b.type, text: sanitizeMarkdown(b.text) }))
    .filter(b => b.text);
  // `steps` stays a flat array of just the numbered step strings, for
  // consumers (progress bar, markdown export) that only care about steps.
  const steps = stepBlocks.filter(b => b.type === 'step').map(b => b.text);

  const commands = [];
  if (commandsRaw) {
    const rH = /###\s+(.+?)\n```(\w+)?\n([\s\S]*?)```/g;
    let m;
    while ((m = rH.exec(commandsRaw)) !== null) {
      const code = m[3].trimEnd();
      if (code) commands.push({ title: m[1].trim(), language: m[2] || 'bash', code });
    }

    if (!commands.length) {
      const rB = /```(\w+)?\n([\s\S]*?)```/g;
      while ((m = rB.exec(commandsRaw)) !== null) {
        const code = m[2].trimEnd();
        if (code) commands.push({ title: '', language: m[1] || 'bash', code });
      }
    }
  }

  return { overview, steps, stepBlocks, commands };
}
