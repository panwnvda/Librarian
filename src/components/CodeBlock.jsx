import React, { memo, useState, useCallback, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';

const LANGUAGE_PATTERNS = {
  bash: {
    comment: /#.*/,
    tokens: [
      { regex: /\$\{?[A-Za-z_][\w]*\}?/g, className: 'text-sky-300' },
      { regex: /(^|\s)(--?[A-Za-z0-9_-]+)/g, className: 'text-violet-300' },
      { regex: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|export|sudo|chmod|chown|grep|awk|sed|curl|wget|ssh|scp|tar|find|cat|echo|printf|mkdir|rm|mv|cp|apt|yum|dnf|pip|python|python3|bash|sh)\b/g, className: 'text-emerald-300' },
    ],
  },
  powershell: {
    comment: /#.*/,
    tokens: [
      { regex: /\$[A-Za-z_][\w:]*/g, className: 'text-sky-300' },
      { regex: /-\w[\w-]*/g, className: 'text-violet-300' },
      { regex: /\b(?:function|param|if|else|elseif|foreach|for|while|switch|return|try|catch|finally|throw|class|New-Object|Get-|Set-|Invoke-|Start-|Stop-|Where-Object|ForEach-Object|Select-Object|Import-Module)\b/g, className: 'text-emerald-300' },
    ],
  },
  python: {
    comment: /#.*/,
    tokens: [
      { regex: /\b(?:def|class|import|from|as|return|if|elif|else|for|while|try|except|finally|with|lambda|yield|pass|break|continue|in|is|not|and|or|None|True|False|print)\b/g, className: 'text-fuchsia-300' },
      { regex: /\b(?:self)\b/g, className: 'text-sky-300' },
    ],
  },
  javascript: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|import|from|export|default|class|extends|new|try|catch|finally|async|await|null|true|false|typeof)\b/g, className: 'text-yellow-300' },
      { regex: /\b(?:console|window|document|Promise|Array|Object|JSON)\b/g, className: 'text-sky-300' },
    ],
  },
  c: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /#[A-Za-z_]+/g, className: 'text-violet-300' },
      { regex: /\b(?:int|char|float|double|void|long|short|unsigned|signed|const|static|struct|typedef|enum|union|return|if|else|for|while|switch|case|break|continue|sizeof|include|define|null)\b/g, className: 'text-sky-300' },
      { regex: /\b(?:printf|scanf|malloc|free|memcpy|strcpy|fopen|fclose|main)\b/g, className: 'text-emerald-300' },
    ],
  },
  cpp: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /#[A-Za-z_]+/g, className: 'text-violet-300' },
      { regex: /\b(?:int|char|float|double|void|long|short|unsigned|signed|const|static|struct|typedef|enum|class|namespace|template|typename|return|if|else|for|while|switch|case|break|continue|sizeof|include|using|public|private|protected|virtual|auto|nullptr|new|delete)\b/g, className: 'text-sky-300' },
      { regex: /\b(?:std|cout|cin|vector|string|map|unique_ptr|shared_ptr)\b/g, className: 'text-emerald-300' },
    ],
  },
  csharp: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /\b(?:using|namespace|class|public|private|protected|internal|static|void|int|string|bool|var|new|return|if|else|for|foreach|while|switch|case|break|continue|try|catch|finally|null|true|false)\b/g, className: 'text-sky-300' },
      { regex: /\b(?:Console|List|Dictionary|Task|async|await)\b/g, className: 'text-emerald-300' },
    ],
  },
  java: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /\b(?:package|import|public|private|protected|class|interface|extends|implements|static|final|void|int|long|double|string|boolean|new|return|if|else|for|while|switch|case|break|continue|try|catch|finally|null|true|false)\b/g, className: 'text-yellow-300' },
      { regex: /\b(?:System|String|List|Map|ArrayList|HashMap)\b/g, className: 'text-emerald-300' },
    ],
  },
  go: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /\b(?:package|import|func|var|const|type|struct|interface|return|if|else|for|range|switch|case|break|continue|go|defer|select|chan|map)\b/g, className: 'text-cyan-300' },
      { regex: /\b(?:fmt|http|context|json|make|append|len|cap)\b/g, className: 'text-emerald-300' },
    ],
  },
  rust: {
    comment: /\/\/.*/,
    tokens: [
      { regex: /\b(?:fn|let|mut|pub|struct|enum|impl|trait|use|mod|match|if|else|for|while|loop|return|self|Self|crate|async|await|move)\b/g, className: 'text-orange-300' },
      { regex: /\b(?:String|Vec|Result|Option|Some|None|Ok|Err|println!)\b/g, className: 'text-emerald-300' },
    ],
  },
  sql: {
    comment: /--.*/,
    tokens: [
      { regex: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|VALUES|SET|AND|OR|NOT|NULL|AS|DISTINCT)\b/gi, className: 'text-cyan-300' },
    ],
  },
  json: {
    tokens: [
      { regex: /"(?:\\.|[^"])*"(?=\s*:)/g, className: 'text-sky-300' },
      { regex: /\b(?:true|false|null)\b/g, className: 'text-fuchsia-300' },
    ],
  },
  xml: {
    tokens: [
      { regex: /<\/?[\w:-]+/g, className: 'text-cyan-300' },
      { regex: /\b[\w:-]+=/g, className: 'text-amber-300' },
    ],
  },
  html: {
    comment: /<!--.*-->/,
    tokens: [
      { regex: /<\/?[\w-]+/g, className: 'text-cyan-300' },
      { regex: /\b[\w-]+=/g, className: 'text-amber-300' },
    ],
  },
  css: {
    comment: /\/\*.*/,
    tokens: [
      { regex: /\.[A-Za-z_-][\w-]*/g, className: 'text-cyan-300' },
      { regex: /\b(?:color|background|display|position|margin|padding|border|font-family|font-size|width|height|grid|flex|align-items|justify-content)\b/g, className: 'text-fuchsia-300' },
    ],
  },
};

function inferLanguage(code = '') {
  const trimmed = code.trim();
  if (!trimmed) return 'bash';
  if (/^\s*#include\b/m.test(trimmed) || /\bprintf\s*\(/.test(trimmed)) return 'c';
  if (/^\s*package\s+\w+/m.test(trimmed) && /\bfunc\b/.test(trimmed)) return 'go';
  if (/^\s*using\s+System/m.test(trimmed) || /\bConsole\.Write(Line)?\s*\(/.test(trimmed)) return 'csharp';
  if (/^\s*SELECT\b/i.test(trimmed) || /\bFROM\b/i.test(trimmed)) return 'sql';
  if (/^\s*<[^>]+>/.test(trimmed)) return trimmed.includes('</') ? 'html' : 'xml';
  if (/^\s*[{[]/.test(trimmed) && /":/.test(trimmed)) return 'json';
  if (/\bdef\b|\bimport\b/.test(trimmed)) return 'python';
  if (/\bfunction\b|\bconst\b|\blet\b|\bconsole\./.test(trimmed)) return 'javascript';
  if (/\$[A-Za-z_][\w:]*/.test(trimmed) || /\bGet-|Set-|Invoke-/.test(trimmed)) return 'powershell';
  return 'bash';
}

function addMatches(matches, regex, className, line) {
  for (const match of line.matchAll(regex)) {
    const text = match[0];
    const start = match.index ?? 0;
    if (!text || start < 0) continue;
    matches.push({ start, end: start + text.length, className });
  }
}

function tokenizeLine(line, language) {
  const config = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.bash;
  const matches = [];

  addMatches(matches, /"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/g, 'text-amber-200', line);
  addMatches(matches, /\b\d+(?:\.\d+)?\b/g, 'text-orange-300', line);

  if (config.comment) {
    const commentMatch = line.match(config.comment);
    if (commentMatch && commentMatch.index !== undefined) {
      matches.push({
        start: commentMatch.index,
        end: commentMatch.index + commentMatch[0].length,
        className: 'text-slate-500 italic',
      });
    }
  }

  for (const token of config.tokens || []) {
    addMatches(matches, token.regex, token.className, line);
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const filtered = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start < lastEnd) continue;
    filtered.push(match);
    lastEnd = match.end;
  }

  if (filtered.length === 0) {
    return [<span key="plain" className="text-slate-200">{line}</span>];
  }

  const parts = [];
  let cursor = 0;

  filtered.forEach((match, index) => {
    if (cursor < match.start) {
      parts.push(
        <span key={`plain-${index}-${cursor}`} className="text-slate-200">
          {line.slice(cursor, match.start)}
        </span>
      );
    }

    parts.push(
      <span key={`token-${index}-${match.start}`} className={match.className}>
        {line.slice(match.start, match.end)}
      </span>
    );

    cursor = match.end;
  });

  if (cursor < line.length) {
    parts.push(
      <span key={`plain-tail-${cursor}`} className="text-slate-200">
        {line.slice(cursor)}
      </span>
    );
  }

  return parts;
}

function CodeBlock({ children, title, language }) {
  const [copied, setCopied] = useState(false);
  const code = typeof children === 'string' ? children : '';

  const resolvedLanguage = useMemo(
    () => language || inferLanguage(code),
    [language, code]
  );

  const lines = useMemo(() => code ? code.split('\n') : [], [code]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code.replace(/^(#.*$)/gm, '').trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="my-3 block w-full max-w-full overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#181818]">
      <div className="flex items-center justify-between border-b border-[#262626] bg-[#1d1d1d] px-3.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] text-[#6e6e6e]">{resolvedLanguage || 'text'}</span>
          {title && <span className="truncate font-mono text-[11.5px] text-[#9a9a9a]">{title}</span>}
        </div>
        <button
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
          className="flex-shrink-0 text-[#6e6e6e] transition-colors hover:text-[#c4c4c4]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="m-0 box-border w-full max-w-full overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code className="block min-w-max whitespace-pre">
          {lines.map((line, i) => (
            <span key={i} className="block">
              {tokenizeLine(line, resolvedLanguage)}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export default memo(CodeBlock);
