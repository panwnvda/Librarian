import React, { memo, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';
import { markdownLivePreview } from '../lib/codemirrorLivePreview';
import { slashCommands } from '../lib/codemirrorSlashCommands';

// ─── Theme ────────────────────────────────────────────────────────────────────

const cmTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: '#e8e8e8',
    // inherit the wrapper's font so cards/text follow the page's chosen
    // default font (the wrapper sets it), falling back to --app-font via the
    // cascade when no page font is set.
    fontFamily: 'inherit',
    fontSize: '15px',
    // No fixed height: the editor grows with its content so the page's own
    // scroll container (Layout's <main overflow-y-auto>) scrolls — exactly
    // like the BlockNote editor. A fixed `height:100%` here made the editor a
    // nested scroll box ("its own subpage"). Use fill mode for that behavior.
  },
  '&.cm-editor': { backgroundColor: 'transparent' },
  '&.cm-editor.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    // Unitless so spacing scales proportionally with font size.
    lineHeight: '2.1',
    padding: '0',
    // visible (not auto) so the editor never creates its own scrollbars; with
    // lineWrapping the content fits the width and grows in height instead.
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    caretColor: '#5b86c8',
    fontFamily: 'inherit',
    padding: '0',
    backgroundColor: 'transparent',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#5b86c8', borderLeftWidth: '2px' },
  '.cm-line': { padding: '0' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(91,134,200,0.32) !important',
  },
  '&.cm-focused .cm-selectionBackground ::selection, ::selection': {
    backgroundColor: 'rgba(91,134,200,0.32) !important',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.024)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(255,255,255,0.06)' },
  '.cm-placeholder': { color: '#5a5a5a' },
}, { dark: true });

// Optional left gutter for block widgets (cards). It pads .cm-content so the
// content's left edge sits 3.5rem in from the scroller; card widgets then place
// their +/⋮⋮ controls in that strip with a negative offset. The padding lives
// INSIDE .cm-content's box (between the scroller's clip edge and the content),
// so the controls aren't clipped by .cm-scroller's overflow:auto the way a
// negative-margin gutter would be. Doubled selector beats the base theme's
// `.cm-content { padding: 0 }` regardless of CM's style-injection order.
const blockGutterTheme = EditorView.theme({
  '.cm-content.cm-content': { paddingLeft: '3.5rem' },
});

// fill mode: the editor fills its parent and scrolls internally (e.g. a fixed
// split pane). Restores the height/overflow the base theme intentionally omits.
const fillTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
});

// Heading sizes flow from the line decoration (cm-md-h1, …) so we don't
// double-apply font-size here. The remaining markdown tokens stay subtle so
// they don't fight the live-preview styling for the same content.
//
// Tags below `// ── code tokens ──` light up code INSIDE fenced ``` blocks.
// @codemirror/lang-markdown nests the inner language's parser (via
// codeLanguages: languages) and emits the standard Lezer highlight tags
// (keyword, string, comment, ...). Without these rules code rendered as
// plain text. Palette matches the card editor's CodeBlock and toolkit
// Shiki theme so the same snippet looks identical wherever it appears.
const mdHighlight = HighlightStyle.define([
  // ── markdown-level tokens ─────────────────────────────────────────────
  { tag: t.monospace, color: '#e1bb6a', fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
  { tag: t.link, color: '#86b0e3' },
  { tag: t.url,  color: '#86b0e3', textDecoration: 'underline' },
  { tag: t.quote, color: '#a0a0a0', fontStyle: 'italic' },
  { tag: t.list,  color: '#7a7a7a' },
  { tag: t.processingInstruction, color: '#5a5a5a' },
  { tag: t.contentSeparator,      color: '#3a3a3a' },
  { tag: t.meta,                  color: '#5a5a5a' },
  // ── code tokens (inside ``` fenced blocks) ────────────────────────────
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: '#64748b', fontStyle: 'italic' },
  { tag: [t.string, t.special(t.string), t.regexp, t.character],
    color: '#fde68a' },
  { tag: [t.number, t.integer, t.float, t.bool, t.null],
    color: '#fdba74' },
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier, t.definitionKeyword],
    color: '#6ee7b7' },
  { tag: [t.typeName, t.className, t.namespace, t.self],
    color: '#f0abfc' },
  { tag: [t.variableName, t.propertyName, t.attributeName],
    color: '#7dd3fc' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName],
    color: '#f0abfc' },
  { tag: [t.operator, t.punctuation, t.bracket, t.brace, t.paren, t.derefOperator, t.separator],
    color: '#94a3b8' },
  { tag: [t.tagName, t.angleBracket],
    color: '#7dd3fc' },
  { tag: [t.escape, t.special(t.escape)],
    color: '#fde68a', fontWeight: 'bold' },
  { tag: [t.invalid],
    color: '#e89797', fontStyle: 'italic' },
]);

const MarkdownEditor = forwardRef(function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Type here. Use # for heading, ** for bold, ` for code…',
  minHeight = 200,
  autoFocus = false,
  fill = false,
  enableSlashCommands = false,
  blockGutter = false,
}, externalRef) {
  const viewRef = useRef(null);

  // Imperative API used by callers (the card editor's toolbar) to dispatch
  // edits directly to CodeMirror. Mirrors what the toolbar used to do against
  // a textarea's selectionStart/End + setRangeText.
  useImperativeHandle(externalRef, () => ({
    getView: () => viewRef.current,
    focus: () => viewRef.current?.focus(),
    getSelection: () => {
      const v = viewRef.current;
      if (!v) return { from: 0, to: 0, text: '' };
      const { from, to } = v.state.selection.main;
      return { from, to, text: v.state.doc.sliceString(from, to) };
    },
    setSelection: (from, to = from) => {
      const v = viewRef.current;
      if (!v) return;
      v.dispatch({ selection: { anchor: from, head: to } });
      v.focus();
    },
    insertAt: (from, to, insert, anchor) => {
      const v = viewRef.current;
      if (!v) return;
      v.dispatch({
        changes: { from, to, insert },
        selection: anchor !== undefined ? { anchor, head: anchor } : undefined,
      });
      v.focus();
    },
    wrap: (before, after = before) => {
      const v = viewRef.current;
      if (!v) return;
      const { from, to } = v.state.selection.main;
      const sel = v.state.doc.sliceString(from, to);
      v.dispatch({
        changes: { from, to, insert: before + sel + after },
        selection: { anchor: from + before.length, head: from + before.length + sel.length },
      });
      v.focus();
    },
    insertLinePrefix: (prefix) => {
      const v = viewRef.current;
      if (!v) return;
      const { from } = v.state.selection.main;
      const line = v.state.doc.lineAt(from);
      v.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
        selection: { anchor: from + prefix.length, head: from + prefix.length },
      });
      v.focus();
    },
  }), []);

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
    syntaxHighlighting(mdHighlight),
    markdownLivePreview(),
    cmTheme,
    ...(blockGutter ? [blockGutterTheme] : []),
    ...(fill ? [fillTheme] : []),
    EditorView.lineWrapping,
    ...(enableSlashCommands ? [slashCommands()] : []),
  ], [enableSlashCommands, blockGutter, fill]);

  const wrapSelection = useCallback((before, after = before) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.doc.sliceString(from, to);
    view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
    view.focus();
  }, []);

  const handleKeyDown = useCallback((e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    if (e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSelection('**'); }
    else if (e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSelection('*'); }
    else if (e.key === '`')              { e.preventDefault(); wrapSelection('`'); }
    else if (e.key.toLowerCase() === 'k'){ e.preventDefault(); wrapSelection('[', '](url)'); }
  }, [wrapSelection]);

  const onCreateEditor = useCallback((view) => {
    viewRef.current = view;
    if (autoFocus) view.focus();
  }, [autoFocus]);

  return (
    <div className="relative w-full" onKeyDown={handleKeyDown}>
      <div style={fill ? undefined : { minHeight }}>
        <CodeMirror
          value={value || ''}
          onChange={onChange}
          extensions={extensions}
          onCreateEditor={onCreateEditor}
          theme="none"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            dropCursor: true,
            indentOnInput: true,
            syntaxHighlighting: false,
            bracketMatching: false,
            closeBrackets: false,
            autocompletion: false,
            searchKeymap: false,
          }}
          placeholder={placeholder}
          height={fill ? '100%' : undefined}
          style={fill ? { height: '100%' } : { minHeight }}
        />
      </div>
    </div>
  );
});

export default memo(MarkdownEditor);
