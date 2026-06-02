// Obsidian / GitBook-style live preview for CodeMirror Markdown.
//
// Hides syntax markers and applies styled CSS classes so lines render as the
// formatted output. Markers re-appear on the cursor line so they stay editable.
//
// Also handles two special fenced block types:
//   ```card  → renders a full TechniqueCard + CardEditorPage widget
//   (bullet list under ## Steps) → clickable numbered step-bubble circles

import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin, EditorView, WidgetType } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { CardWidget } from './codemirrorCardWidget.jsx';

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
    const el = this._buildEl(view);
    return el;
  }

  // Update the existing DOM element in-place so CSS transitions animate.
  updateDOM(dom, view) {
    const shouldBeDone = this.done;
    const wasDone = dom.classList.contains('cm-step-done');
    if (shouldBeDone !== wasDone) {
      dom.classList.toggle('cm-step-done', shouldBeDone);
      dom.title = shouldBeDone ? 'Click to unmark' : 'Click to mark done';
    }
    return true;
  }

  _buildEl(view) {
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

function selectionTouches(view, from, to, exclusive = false) {
  for (const r of view.state.selection.ranges) {
    if (exclusive) {
      if (r.from < to && r.to > from) return true;
    } else {
      if (r.from <= to && r.to >= from) return true;
    }
  }
  return false;
}

// Returns true when a BulletList at listFrom is directly under a `## Steps` heading.
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

  try {
  for (const { from, to } of view.visibleRanges) {
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

        // ── Fenced code blocks (and card blocks) ───────────────────────────
        if (name === 'FencedCode') {
          const startLine = state.doc.lineAt(node.from);
          const endLine   = state.doc.lineAt(node.to);

          // Gather CodeInfo (language) and CodeText (content) from children.
          let codeInfo = '';
          const contentLines = [];
          const cur = node.node.cursor();
          if (cur.firstChild()) {
            do {
              if (cur.name === 'CodeInfo') {
                codeInfo = state.doc.sliceString(cur.from, cur.to).trim().toLowerCase();
              }
            } while (cur.nextSibling());
          }

          // ── Card fence ─────────────────────────────────────────────────
          // The rendered card is a BLOCK widget, which CodeMirror only allows
          // from a StateField (see cardField below) — NOT from a plugin. So the
          // plugin only handles the cursor-inside case: show the raw fence as a
          // plain code block so the JSON is readable/editable. When the cursor
          // is outside, cardField paints the TechniqueCard widget instead.
          if (codeInfo === 'card') {
            const cursorStrictlyInside = selectionTouches(
              view, startLine.from + 1, endLine.to - 1, true,
            );
            if (cursorStrictlyInside) {
              for (let ln = startLine.number; ln <= endLine.number; ln++) {
                const line = state.doc.line(ln);
                let deco;
                const totalLines = endLine.number - startLine.number + 1;
                if (totalLines === 1)             deco = codeBlockSolo;
                else if (ln === startLine.number) deco = codeBlockFirst;
                else if (ln === endLine.number)   deco = codeBlockLast;
                else                               deco = codeBlockMiddle;
                items.push(deco.range(line.from));
              }
            }
            return;
          }

          // ── Normal fenced code block ───────────────────────────────────
          const cursorInside = selectionTouches(view, startLine.from, endLine.to);
          const cur2 = node.node.cursor();
          if (cur2.firstChild()) {
            do {
              if (cur2.name === 'CodeMark') {
                const fenceLine = state.doc.lineAt(cur2.from);
                if (!cursorInside) items.push(hideMark.range(fenceLine.from, fenceLine.to));
              } else if (cur2.name === 'CodeInfo') {
                if (!cursorInside) items.push(hideMark.range(cur2.from, cur2.to));
              }
            } while (cur2.nextSibling());
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
        // Any ordered list renders as clickable numbered step bubbles — no
        // heading required. A bullet list still qualifies when it sits directly
        // under a `## Steps` heading, kept for back-compat with older notes.
        if (name === 'OrderedList') {
          inStepsList = true;
          stepNum = 0;
          return;
        }

        if (name === 'BulletList') {
          if (isStepsList(state, node.from)) {
            inStepsList = true;
            stepNum = 0;
          }
          return;
        }

        if (name === 'ListItem' && inStepsList) {
          stepNum++;
          return;
        }

        if (name === 'ListMark' && inStepsList) {
          const line     = state.doc.lineAt(node.from);
          const lineFrom = line.from;
          const done     = completedSteps.has(lineFrom);

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
        if ((node.name === 'BulletList' || node.name === 'OrderedList') && inStepsList) {
          inStepsList = false;
          stepNum = 0;
        }
      },
    });
  }
  } catch (err) {
    console.error('markdownLivePreview: decoration build failed', err);
    return Decoration.none;
  }

  try {
    return Decoration.set(items, true);
  } catch (err) {
    console.error('markdownLivePreview: decoration set failed', err);
    return Decoration.none;
  }
}

// ── Card block widgets (StateField) ────────────────────────────────────────────
//
// Block-replacing decorations (the rendered ```card widget spans several lines)
// MUST come from a StateField — CodeMirror throws "Block decorations may not be
// specified via plugins" if a ViewPlugin tries to provide them. So cards live
// here, separate from the inline/line decorations in the plugin above.

function selectionTouchesState(state, from, to) {
  for (const r of state.selection.ranges) {
    if (r.from < to && r.to > from) return true;
  }
  return false;
}

// Cheap "does the doc contain a ```card fence?" check, cached by doc identity
// (docs are immutable, so every cursor move within one doc state reuses the
// result). Lets cardField skip the syntax-tree walk on selection changes in
// the common card-less case.
let _cardScanDoc = null;
let _cardScanHas = false;
function docHasCardFence(state) {
  if (state.doc === _cardScanDoc) return _cardScanHas;
  let found = false;
  syntaxTree(state).iterate({
    enter(node) {
      if (found) return false;
      if (node.name === 'CodeInfo') {
        if (state.doc.sliceString(node.from, node.to).trim().toLowerCase() === 'card') found = true;
        return false;
      }
    },
  });
  _cardScanDoc = state.doc;
  _cardScanHas = found;
  return found;
}

function buildCardDecorations(state) {
  const items = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return;

      let codeInfo = '';
      const cur = node.node.cursor();
      if (cur.firstChild()) {
        do {
          if (cur.name === 'CodeInfo') {
            codeInfo = state.doc.sliceString(cur.from, cur.to).trim().toLowerCase();
          }
        } while (cur.nextSibling());
      }
      if (codeInfo !== 'card') return;

      const startLine = state.doc.lineAt(node.from);
      const endLine   = state.doc.lineAt(node.to);

      // Cursor strictly inside → leave raw so the plugin styles it as editable
      // JSON. Exclusive bounds so a cursor parked at startLine.from (where the
      // atomic range lands after a click) still shows the rendered card.
      if (selectionTouchesState(state, startLine.from + 1, endLine.to - 1)) return;

      const jsonLines = [];
      for (let ln = startLine.number + 1; ln < endLine.number; ln++) {
        jsonLines.push(state.doc.line(ln).text);
      }
      const json = jsonLines.join('\n').trim();
      const blockEnd = Math.min(endLine.to + 1, state.doc.length);
      items.push(
        Decoration.replace({
          widget: new CardWidget(json, startLine.from, endLine.to),
          block: true,
        }).range(startLine.from, blockEnd),
      );
    },
  });

  try {
    return Decoration.set(items, true);
  } catch (err) {
    console.error('markdownLivePreview: card decoration set failed', err);
    return Decoration.none;
  }
}

const cardField = StateField.define({
  create: (state) => buildCardDecorations(state),
  update(value, tr) {
    if (tr.docChanged) return buildCardDecorations(tr.state);
    // Selection-only: only re-evaluate (rendered ↔ raw) if a card exists.
    if (tr.selection && docHasCardFence(tr.state)) return buildCardDecorations(tr.state);
    return value;
  },
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.atomicRanges.of((view) => view.state.field(f) || Decoration.none),
  ],
});

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

  return [stepsField, cardField, plugin];
}
