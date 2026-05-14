import { BlockNoteSchema, defaultBlockSpecs, defaultStyleSpecs, createCodeBlockSpec } from '@blocknote/core';
import { CardBlock } from './CardBlock';
import { MapBlock } from './MapBlock';
import { PageLinkBlock } from './PageLinkBlock';
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

// Lazy Shiki highlighter — created on first code block render, then cached.
const codeBlockSpec = createCodeBlockSpec({
  defaultLanguage: 'text',
  indentLineWithTab: true,
  supportedLanguages: SUPPORTED_LANGUAGES,
  createHighlighter: async () => {
    const { createHighlighter } = await import('shiki');
    return createHighlighter({
      themes: ['github-dark-default'],
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
