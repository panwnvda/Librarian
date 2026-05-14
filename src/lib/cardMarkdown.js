// Shared serialise / parse helpers for technique card ↔ markdown document.

export const CARD_COLOR_OPTIONS = [
  { value: 'cyan',    dot: 'bg-cyan-500' },
  { value: 'green',   dot: 'bg-emerald-500' },
  { value: 'red',     dot: 'bg-red-500' },
  { value: 'purple',  dot: 'bg-purple-500' },
  { value: 'orange',  dot: 'bg-orange-500' },
  { value: 'pink',    dot: 'bg-pink-500' },
  { value: 'blue',    dot: 'bg-blue-500' },
  { value: 'yellow',  dot: 'bg-yellow-500' },
  { value: 'teal',    dot: 'bg-teal-500' },
  { value: 'indigo',  dot: 'bg-indigo-500' },
  { value: 'lime',    dot: 'bg-lime-500' },
  { value: 'rose',    dot: 'bg-rose-500' },
  { value: 'amber',   dot: 'bg-amber-500' },
  { value: 'violet',  dot: 'bg-violet-500' },
  { value: 'sky',     dot: 'bg-sky-500' },
  { value: 'fuchsia', dot: 'bg-fuchsia-500' },
];

// Default body for a new card. Kept intentionally minimal — only the
// `## Overview` and `## Steps` headings, no Technical Notes section (users
// add that themselves with the toolbar's Code Block button under a
// `## Technical Notes` heading when they want it). The Steps section has
// no starter step either; the Steps toolbar button seeds the first one
// on demand.
export const BLANK_BODY = '## Overview\n\n\n## Steps\n\n';

// Invisible HTML comment used to delimit steps in the round-trip markdown.
// Survives any internal `\n\n` (paragraphs, blank lines between command groups
// inside a code block, etc.) which the old `\n{2,}` splitter shredded.
const STEP_SEP_TOKEN = '<!--step-->';
const STEP_SEP       = `\n\n${STEP_SEP_TOKEN}\n\n`;

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
  // Collapse 3+ blank-line runs.
  s = s.replace(/\n{3,}/g, '\n\n');
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
  const steps = (card.steps || []).map(sanitizeMarkdown).filter(Boolean);
  parts.push(`## Steps\n${steps.join(STEP_SEP)}`);
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
 * Split a Steps blob into individual steps WITHOUT shredding code blocks.
 * Prefers the explicit `<!--step-->` token. If absent (e.g. a card produced
 * by an older version of the app), falls back to splitting on `\n{2,}` but
 * first hides any fenced code block so its internal blank lines are immune.
 */
function splitSteps(stepsRaw) {
  if (!stepsRaw) return [];
  if (stepsRaw.includes(STEP_SEP_TOKEN)) {
    return stepsRaw
      .split(STEP_SEP_TOKEN)
      .map(s => s.trim())
      .filter(Boolean);
  }
  // Backward-compat path: protect ``` ... ``` regions from the split.
  const stash = [];
  const placeholder = (i) => `STEPCODE${i}`;
  const guarded = stepsRaw.replace(/```[\s\S]*?```/g, (match) => {
    stash.push(match);
    return placeholder(stash.length - 1);
  });
  return guarded
    .split(/\n{2,}/)
    .map(s => s.replace(/STEPCODE(\d+)/g, (_, i) => stash[+i]).trim())
    .filter(Boolean);
}

export function markdownToCard(md) {
  // Sanitize the entire document first — strips empty fences, balances orphans,
  // normalizes line endings. Prevents broken fences from fragmenting steps.
  const clean = sanitizeMarkdown(md);
  const overview     = sanitizeMarkdown(extractSection(clean, 'Overview'));
  const stepsRaw     = extractSection(clean, 'Steps');
  const commandsRaw  = extractSection(clean, 'Technical Notes');

  const steps = splitSteps(stepsRaw).map(sanitizeMarkdown).filter(Boolean);

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

  return { overview, steps, commands };
}
