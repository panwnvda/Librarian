import React, { memo, useState, useRef, useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';
import { Eye, Pencil } from 'lucide-react';
import MarkdownView from './MarkdownView';

// ─── Theme ────────────────────────────────────────────────────────────────────

const cmTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: '#e8e8e8',
    fontFamily: 'var(--app-font, Inter, sans-serif)',
    fontSize: '15px',
    height: '100%',
  },
  '&.cm-editor': { backgroundColor: 'transparent' },
  '&.cm-editor.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: '1.7',
    padding: '0',
    overflow: 'auto',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    caretColor: '#5b86c8',
    fontFamily: 'inherit',
    padding: '0',
    backgroundColor: 'transparent',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#5b86c8' },
  '.cm-line': { padding: '0' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(91,134,200,0.28) !important',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(255,255,255,0.06)' },
  '.cm-placeholder': { color: '#5a5a5a' },
}, { dark: true });

// ─── Markdown syntax highlighting — Obsidian-like ─────────────────────────────

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.75em', fontWeight: '700', color: '#f3f3f3', lineHeight: '1.25' },
  { tag: t.heading2, fontSize: '1.4em',  fontWeight: '600', color: '#f0f0f0', lineHeight: '1.3' },
  { tag: t.heading3, fontSize: '1.2em',  fontWeight: '600', color: '#e8e8e8' },
  { tag: t.heading4, fontSize: '1.08em', fontWeight: '600', color: '#dcdcdc' },
  { tag: t.heading5, fontWeight: '600',  color: '#dcdcdc' },
  { tag: t.heading6, fontWeight: '600',  color: '#c4c4c4' },

  { tag: t.strong,        fontWeight: '700', color: '#f0f0f0' },
  { tag: t.emphasis,      fontStyle: 'italic', color: '#e0e0e0' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#7a7a7a' },

  { tag: t.monospace, color: '#e1bb6a', fontFamily: '"JetBrains Mono", "Fira Code", monospace' },

  { tag: t.link, color: '#86b0e3' },
  { tag: t.url,  color: '#86b0e3', textDecoration: 'underline' },

  { tag: t.quote, color: '#a0a0a0', fontStyle: 'italic' },
  { tag: t.list,  color: '#7a7a7a' },

  // Dim syntax markers (*, #, _, `)
  { tag: t.processingInstruction, color: '#5a5a5a' },
  { tag: t.contentSeparator,      color: '#3a3a3a' },
  { tag: t.meta,                  color: '#5a5a5a' },
]);

// ─── MarkdownEditor ───────────────────────────────────────────────────────────

function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Type here. Use # for heading, ** for bold, ` for code…',
  minHeight = 200,
  autoFocus = false,
  initialMode = 'edit',
  fill = false,
}) {
  const [mode, setMode] = useState(initialMode === 'preview' ? 'preview' : 'edit');
  const viewRef = useRef(null);

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
    syntaxHighlighting(mdHighlight),
    cmTheme,
    EditorView.lineWrapping,
  ], []);

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
    else if (e.key.toLowerCase() === 'e'){ e.preventDefault(); setMode((m) => m === 'edit' ? 'preview' : 'edit'); }
  }, [wrapSelection]);

  const onCreateEditor = useCallback((view) => {
    viewRef.current = view;
    if (autoFocus) view.focus();
  }, [autoFocus]);

  return (
    <div className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Floating mode toggle — sits in the top-right, doesn't break the surface */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setMode('edit')}
          title="Edit (⌘E to toggle)"
          className={`pointer-events-auto flex h-6 w-6 items-center justify-center rounded transition-colors ${
            mode === 'edit' ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#6e6e6e] hover:bg-white/[0.045] hover:text-[#c4c4c4]'
          }`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          title="Preview (⌘E to toggle)"
          className={`pointer-events-auto flex h-6 w-6 items-center justify-center rounded transition-colors ${
            mode === 'preview' ? 'bg-white/[0.06] text-[#e8e8e8]' : 'text-[#6e6e6e] hover:bg-white/[0.045] hover:text-[#c4c4c4]'
          }`}
        >
          <Eye className="h-3 w-3" />
        </button>
      </div>

      {/* Body — no border, no panel, no background. Just text on the page. */}
      <div style={fill ? undefined : { minHeight }}>
        {mode === 'edit' ? (
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
        ) : (
          <div style={fill ? { height: '100%' } : { minHeight }}>
            {value ? (
              <MarkdownView className="text-[15px]">{value}</MarkdownView>
            ) : (
              <p className="text-[14px] italic text-[#5a5a5a]">Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MarkdownEditor);
