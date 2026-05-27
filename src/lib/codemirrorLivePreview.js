// Obsidian / GitBook-style live preview for CodeMirror Markdown.
//
// Walks the markdown syntax tree, hides the markers (`#`, `**`, `*`, `` ` ``,
// `[`/`]`/`(`/`)`) and applies styled CSS classes so the line renders as the
// rendered output would look. Markers re-appear on whichever line the cursor
// is currently editing so you can still modify the syntax.

import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin, EditorView } from '@codemirror/view';

// Decoration for the marker characters we want hidden — `display:none` plus
// atomic so the cursor jumps past the hidden range as one unit.
const hideMark = Decoration.replace({});

// Per-heading-level line decorations. Tailwind-friendly tokens.
const headingLine = {
  1: Decoration.line({ class: 'cm-md-h1' }),
  2: Decoration.line({ class: 'cm-md-h2' }),
  3: Decoration.line({ class: 'cm-md-h3' }),
  4: Decoration.line({ class: 'cm-md-h4' }),
  5: Decoration.line({ class: 'cm-md-h5' }),
  6: Decoration.line({ class: 'cm-md-h6' }),
};

const blockquoteLine = Decoration.line({ class: 'cm-md-blockquote' });
const emMark = Decoration.mark({ class: 'cm-md-em' });
const strongMark = Decoration.mark({ class: 'cm-md-strong' });
const inlineCodeMark = Decoration.mark({ class: 'cm-md-inline-code' });
const linkMark = Decoration.mark({ class: 'cm-md-link' });
const strikeMark = Decoration.mark({ class: 'cm-md-strike' });

// Fenced code block lines: first/last get a rounded corner; middle lines fill.
const codeBlockFirst  = Decoration.line({ class: 'cm-md-code-line cm-md-code-first' });
const codeBlockMiddle = Decoration.line({ class: 'cm-md-code-line' });
const codeBlockLast   = Decoration.line({ class: 'cm-md-code-line cm-md-code-last' });
const codeBlockSolo   = Decoration.line({ class: 'cm-md-code-line cm-md-code-first cm-md-code-last' });
const codeFenceLine   = Decoration.line({ class: 'cm-md-code-fence' });

// Test if any cursor / selection range touches a [from, to] character span.
// A range "touches" if its anchor or head lies anywhere within (or at either
// boundary of) the span — that's what reveals the markers as the cursor moves.
function selectionTouches(view, from, to) {
  for (const r of view.state.selection.ranges) {
    if (r.from <= to && r.to >= from) return true;
  }
  return false;
}

function buildDecorations(view) {
  // Collect into a flat array then use Decoration.set with sort=true so we
  // don't have to worry about insertion order. RangeSetBuilder requires
  // strictly increasing positions and fails when multiple decorations overlap
  // at the same start position (which is common for emphasis: the Emphasis
  // mark, the opening EmphasisMark, and the line all start at the same `from`).
  const items = [];
  const { state } = view;
  const tree = syntaxTree(state);

  const pushHide = (from, to) => {
    if (from >= to) return;
    if (selectionTouches(view, from, to)) return;
    items.push(hideMark.range(from, to));
  };

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;

        if (/^ATXHeading[1-6]$/.test(name)) {
          const level = +name.slice(-1);
          const line = state.doc.lineAt(node.from);
          items.push(headingLine[level].range(line.from));
          return;
        }

        if (name === 'Blockquote') {
          let pos = node.from;
          while (pos <= node.to) {
            const line = state.doc.lineAt(pos);
            items.push(blockquoteLine.range(line.from));
            if (line.to >= node.to) break;
            pos = line.to + 1;
          }
          return;
        }

        // HeaderMark = leading `#`s. Hide it (plus the trailing space) when
        // the cursor is off the line so the heading text reads cleanly.
        if (name === 'HeaderMark') {
          const line = state.doc.lineAt(node.from);
          if (!selectionTouches(view, line.from, line.to)) {
            const end = Math.min(line.to, node.to + 1);
            items.push(hideMark.range(node.from, end));
          }
          return;
        }

        if (name === 'EmphasisMark' || name === 'StrongEmphasisMark' ||
            name === 'CodeMark' || name === 'InlineCodeMark' ||
            name === 'StrikethroughMark') {
          pushHide(node.from, node.to);
          return;
        }

        if (name === 'Emphasis')       { items.push(emMark.range(node.from, node.to)); return; }
        if (name === 'StrongEmphasis') { items.push(strongMark.range(node.from, node.to)); return; }
        if (name === 'InlineCode')     { items.push(inlineCodeMark.range(node.from, node.to)); return; }
        if (name === 'Strikethrough')  { items.push(strikeMark.range(node.from, node.to)); return; }

        // Fenced code blocks: style each line as a code block. The opening
        // fence (with optional language) and the closing fence are hidden
        // when the cursor isn't inside the block, so it reads as a clean
        // monospaced box.
        if (name === 'FencedCode') {
          const blockFrom = node.from;
          const blockTo = node.to;
          const startLine = state.doc.lineAt(blockFrom);
          const endLine = state.doc.lineAt(blockTo);
          const cursorInside = selectionTouches(view, startLine.from, endLine.to);

          // Walk children to find the fence marks and code lines.
          const cur = node.node.cursor();
          if (cur.firstChild()) {
            do {
              const cn = cur.name;
              if (cn === 'CodeMark') {
                // Hide the entire fence line (``` or ```lang) when cursor isn't inside.
                const fenceLine = state.doc.lineAt(cur.from);
                if (!cursorInside) {
                  items.push(hideMark.range(fenceLine.from, fenceLine.to));
                }
              } else if (cn === 'CodeInfo') {
                if (!cursorInside) items.push(hideMark.range(cur.from, cur.to));
              }
            } while (cur.nextSibling());
          }

          // Style every line in the block (including the fence lines so they
          // share the same background when the cursor reveals them).
          const totalLines = endLine.number - startLine.number + 1;
          for (let ln = startLine.number; ln <= endLine.number; ln++) {
            const line = state.doc.line(ln);
            let deco;
            if (totalLines === 1)                deco = codeBlockSolo;
            else if (ln === startLine.number)    deco = codeBlockFirst;
            else if (ln === endLine.number)      deco = codeBlockLast;
            else                                  deco = codeBlockMiddle;
            items.push(deco.range(line.from));
          }
          return;
        }

        if (name === 'Link') {
          const line = state.doc.lineAt(node.from);
          const cursorOnLine = selectionTouches(view, line.from, line.to);
          if (!cursorOnLine) {
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
              do {
                const cn = cursor.name;
                if (cn === 'LinkMark' || cn === 'URL') {
                  items.push(hideMark.range(cursor.from, cursor.to));
                }
              } while (cursor.nextSibling());
            }
          }
          items.push(linkMark.range(node.from, node.to));
          return;
        }
      },
    });
  }
  return Decoration.set(items, true);
}

export function markdownLivePreview() {
  const plugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = buildDecorations(view); }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  }, {
    decorations: (v) => v.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => {
      const value = view.plugin(plugin);
      return value ? value.decorations : Decoration.none;
    }),
  });
  return plugin;
}
