import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { Link } from 'react-router-dom';
import CodeBlock from './CodeBlock';

// [[page-key]] or [[page-key|Display Name]] → /note/page-key markdown link.
function preprocessWikilinks(text) {
  if (typeof text !== 'string' || !text) return '';
  return text.replace(/\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g, (_, target, label) => {
    const slug = target.trim();
    const display = (label || target).trim();
    return `[${display}](/note/${encodeURIComponent(slug)})`;
  });
}

// Defensive cleanup applied to every markdown string before react-markdown sees it.
// Handles every corruption mode we've observed in user-edited content:
//   1. CRLF / CR line endings (Windows paste, native textareas) → normalize to LF
//   2. Empty fenced code blocks ```lang\n``` → strip (otherwise they render as
//      broken empty boxes AND can confuse fence pairing for neighbours)
//   3. Unbalanced ``` fences (odd count) → append a closing fence so the parser
//      doesn't swallow the rest of the document as a runaway code block
//   4. Code fences not followed by a newline (``` immediately followed by content
//      on the same line) → insert one
//   5. Runs of 3+ blank lines → collapse to 2 (markdown reset)
//   6. Zero-width / BOM characters (paste from Word/Notion) → strip
function preprocessMarkdown(text) {
  if (typeof text !== 'string' || !text) return '';
  let s = text;
  // 1. Normalize line endings.
  s = s.replace(/\r\n?/g, '\n');
  // 6. Strip BOM and zero-width spaces (U+200B–U+200D, U+FEFF).
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // 2. Strip empty code fences (any language, optional internal whitespace).
  s = s.replace(/^```[ \t]*[a-zA-Z0-9_+\-]*[ \t]*\n[ \t\r\n]*```[ \t]*$/gm, '');
  // 4. Ensure a closing fence is on its own line: "code```" → "code\n```"
  s = s.replace(/([^\n])```[ \t]*$/gm, '$1\n```');
  // 3. Balance odd fence count by appending a closing fence at the end.
  const fenceCount = (s.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) s += '\n```';
  // 5. Collapse multi-blank-line runs.
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

const components = {
  h1: ({ children }) => <h1 className="mb-3 mt-7 text-[28px] font-bold leading-tight tracking-tight text-[#e8e8e8]">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-6 text-[22px] font-semibold leading-snug tracking-tight text-[#e8e8e8]">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-[18px] font-semibold text-[#e8e8e8]">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-4 text-[15.5px] font-semibold text-[#d8d8d8]">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wider text-[#c4c4c4]">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">{children}</h6>,
  p: ({ children }) => <p className="my-2 leading-relaxed text-[#d4d4d4]">{children}</p>,
  a: ({ href, children }) => {
    const isInternal = typeof href === 'string' && href.startsWith('/note/');
    const cls = 'text-[#86b0e3] underline underline-offset-2 decoration-[#86b0e3]/40 transition-colors hover:decoration-[#86b0e3]';
    if (isInternal) return <Link to={href} className={cls}>{children}</Link>;
    return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
  },
  ul: ({ children }) => <ul className="my-2 ml-5 list-outside list-disc space-y-1 text-[#d4d4d4] marker:text-[#6a6a6a]">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-5 list-outside list-decimal space-y-1 text-[#d4d4d4] marker:text-[#6a6a6a]">{children}</ol>,
  li: ({ children, checked }) => {
    if (typeof checked === 'boolean') {
      return (
        <li className="-ml-5 flex list-none items-start gap-2 leading-relaxed">
          <span className={`mt-[3px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${checked ? 'border-[#5b86c8] bg-[#5b86c8]/20 text-[#86b0e3]' : 'border-[#3a3a3a] bg-[#232323]'}`}>
            {checked && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current"><path d="M4.5 8.5L1.75 5.75l1-1L4.5 6.5l5.75-5.75 1 1z"/></svg>}
          </span>
          <span className={checked ? 'text-[#7a7a7a] line-through' : ''}>{children}</span>
        </li>
      );
    }
    return <li className="leading-relaxed">{children}</li>;
  },
  blockquote: ({ children }) => <blockquote className="my-3 rounded-r border-l-2 border-[#5b86c8]/60 bg-white/[0.02] py-1 pl-4 pr-3 italic text-[#a8a8a8]">{children}</blockquote>,
  hr: () => <hr className="my-6 border-[#2a2a2a]" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-[#2a2a2a]">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#1d1d1d]">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[#262626] last:border-b-0">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-[#c4c4c4]">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-[#d4d4d4]">{children}</td>,
  strong: ({ children }) => <strong className="font-semibold text-[#e8e8e8]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[#dadada]">{children}</em>,
  del: ({ children }) => <del className="text-[#7a7a7a]">{children}</del>,
  img: ({ src, alt }) => <img src={src} alt={alt || ''} className="my-3 max-w-full rounded-lg border border-[#2a2a2a]" />,
  pre: ({ children }) => {
    const child = React.Children.toArray(children)[0];
    if (React.isValidElement(child)) {
      const props = /** @type {any} */ (child.props) || {};
      const className = props.className || '';
      const match = /language-(\w+)/.exec(className);
      const code = String(props.children ?? '').replace(/\n$/, '');
      if (!code.trim()) return null;
      return <CodeBlock title="" language={match ? match[1] : undefined}>{code}</CodeBlock>;
    }
    return <pre className="my-3 overflow-x-auto rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 font-mono text-[12.5px] text-[#e8e8e8]">{children}</pre>;
  },
  code: ({ children }) => (
    <code className="rounded border border-[#2a2a2a] bg-[#232323] px-1.5 py-0.5 font-mono text-[0.85em] text-[#e1bb6a] [overflow-wrap:anywhere] [word-break:break-word]">
      {children}
    </code>
  ),
};

function MarkdownView({ children, className = '' }) {
  const source = typeof children === 'string' ? children : '';
  const processed = preprocessMarkdown(preprocessWikilinks(source));
  return (
    <div className={`markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownView);
