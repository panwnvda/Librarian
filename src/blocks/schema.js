import { BlockNoteSchema, defaultBlockSpecs, defaultStyleSpecs, createCodeBlockSpec } from '@blocknote/core';
import { CardBlock } from './CardBlock';
import { MapBlock } from './MapBlock';
import { PageLinkBlock } from './PageLinkBlock';
import { ReportBlock } from './ReportBlock';
import { FontSize } from './FontSize';
import { FontFamily } from './FontFamily';
import { TextColor } from './TextColor';
import { BgColor } from './BgColor';

// Languages supported in the code-block picker. Keys are CANONICAL Shiki language IDs
// (use aliases in the `aliases` field, not the key, so Shiki actually loads the grammar).
const SUPPORTED_LANGUAGES = {
  text:        { name: 'Plain text',  aliases: ['txt', 'plain'] },
  shellscript: { name: 'Bash / Shell', aliases: ['bash', 'sh', 'zsh', 'shell'] },
  powershell:  { name: 'PowerShell',  aliases: ['ps', 'ps1', 'pwsh'] },
  python:      { name: 'Python',      aliases: ['py'] },
  javascript:  { name: 'JavaScript',  aliases: ['js', 'jsx'] },
  typescript:  { name: 'TypeScript',  aliases: ['ts', 'tsx'] },
  json:        { name: 'JSON',        aliases: [] },
  yaml:        { name: 'YAML',        aliases: ['yml'] },
  html:        { name: 'HTML',        aliases: [] },
  css:         { name: 'CSS',         aliases: [] },
  c:           { name: 'C',           aliases: [] },
  cpp:         { name: 'C++',         aliases: ['c++'] },
  csharp:      { name: 'C#',          aliases: ['cs'] },
  go:          { name: 'Go',          aliases: ['golang'] },
  rust:        { name: 'Rust',        aliases: ['rs'] },
  java:        { name: 'Java',        aliases: [] },
  php:         { name: 'PHP',         aliases: [] },
  ruby:        { name: 'Ruby',        aliases: ['rb'] },
  sql:         { name: 'SQL',         aliases: [] },
  markdown:    { name: 'Markdown',    aliases: ['md'] },
  docker:      { name: 'Dockerfile',  aliases: ['dockerfile'] },
  ini:         { name: 'INI / Config',aliases: ['conf'] },
  xml:         { name: 'XML',         aliases: [] },
  diff:        { name: 'Diff',        aliases: [] },
  regexp:      { name: 'RegExp',      aliases: ['regex'] },
};

// Custom Shiki theme that mirrors the card editor's CodeBlock palette.
// Built by cloning github-dark-default's complete scope coverage (40+ rules
// covering every common token type — keywords, strings, comments, regex,
// markdown, diff, etc.) and swapping only the hex codes:
//
//   github-dark-default        →  CodeBlock palette
//   ─────────────────────────────────────────────────
//   #8b949e (comments)         →  #64748b (slate-500, italic)
//   #ff7b72 (keywords)         →  #6ee7b7 (emerald-300)
//   #79c0ff (constants/vars)   →  #7dd3fc (sky-300)
//   #ffa657 (entities)         →  #fdba74 (orange-300)
//   #d2a8ff (functions)        →  #f0abfc (fuchsia-300)
//   #7ee787 (tags / inserts)   →  #6ee7b7 (emerald-300)
//   #a5d6ff (strings / regex)  →  #fde68a (amber-200)
//   #e6edf3 (default fg)       →  #e8e8e8
//   #ffa198 (invalid)          →  #e89797
//   bg #0d1117                 →  #181818
const librarianDarkTheme = {
  name: 'librarian-dark',
  displayName: 'Librarian Dark',
  type: 'dark',
  semanticHighlighting: true,
  colors: {
    'editor.background': '#181818',
    'editor.foreground': '#e8e8e8',
    'editor.lineHighlightBackground': '#6e76811a',
    'editor.selectionBackground': '#5b86c847',
    'editorCursor.foreground': '#5b86c8',
  },
  bg: '#181818',
  fg: '#e8e8e8',
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { foreground: '#64748b', fontStyle: 'italic' } },
    { scope: ['constant.other.placeholder', 'constant.character'],
      settings: { foreground: '#6ee7b7' } },
    { scope: ['constant', 'entity.name.constant', 'variable.other.constant', 'variable.other.enummember', 'variable.language', 'entity'],
      settings: { foreground: '#7dd3fc' } },
    { scope: ['constant.numeric'],
      settings: { foreground: '#fdba74' } },
    { scope: ['entity.name', 'meta.export.default', 'meta.definition.variable'],
      settings: { foreground: '#fdba74' } },
    { scope: ['variable.parameter.function', 'meta.jsx.children', 'meta.block', 'meta.tag.attributes', 'entity.name.constant', 'meta.object.member', 'meta.embedded.expression'],
      settings: { foreground: '#e8e8e8' } },
    { scope: 'entity.name.function',
      settings: { foreground: '#f0abfc' } },
    { scope: ['entity.name.tag', 'support.class.component'],
      settings: { foreground: '#6ee7b7' } },
    { scope: 'keyword',
      settings: { foreground: '#6ee7b7' } },
    { scope: ['storage', 'storage.type'],
      settings: { foreground: '#6ee7b7' } },
    { scope: ['storage.modifier.package', 'storage.modifier.import', 'storage.type.java'],
      settings: { foreground: '#e8e8e8' } },
    { scope: ['string', 'string punctuation.section.embedded source'],
      settings: { foreground: '#fde68a' } },
    { scope: 'support',
      settings: { foreground: '#7dd3fc' } },
    { scope: 'meta.property-name',
      settings: { foreground: '#7dd3fc' } },
    { scope: 'variable',
      settings: { foreground: '#fdba74' } },
    { scope: 'variable.other',
      settings: { foreground: '#e8e8e8' } },
    { scope: 'invalid.broken',
      settings: { foreground: '#e89797', fontStyle: 'italic' } },
    { scope: 'invalid.deprecated',
      settings: { foreground: '#e89797', fontStyle: 'italic' } },
    { scope: 'invalid.illegal',
      settings: { foreground: '#e89797', fontStyle: 'italic' } },
    { scope: 'invalid.unimplemented',
      settings: { foreground: '#e89797', fontStyle: 'italic' } },
    { scope: 'message.error',
      settings: { foreground: '#e89797' } },
    { scope: 'string variable',
      settings: { foreground: '#7dd3fc' } },
    { scope: ['source.regexp', 'string.regexp'],
      settings: { foreground: '#fde68a' } },
    { scope: ['string.regexp.character-class', 'string.regexp constant.character.escape', 'string.regexp source.ruby.embedded', 'string.regexp string.regexp.arbitrary-repitition'],
      settings: { foreground: '#fde68a' } },
    { scope: 'string.regexp constant.character.escape',
      settings: { foreground: '#6ee7b7', fontStyle: 'bold' } },
    { scope: 'support.constant',
      settings: { foreground: '#7dd3fc' } },
    { scope: 'support.variable',
      settings: { foreground: '#7dd3fc' } },
    { scope: 'support.type.property-name.json',
      settings: { foreground: '#6ee7b7' } },
    { scope: 'meta.module-reference',
      settings: { foreground: '#7dd3fc' } },
    { scope: 'punctuation.definition.list.begin.markdown',
      settings: { foreground: '#fdba74' } },
    { scope: ['markup.heading', 'markup.heading entity.name'],
      settings: { foreground: '#7dd3fc', fontStyle: 'bold' } },
    { scope: 'markup.quote',
      settings: { foreground: '#6ee7b7' } },
    { scope: 'markup.italic',
      settings: { foreground: '#e8e8e8', fontStyle: 'italic' } },
    { scope: 'markup.bold',
      settings: { foreground: '#e8e8e8', fontStyle: 'bold' } },
    { scope: ['markup.underline'],
      settings: { fontStyle: 'underline' } },
    { scope: ['markup.strikethrough'],
      settings: { fontStyle: 'strikethrough' } },
    { scope: 'markup.inline.raw',
      settings: { foreground: '#fde68a' } },
    { scope: ['markup.deleted', 'meta.diff.header.from-file', 'punctuation.definition.deleted'],
      settings: { foreground: '#e89797', background: '#490202' } },
    { scope: ['punctuation.section.embedded'],
      settings: { foreground: '#6ee7b7' } },
    { scope: ['markup.inserted', 'meta.diff.header.to-file', 'punctuation.definition.inserted'],
      settings: { foreground: '#6ee7b7', background: '#04260f' } },
    { scope: ['markup.changed', 'punctuation.definition.changed'],
      settings: { foreground: '#fdba74', background: '#5a1e02' } },
    { scope: 'meta.diff.range',
      settings: { foreground: '#f0abfc', fontStyle: 'bold' } },
    { scope: 'meta.diff.header',
      settings: { foreground: '#7dd3fc' } },
    { scope: 'meta.separator',
      settings: { foreground: '#7dd3fc', fontStyle: 'bold' } },
    { scope: 'meta.output',
      settings: { foreground: '#7dd3fc' } },
    { scope: ['brackethighlighter.tag', 'brackethighlighter.curly', 'brackethighlighter.round', 'brackethighlighter.square', 'brackethighlighter.angle', 'brackethighlighter.quote'],
      settings: { foreground: '#64748b' } },
    { scope: 'brackethighlighter.unmatched',
      settings: { foreground: '#e89797' } },
    { scope: ['constant.other.reference.link', 'string.other.link'],
      settings: { foreground: '#fde68a' } },
    // Shell-script specific: flags like `--source-port` render violet, matching
    // CodeBlock's `text-violet-300` for dashed options
    { scope: ['variable.parameter.option.shell', 'string.unquoted.argument.shell'],
      settings: { foreground: '#c4b5fd' } },
  ],
};

// Lazy Shiki highlighter — created on first code block render, then cached.
const codeBlockSpec = createCodeBlockSpec({
  defaultLanguage: 'text',
  indentLineWithTab: true,
  supportedLanguages: SUPPORTED_LANGUAGES,
  createHighlighter: async () => {
    const { createHighlighter } = await import('shiki');
    return createHighlighter({
      themes: [librarianDarkTheme],
      langs: Object.keys(SUPPORTED_LANGUAGES).filter((l) => l !== 'text'),
    });
  },
});

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: codeBlockSpec,
    card: CardBlock(),
    map: MapBlock(),
    pagelink: PageLinkBlock(),
    report: ReportBlock(),
  },
  styleSpecs: {
    ...defaultStyleSpecs,
    fontSize: FontSize,
    fontFamily: FontFamily,
    // Override BlockNote's built-in textColor / backgroundColor (which only
    // accept 9 named tokens) with versions that take any CSS color value.
    textColor: TextColor,
    backgroundColor: BgColor,
  },
});
