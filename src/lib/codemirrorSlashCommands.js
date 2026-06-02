// Slash command popup for the markdown page editor.
// Triggered when the user types / at the start of a line or after whitespace.
// Uses @codemirror/autocomplete so keyboard nav (↑↓ Enter Esc) is handled.

import { autocompletion } from '@codemirror/autocomplete';

function applyInsert(view, from, to, text, selectFrom, selectLen) {
  view.dispatch({
    changes: { from, to, insert: text },
    selection:
      selectFrom !== undefined
        ? { anchor: from + selectFrom, head: from + selectFrom + (selectLen ?? 0) }
        : undefined,
  });
  view.focus();
}

const COMMANDS = [
  {
    label: '/card',
    displayLabel: 'Card',
    detail: 'Interactive technique card',
    boost: 10,
    apply: (view, _c, from, to) => {
      // Cursor lands AFTER the fence (not inside the JSON) so the block renders
      // as a real card immediately — editing happens via the card's Edit button.
      const text =
        '```card\n{"title":"New Technique","subtitle":"","tags":[],"accentColor":"cyan","font":null,"overview":"","steps":[],"commands":[],"subsections":[],"subCards":[]}\n```\n';
      applyInsert(view, from, to, text, text.length, 0);
    },
  },
  {
    label: '/steps',
    displayLabel: 'Steps',
    detail: 'Numbered step bubbles (click to mark done)',
    boost: 9,
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '1. ', 3, 0),
  },
  {
    label: '/h1',
    displayLabel: 'Heading 1',
    detail: 'Large section title',
    apply: (view, _c, from, to) => applyInsert(view, from, to, '# ', 2, 0),
  },
  {
    label: '/h2',
    displayLabel: 'Heading 2',
    detail: 'Medium section title',
    apply: (view, _c, from, to) => applyInsert(view, from, to, '## ', 3, 0),
  },
  {
    label: '/h3',
    displayLabel: 'Heading 3',
    detail: 'Subsection title',
    apply: (view, _c, from, to) => applyInsert(view, from, to, '### ', 4, 0),
  },
  {
    label: '/code',
    displayLabel: 'Code block',
    detail: 'Fenced code block',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '```bash\n\n```', 7, 0),
  },
  {
    label: '/divider',
    displayLabel: 'Divider',
    detail: 'Horizontal rule',
    apply: (view, _c, from, to) => applyInsert(view, from, to, '---\n', 4, 0),
  },
  {
    label: '/note',
    displayLabel: 'Note',
    detail: 'Blue informational callout',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '> [!NOTE]\n> ', 12, 0),
  },
  {
    label: '/warning',
    displayLabel: 'Warning',
    detail: 'Orange warning callout',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '> [!WARNING]\n> ', 15, 0),
  },
  {
    label: '/tip',
    displayLabel: 'Tip',
    detail: 'Green tip callout',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '> [!TIP]\n> ', 11, 0),
  },
  {
    label: '/caution',
    displayLabel: 'Caution',
    detail: 'Red caution callout',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '> [!CAUTION]\n> ', 15, 0),
  },
  {
    label: '/table',
    displayLabel: 'Table',
    detail: '3-column markdown table',
    apply: (view, _c, from, to) =>
      applyInsert(
        view, from, to,
        '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |\n',
        2, 'Column 1'.length,
      ),
  },
  {
    label: '/bold',
    displayLabel: 'Bold',
    detail: '**Bold text**',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '****', 2, 0),
  },
  {
    label: '/italic',
    displayLabel: 'Italic',
    detail: '*Italic text*',
    apply: (view, _c, from, to) =>
      applyInsert(view, from, to, '**', 1, 0),
  },
];

export function slashCommands() {
  return autocompletion({
    activateOnTyping: true,
    closeOnBlur: true,
    icons: false,
    override: [
      (context) => {
        const match = context.matchBefore(/\/[a-zA-Z]*/);
        if (!match) return null;
        // Show on first `/` (even with no following chars) or when typing more
        if (match.from === match.to && !context.explicit) return null;

        // Only trigger when / is at the very start of a line or after whitespace.
        if (match.from > 0) {
          const charBefore = context.state.doc.sliceString(match.from - 1, match.from);
          if (!/[\s\n]/.test(charBefore)) return null;
        }

        return {
          from: match.from,
          options: COMMANDS,
          validFor: /^\/[a-zA-Z]*$/,
        };
      },
    ],
  });
}
