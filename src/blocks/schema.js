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

// Custom Shiki theme that mirrors the card editor's CodeBlock palette:
//   strings       → amber-200   (#fde68a)
//   numbers       → orange-300  (#fdba74)
//   comments      → slate-500   (#64748b) italic
//   keywords      → emerald-300 (#6ee7b7)
//   variables     → sky-300     (#7dd3fc)
//   flags / opts  → violet-300  (#c4b5fd)
//   types         → fuchsia-300 (#f0abfc)
//   functions     → sky-300     (#7dd3fc)
//   punctuation   → slate-400   (#94a3b8)
// Background + foreground match the body box used by the card editor's
// CodeBlock so the two render visually identically.
const librarianDarkTheme = {
  name: 'librarian-dark',
  type: 'dark',
  colors: {
    'editor.background': '#181818',
    'editor.foreground': '#e8e8e8',
  },
  bg: '#181818',
  fg: '#e8e8e8',
  settings: [
    { settings: { foreground: '#e8e8e8', background: '#181818' } },
    { scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { foreground: '#64748b', fontStyle: 'italic' } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'],
      settings: { foreground: '#fde68a' } },
    { scope: ['constant.numeric', 'constant.language.boolean', 'constant.language.null', 'constant.language'],
      settings: { foreground: '#fdba74' } },
    { scope: ['keyword', 'keyword.control', 'keyword.operator', 'keyword.other', 'storage.modifier'],
      settings: { foreground: '#6ee7b7' } },
    { scope: ['storage.type', 'support.type', 'entity.name.type', 'entity.name.class', 'entity.other.inherited-class'],
      settings: { foreground: '#f0abfc' } },
    { scope: ['variable', 'variable.parameter', 'variable.language', 'variable.other'],
      settings: { foreground: '#7dd3fc' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call.python', 'meta.function-call'],
      settings: { foreground: '#7dd3fc' } },
    { scope: ['punctuation', 'meta.brace', 'punctuation.section'],
      settings: { foreground: '#94a3b8' } },
    { scope: ['entity.other.attribute-name', 'meta.attribute'],
      settings: { foreground: '#fde68a' } },
    { scope: ['entity.name.tag', 'meta.tag'],
      settings: { foreground: '#7dd3fc' } },
    // Shell-script specific so flags like `--source-port` render violet
    { scope: ['variable.parameter.option.shell', 'string.unquoted.argument.shell'],
      settings: { foreground: '#c4b5fd' } },
    // CSS / selectors
    { scope: ['entity.other.attribute-name.class.css', 'entity.name.tag.css'],
      settings: { foreground: '#7dd3fc' } },
    { scope: ['support.type.property-name.css', 'meta.property-name'],
      settings: { foreground: '#f0abfc' } },
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
