import React, { memo, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { Link } from 'react-router-dom';
import { Info, AlertTriangle, AlertOctagon, Lightbulb, CheckCircle2 } from 'lucide-react';
import CodeBlock from './CodeBlock';

// Map our 20-color accent palette to step-bubble + callout colors.
// Pulled from TechniqueCard's COLOR_MAP so step circles match column accents.
const ACCENT_MAP = {
  red:     { text: 'text-[#e89797]', bg: 'bg-[#d36868]', border: 'border-[#d36868]' },
  ruby:    { text: 'text-[#e07878]', bg: 'bg-[#b53a3a]', border: 'border-[#b53a3a]' },
  rose:    { text: 'text-[#f59ca8]', bg: 'bg-[#e16078]', border: 'border-[#e16078]' },
  pink:    { text: 'text-[#e0a8cf]', bg: 'bg-[#d178b5]', border: 'border-[#d178b5]' },
  magenta: { text: 'text-[#e88adf]', bg: 'bg-[#d44ec6]', border: 'border-[#d44ec6]' },
  fuchsia: { text: 'text-[#e288e1]', bg: 'bg-[#c850c6]', border: 'border-[#c850c6]' },
  purple:  { text: 'text-[#c0a8e0]', bg: 'bg-[#9b7ec8]', border: 'border-[#9b7ec8]' },
  violet:  { text: 'text-[#b3a6f0]', bg: 'bg-[#8a76e0]', border: 'border-[#8a76e0]' },
  indigo:  { text: 'text-[#a0aee8]', bg: 'bg-[#7080d4]', border: 'border-[#7080d4]' },
  blue:    { text: 'text-[#86b0e3]', bg: 'bg-[#5b86c8]', border: 'border-[#5b86c8]' },
  sky:     { text: 'text-[#8cc8e8]', bg: 'bg-[#5fa5d6]', border: 'border-[#5fa5d6]' },
  cyan:    { text: 'text-[#86d4e0]', bg: 'bg-[#5bb8c8]', border: 'border-[#5bb8c8]' },
  teal:    { text: 'text-[#86c8b8]', bg: 'bg-[#5db09e]', border: 'border-[#5db09e]' },
  mint:    { text: 'text-[#a0e8c8]', bg: 'bg-[#6ed4a9]', border: 'border-[#6ed4a9]' },
  emerald: { text: 'text-[#86c89c]', bg: 'bg-[#5db075]', border: 'border-[#5db075]' },
  green:   { text: 'text-[#90cc8e]', bg: 'bg-[#67b365]', border: 'border-[#67b365]' },
  lime:    { text: 'text-[#c4dd87]', bg: 'bg-[#a3c95a]', border: 'border-[#a3c95a]' },
  yellow:  { text: 'text-[#e2c47a]', bg: 'bg-[#cfa84b]', border: 'border-[#cfa84b]' },
  amber:   { text: 'text-[#e8c378]', bg: 'bg-[#d4a14a]', border: 'border-[#d4a14a]' },
  orange:  { text: 'text-[#e8a87c]', bg: 'bg-[#d68c5a]', border: 'border-[#d68c5a]' },
};

// [[page-key]] or [[page-key|Display Name]] → /note/page-key markdown link.
function preprocessWikilinks(text) {
  if (typeof text !== 'string' || !text) return '';
  return text.replace(/\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g, (_, target, label) => {
    const slug = target.trim();
    const display = (label || target).trim();
    return `[${display}](/note/${encodeURIComponent(slug)})`;
  });
}

// Same defensive cleanup as before — normalise CRLF, drop empty fences, balance
// orphan fences, strip BOM/zero-widths, collapse blank-line runs.
function preprocessMarkdown(text) {
  if (typeof text !== 'string' || !text) return '';
  let s = text;
  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/^```[ \t]*[a-zA-Z0-9_+\-]*[ \t]*\n[ \t\r\n]*```[ \t]*$/gm, '');
  s = s.replace(/([^\n])```[ \t]*$/gm, '$1\n```');
  const fenceCount = (s.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) s += '\n```';
  // Blank-line runs are NOT collapsed: CommonMark merges multiple blank lines
  // into a single paragraph break, so to honour the vertical space the user
  // typed we turn each *extra* blank line into an explicit `&nbsp;` spacer
  // paragraph. Code fences are stashed first so blank lines inside a block are
  // left verbatim.
  const stash = [];
  s = s.replace(/```[\s\S]*?```/g, (m) => { stash.push(m); return `%%FENCE${stash.length - 1}%%`; });
  // A run of N newlines = N-1 blank lines; one blank line is the normal
  // paragraph break, so inject (N-2) spacer paragraphs for the extras.
  s = s.replace(/\n{3,}/g, (m) => '\n\n' + '&nbsp;\n\n'.repeat(m.length - 2));
  s = s.replace(/%%FENCE(\d+)%%/g, (_, i) => stash[+i]);
  return s;
}

// Split markdown into segments. Recognised special segments:
//   { kind: 'steps', items: [...] }  ← from `## Steps\n- a\n- b`
//   { kind: 'md',    body: '...' }   ← anything else
// The block boundary is the next H1/H2 OR end of document.
function segmentMarkdown(src) {
  const lines = src.split('\n');
  const segments = [];
  let buffer = [];
  const flushBuffer = () => {
    if (buffer.length) {
      const body = buffer.join('\n').trim();
      if (body) segments.push({ kind: 'md', body });
      buffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isStepsHeading = /^##\s+Steps\s*$/i.test(line);
    if (!isStepsHeading) {
      buffer.push(line);
      continue;
    }
    // Found a ## Steps heading. Lookahead — must be followed (after blank
    // lines) by a bullet list to be eligible.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j += 1;
    if (j >= lines.length || !/^[-*]\s+/.test(lines[j])) {
      // No list → keep the heading inline.
      buffer.push(line);
      continue;
    }
    // Found the list — collect its items including 2-space-indented continuations.
    flushBuffer();
    const items = [];
    let current = null;
    while (j < lines.length) {
      const l = lines[j];
      // Section break — H1/H2 or another markdown heading we shouldn't swallow.
      if (/^#{1,2}\s+/.test(l) && !isStepsHeading) break;
      const m = /^[-*]\s+(.*)$/.exec(l);
      if (m) {
        if (current !== null) items.push(current.trim());
        current = m[1];
        j += 1;
      } else if (/^\s+/.test(l) || l.trim() === '') {
        // Continuation or blank inside the list.
        if (current !== null) {
          const cont = l.replace(/^ {2}/, '');
          current += '\n' + cont;
        }
        j += 1;
      } else {
        break;
      }
    }
    if (current !== null) items.push(current.trim());
    segments.push({ kind: 'steps', items: items.filter(Boolean) });
    i = j - 1;
  }
  flushBuffer();
  return segments;
}

// Detect GitHub-style admonition blockquotes:
//   > [!NOTE] | [!INFO] | [!TIP] | [!WARNING] | [!CAUTION] | [!SUCCESS]
// React-markdown gives us a `blockquote` element whose first child paragraph
// starts with the bracketed marker.
const CALLOUT_STYLES = {
  NOTE:    { color: 'blue',    icon: Info,           label: 'Note' },
  INFO:    { color: 'blue',    icon: Info,           label: 'Info' },
  TIP:     { color: 'emerald', icon: Lightbulb,      label: 'Tip' },
  WARNING: { color: 'amber',   icon: AlertTriangle,  label: 'Warning' },
  CAUTION: { color: 'red',     icon: AlertOctagon,   label: 'Caution' },
  SUCCESS: { color: 'green',   icon: CheckCircle2,   label: 'Success' },
};

function detectCallout(children) {
  // Walk the first text node of the first paragraph for `[!XXX]`.
  const arr = React.Children.toArray(children);
  for (const child of arr) {
    if (!React.isValidElement(child)) continue;
    const inner = React.Children.toArray(child.props?.children || []);
    const firstText = inner.find((c) => typeof c === 'string');
    if (typeof firstText !== 'string') continue;
    const m = /^\[!([A-Z]+)\]\s*/.exec(firstText);
    if (!m) continue;
    const kind = m[1].toUpperCase();
    if (!CALLOUT_STYLES[kind]) continue;
    // Strip the marker from the first text node so the body renders cleanly.
    const trimmedInner = [firstText.slice(m[0].length).replace(/^\n+/, ''), ...inner.slice(inner.indexOf(firstText) + 1)];
    const trimmedPara = React.cloneElement(child, { children: trimmedInner });
    return { kind, body: [trimmedPara, ...arr.slice(arr.indexOf(child) + 1)] };
  }
  return null;
}

function Callout({ kind, body, accentColor }) {
  const conf = CALLOUT_STYLES[kind];
  const colors = ACCENT_MAP[conf.color] || ACCENT_MAP.blue;
  const Icon = conf.icon;
  return (
    <div className={`my-3 flex gap-3 rounded-lg border ${colors.border} bg-white/[0.025] px-4 py-3`}>
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${colors.text}`} />
      <div className="flex-1 min-w-0">
        <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${colors.text}`}>{conf.label}</div>
        <div className="text-[#d4d4d4] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{body}</div>
      </div>
    </div>
  );
}

function StepsBlock({ items, accent }) {
  const colors = ACCENT_MAP[accent] || ACCENT_MAP.cyan;
  const [done, setDone] = useState(() => new Set());
  const toggle = (i) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  return (
    <div className="my-3">
      <h2 className={`mb-3 text-[11px] font-mono uppercase tracking-wider ${colors.text}`}>
        Steps
        <span className="ml-2 normal-case text-slate-600 font-sans">— click a number to mark done</span>
      </h2>
      <div>
        {items.map((step, i) => {
          const isDone = done.has(i);
          return (
            <div key={i} className="flex gap-3 pb-4 last:pb-0">
              <button
                onClick={() => toggle(i)}
                title={isDone ? 'Click to unmark' : 'Click to mark done'}
                className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer select-none bg-[#1a1a1a] ${
                  isDone
                    ? 'border-[#2a2a2a] text-slate-600'
                    : `border-[#3a3a3a] ${colors.text}`
                }`}
                style={isDone ? undefined : { boxShadow: 'inset 0 0 0 0 transparent' }}
              >
                <span className="text-[10px] font-mono font-bold">{i + 1}</span>
              </button>
              <div className={`flex-1 min-w-0 pt-1 transition-opacity ${isDone ? 'opacity-25' : ''}`}>
                <MarkdownStream>{step}</MarkdownStream>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Inner ReactMarkdown — same `components` table as the public view, but
// without re-running the steps segmenter (which would recurse forever).
function MarkdownStream({ children, components }) {
  const source = typeof children === 'string' ? children : '';
  const processed = preprocessMarkdown(preprocessWikilinks(source));
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeRaw]}
      components={components || defaultComponents}
    >
      {processed}
    </ReactMarkdown>
  );
}

const defaultComponents = {
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
  blockquote: ({ children }) => {
    // GitBook-style callouts via GitHub's `> [!NOTE]`/`[!WARNING]`/... markers.
    const callout = detectCallout(children);
    if (callout) return <Callout kind={callout.kind} body={callout.body} />;
    return (
      <blockquote className="my-3 rounded-r border-l-2 border-[#5b86c8]/60 bg-white/[0.02] py-1 pl-4 pr-3 italic text-[#a8a8a8]">
        {children}
      </blockquote>
    );
  },
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
      const props = (child.props) || {};
      const className = props.className || '';
      const match = /language-(\w+)/.exec(className);
      let raw = props.children;
      if (Array.isArray(raw)) raw = raw.map((c) => (typeof c === 'string' ? c : '')).join('');
      else if (typeof raw !== 'string') raw = String(raw ?? '');
      const code = raw.replace(/\n$/, '');
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

function MarkdownView({ children, className = '', accent = 'cyan' }) {
  const source = typeof children === 'string' ? children : '';
  // Memoize the heavy parsing pipeline — wikilink rewrite + sanitisation +
  // segmentation — on the raw source. Without this every parent re-render
  // (which happens on every keystroke in the technique card editor) burns
  // CPU re-parsing the same content for every visible step/overview block.
  const segments = useMemo(() => {
    const processed = preprocessMarkdown(preprocessWikilinks(source));
    return segmentMarkdown(processed);
  }, [source]);
  return (
    <div className={`markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}>
      {segments.map((seg, i) => {
        if (seg.kind === 'steps') return <StepsBlock key={i} items={seg.items} accent={accent} />;
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeRaw]}
            components={defaultComponents}
          >
            {seg.body}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

export default memo(MarkdownView);
