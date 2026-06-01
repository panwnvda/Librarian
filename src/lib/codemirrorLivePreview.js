// Obsidian / GitBook-style live preview for CodeMirror Markdown.
//
// Walks the markdown syntax tree, hides the markers (`#`, `**`, `*`, `` ` ``,
// `[`/`]`/`(`/`)`) and applies styled CSS classes so the line renders as the
// rendered output would look. Markers re-appear on whichever line the cursor
// is currently editing so you can still modify the syntax.
//
// Also renders clickable numbered step-bubbles for `- ` items under a `## Steps`
// heading, matching the StepsBlock in MarkdownView / TechniqueCard.

import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin, EditorView, WidgetType } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

// ── Step bubble state ─────────────────────────────────────────────────────────

const toggleStep = StateEffect.define();

const stepsField = StateField.define({
  create: () => new Set(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(toggleStep)) {
        const next = new Set(value);
        next.has(e.value) ? next.delete(e.value) : next.add(e.value);
        return next;
      }
    }
    return value;
  },
});

class StepBubble extends WidgetType {
  constructor(num, lineFrom, done) {
    super();
    this.num = num;
    this.lineFrom = lineFrom;
    this.done = done;
  }
  toDOM(view) {
    const el = document.createElement('span');
    el.className = 'cm-step-bubble' + (this.done ? ' cm-step-done' : '');
    el.textContent = String(this.num);
    el.contentEditable = 'false';
    el.title = this.done ? 'Click to unmark' : 'Click to mark done';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: [toggleStep.of(this.lineFrom)] });
    });
    return el;
  }
  eq(other) {
    return other instanceof StepBubble &&
      other.num === this.num &&
      other.lineFrom === this.lineFrom &&
      other.done === this.done;
  }
  ignoreEvent(e) { return e.type !== 'mousedown'; }
}

// ── Decoration constants ──────────────────────────────────────────────────────

const hideMark = Decoration.replace({});

const headingLine = {
  1: Decoration.line({ class: 'cm-md-h1' }),
  2: Decoration.line({ class: 'cm-md-h2' }),
  3: Decoration.line({ class: 'cm-md-h3' }),
  4: Decoration.line({ class: 'cm-md-h4' }),
  5: Decoration.line({ class: 'cm-md-h5' }),
  6: Decoration.line({ class: 'cm-md-h6' }),
};

const blockquoteLine = Decoration.line({ class: 'cm-md-blockquote' });
const emMark         = Decoration.mark({ class: 'cm-md-em' });
const strongMark     = Decoration.mark({ class: 'cm-md-strong' });
const inlineCodeMark = Decoration.mark({ class: 'cm-md-inline-code' });
const linkMark       = Decoration.mark({ class: 'cm-md-link' });
const strikeMark     = Decoration.mark({ class: 'cm-md-strike' });

const codeBlockFirst  = Decoration.line({ class: 'cm-md-code-line cm-md-code-first' });
const codeBlockMiddle = Decoration.line({ class: 'cm-md-code-line' });
const codeBlockLast   = Decoration.line({ class: 'cm-md-code-line cm-md-code-last' });
const codeBlockSolo   = Decoration.line({ class: 'cm-md-code-line cm-md-code-first cm-md-code-last' });

const stepDoneLine = Decoration.line({ class: 'cm-step-done-line' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function selectionTouches(view, from, to) {
  for (const r of view.state.selection.ranges) {
    if (r.from <= to && r.to >= from) return true;
  }
  return false;
}

// Check if a BulletList starting at `listFrom` is directly under a `## Steps` heading.
// Scans backward through blank lines to the nearest non-blank line.
function isStepsList(state, listFrom) {
  const listLine = state.doc.lineAt(listFrom);
  for (let n = listLine.number - 1; n >= Math.max(1, listLine.number - 5); n--) {
    const line = state.doc.line(n);
    if (line.text.trim() === '') continue;
    return /^##\s+Steps\s*$/i.test(line.text);
  }
  return false;
}

// ── Decoration builder ────────────────────────────────────────────────────────

function buildDecorations(view) {
  const items = [];
  const { state } = view;
  const tree = syntaxTree(state);
  const completedSteps = state.field(stepsField);

  const pushHide = (from, to) => {
    if (from >= to) return;
    if (selectionTouches(view, from, to)) return;
    items.push(hideMark.range(from, to));
  };

  for (const { from, to } of view.visibleRanges) {
    // Step bubble tracking — reset per visible range so partial scrolls work.
    let inStepsList = false;
    let stepNum = 0;

    tree.iterate({
      from,
      to,
      enter(node) {
        const name = node.name;

        // ── Headings ───────────────────────────────────────────────────────
        if (/^ATXHeading[1-6]$/.test(name)) {
          const level = +name.slice(-1);
          const line = state.doc.lineAt(node.from);
          items.push(headingLine[level].range(line.from));
          return; // keep descending so HeaderMark is visited
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

        if (name === 'HeaderMark') {
          const line = state.doc.lineAt(node.from);
          if (!selectionTouches(view, line.from, line.to)) {
            const end = Math.min(line.to, node.to + 1);
            items.push(hideMark.range(node.from, end));
          }
          return;
        }

        // ── Inline marks ───────────────────────────────────────────────────
        if (name === 'EmphasisMark' || name === 'StrongEmphasisMark' ||
            name === 'CodeMark'     || name === 'InlineCodeMark'     ||
            name === 'StrikethroughMark') {
          pushHide(node.from, node.to);
          return;
        }

        if (name === 'Emphasis')       { items.push(emMark.range(node.from, node.to)); return; }
        if (name === 'StrongEmphasis') { items.push(strongMark.range(node.from, node.to)); return; }
        if (name === 'InlineCode')     { items.push(inlineCodeMark.range(node.from, node.to)); return; }
        if (name === 'Strikethrough')  { items.push(strikeMark.range(node.from, node.to)); return; }

        // ── Fenced code blocks ─────────────────────────────────────────────
        if (name === 'FencedCode') {
          const startLine = state.doc.lineAt(node.from);
          const endLine   = state.doc.lineAt(node.to);
          const cursorInside = selectionTouches(view, startLine.from, endLine.to);

          const cur = node.node.cursor();
          if (cur.firstChild()) {
            do {
              if (cur.name === 'CodeMark') {
                const fenceLine = state.doc.lineAt(cur.from);
                if (!cursorInside) items.push(hideMark.range(fenceLine.from, fenceLine.to));
              } else if (cur.name === 'CodeInfo') {
                if (!cursorInside) items.push(hideMark.range(cur.from, cur.to));
              }
            } while (cur.nextSibling());
          }

          const totalLines = endLine.number - startLine.number + 1;
          for (let ln = startLine.number; ln <= endLine.number; ln++) {
            const line = state.doc.line(ln);
            let deco;
            if (totalLines === 1)             deco = codeBlockSolo;
            else if (ln === startLine.number) deco = codeBlockFirst;
            else if (ln === endLine.number)   deco = codeBlockLast;
            else                               deco = codeBlockMiddle;
            items.push(deco.range(line.from));
          }
          return;
        }

        // ── Links ──────────────────────────────────────────────────────────
        if (name === 'Link') {
          const line = state.doc.lineAt(node.from);
          const cursorOnLine = selectionTouches(view, line.from, line.to);
          if (!cursorOnLine) {
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
              do {
                const cn = cursor.name;
                if (cn === 'LinkMark' || cn === 'URL') items.push(hideMark.range(cursor.from, cursor.to));
              } while (cursor.nextSibling());
            }
          }
          items.push(linkMark.range(node.from, node.to));
          return;
        }

        // ── Step bubbles ───────────────────────────────────────────────────
        // A BulletList (`- ` items) immediately under a `## Steps` heading
        // is rendered as interactive numbered circles, matching MarkdownView.
        if (name === 'BulletList') {
          if (isStepsList(state, node.from)) {
            inStepsList = true;
            stepNum = 0;
          }
          return; // descend into ListItem / ListMark children
        }

        if (name === 'ListItem' && inStepsList) {
          stepNum++;
          return;
        }

        if (name === 'ListMark' && inStepsList) {
          const line     = state.doc.lineAt(node.from);
          const lineFrom = line.from;
          const done     = completedSteps.has(lineFrom);

          // Only replace the mark with a bubble when the cursor is off this line
          // so the user can still edit the `- ` syntax when they click the line.
          if (!selectionTouches(view, line.from, line.to)) {
            items.push(
              Decoration.replace({ widget: new StepBubble(stepNum, lineFrom, done) })
                .range(node.from, node.to),
            );
          }
          if (done) items.push(stepDoneLine.range(lineFrom));
          return;
        }
      },

      leave(node) {
        if (node.name === 'BulletList' && inStepsList) {
          inStepsList = false;
          stepNum = 0;
        }
      },
    });
  }

  return Decoration.set(items, true);
}

// ── Plugin export ─────────────────────────────────────────────────────────────

export function markdownLivePreview() {
  const plugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = buildDecorations(view); }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet ||
          update.state.field(stepsField) !== update.startState.field(stepsField)) {
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

  // Return both the StateField (for completed-step tracking) and the plugin
  // as a flat extension array so callers don't need to register them separately.
  return [stepsField, plugin];
}
