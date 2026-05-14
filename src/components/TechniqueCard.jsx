import React, { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import CodeBlock from './CodeBlock';
import MarkdownView from './MarkdownView';
import { getTitleFontClass } from '../lib/pageStyleOptions';

const COLOR_MAP = {
  cyan:    { title: 'text-cyan-400',    tag: 'text-cyan-400 border-[#2a2a2a]',    progress: 'bg-cyan-500',    circleEmpty: 'border-[#3a3a3a] text-cyan-400',    circleFilled: 'bg-cyan-500 border-cyan-500 text-slate-900' },
  green:   { title: 'text-emerald-400', tag: 'text-emerald-400 border-[#2a2a2a]', progress: 'bg-emerald-500', circleEmpty: 'border-[#3a3a3a] text-emerald-400', circleFilled: 'bg-emerald-500 border-emerald-500 text-slate-900' },
  red:     { title: 'text-red-400',     tag: 'text-red-400 border-[#2a2a2a]',     progress: 'bg-red-500',     circleEmpty: 'border-[#3a3a3a] text-red-400',     circleFilled: 'bg-red-500 border-red-500 text-white' },
  ruby:    { title: 'text-red-600',     tag: 'text-red-600 border-[#2a2a2a]',     progress: 'bg-red-600',     circleEmpty: 'border-[#3a3a3a] text-red-600',     circleFilled: 'bg-red-600 border-red-600 text-white' },
  purple:  { title: 'text-purple-400',  tag: 'text-purple-400 border-[#2a2a2a]',  progress: 'bg-purple-500',  circleEmpty: 'border-[#3a3a3a] text-purple-400',  circleFilled: 'bg-purple-500 border-purple-500 text-white' },
  orange:  { title: 'text-orange-400',  tag: 'text-orange-400 border-[#2a2a2a]',  progress: 'bg-orange-500',  circleEmpty: 'border-[#3a3a3a] text-orange-400',  circleFilled: 'bg-orange-500 border-orange-500 text-slate-900' },
  pink:    { title: 'text-pink-400',    tag: 'text-pink-400 border-[#2a2a2a]',    progress: 'bg-pink-500',    circleEmpty: 'border-[#3a3a3a] text-pink-400',    circleFilled: 'bg-pink-500 border-pink-500 text-white' },
  blue:    { title: 'text-blue-400',    tag: 'text-blue-400 border-[#2a2a2a]',    progress: 'bg-blue-500',    circleEmpty: 'border-[#3a3a3a] text-blue-400',    circleFilled: 'bg-blue-500 border-blue-500 text-white' },
  yellow:  { title: 'text-yellow-400',  tag: 'text-yellow-400 border-[#2a2a2a]',  progress: 'bg-yellow-500',  circleEmpty: 'border-[#3a3a3a] text-yellow-400',  circleFilled: 'bg-yellow-500 border-yellow-500 text-slate-900' },
  teal:    { title: 'text-teal-400',    tag: 'text-teal-400 border-[#2a2a2a]',    progress: 'bg-teal-500',    circleEmpty: 'border-[#3a3a3a] text-teal-400',    circleFilled: 'bg-teal-500 border-teal-500 text-slate-900' },
  indigo:  { title: 'text-indigo-400',  tag: 'text-indigo-400 border-[#2a2a2a]',  progress: 'bg-indigo-500',  circleEmpty: 'border-[#3a3a3a] text-indigo-400',  circleFilled: 'bg-indigo-500 border-indigo-500 text-white' },
  lime:    { title: 'text-lime-400',    tag: 'text-lime-400 border-[#2a2a2a]',    progress: 'bg-lime-500',    circleEmpty: 'border-[#3a3a3a] text-lime-400',    circleFilled: 'bg-lime-500 border-lime-500 text-slate-900' },
  rose:    { title: 'text-rose-400',    tag: 'text-rose-400 border-[#2a2a2a]',    progress: 'bg-rose-500',    circleEmpty: 'border-[#3a3a3a] text-rose-400',    circleFilled: 'bg-rose-500 border-rose-500 text-white' },
  amber:   { title: 'text-amber-400',   tag: 'text-amber-400 border-[#2a2a2a]',   progress: 'bg-amber-500',   circleEmpty: 'border-[#3a3a3a] text-amber-400',   circleFilled: 'bg-amber-500 border-amber-500 text-slate-900' },
  violet:  { title: 'text-violet-400',  tag: 'text-violet-400 border-[#2a2a2a]',  progress: 'bg-violet-500',  circleEmpty: 'border-[#3a3a3a] text-violet-400',  circleFilled: 'bg-violet-500 border-violet-500 text-white' },
  sky:     { title: 'text-sky-400',     tag: 'text-sky-400 border-[#2a2a2a]',     progress: 'bg-sky-500',     circleEmpty: 'border-[#3a3a3a] text-sky-400',     circleFilled: 'bg-sky-500 border-sky-500 text-slate-900' },
  fuchsia: { title: 'text-fuchsia-400', tag: 'text-fuchsia-400 border-[#2a2a2a]', progress: 'bg-fuchsia-500', circleEmpty: 'border-[#3a3a3a] text-fuchsia-400', circleFilled: 'bg-fuchsia-500 border-fuchsia-500 text-white' },
};

function TechniqueCard({ title, subtitle, tags = [], accentColor = 'cyan', overview, steps = [], commands = [], subsections = [], subCards = [], font = null, onExpandedChange = undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [expandedSubsections, setExpandedSubsections] = useState(new Set());

  const toggleStep = (e, i) => {
    e.stopPropagation();
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const colors = COLOR_MAP[accentColor] || COLOR_MAP.cyan;
  const completedCount = completedSteps.size;
  const totalSteps = steps.length;
  // null/undefined font → inherit from parent (which uses --app-font).
  // Empty class instead of font-mono so the card matches the page default.
  const titleFontClass = font ? getTitleFontClass(font, '') : '';

  const handleToggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      onExpandedChange?.(next);
      return next;
    });
  };

  return (
    <div className="technique-card rounded-md border border-[#2a2a2a] bg-[#202020] hover:border-[#3a3a3a] overflow-hidden transition-all">
      <div
        className="p-4 cursor-pointer flex items-start justify-between gap-4"
        onClick={handleToggleExpanded}
      >
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${colors.title} ${titleFontClass}`}>{title}</h3>
          {subtitle && <p className={`text-slate-500 text-xs mt-1 ${titleFontClass}`}>{subtitle}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag, i) => (
                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${titleFontClass} bg-[#1a1a1a] ${colors.tag}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {totalSteps > 0 && completedCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-px bg-[#2a2a2a] overflow-hidden">
                <div
                  className={`h-full transition-all ${colors.progress}`}
                  style={{ width: `${(completedCount / totalSteps) * 100}%` }}
                />
              </div>
              <span className={`text-[10px] font-mono ${colors.title}`}>{completedCount}/{totalSteps}</span>
            </div>
          )}
        </div>
        <div className="text-slate-600 mt-0.5 flex-shrink-0">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-4">
          {subsections.length > 0 && (
            <div className="mb-5">
              <h4 className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2">Attack Vectors</h4>
              <div className="space-y-1">
                {subsections.map((sub, i) => {
                  const subExpanded = expandedSubsections.has(i);
                  return (
                    <div key={i} className="rounded border border-[#2a2a2a] overflow-hidden">
                      <button
                        onClick={() => setExpandedSubsections(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        })}
                        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#272727] transition-colors"
                      >
                        <div className="flex-1 text-left">
                          <h5 className={`text-xs font-semibold ${colors.title} ${titleFontClass}`}>{sub.title}</h5>
                          {sub.description && (
                            <MarkdownView className="text-xs text-slate-500 mt-0.5">{sub.description}</MarkdownView>
                          )}
                        </div>
                        <div className="text-slate-600 flex-shrink-0">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${subExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {subExpanded && (
                        <div className="px-3 py-2.5 border-t border-[#2a2a2a] bg-[#1a1a1a]">
                          <div className="flex flex-wrap gap-1">
                            {sub.tags.map((tag, j) => (
                              <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded border ${titleFontClass} bg-[#1a1a1a] ${colors.tag}`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {overview && (
            <div className="mb-4">
              <h4 className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2">Overview</h4>
              <MarkdownView className="text-sm text-slate-300">{overview}</MarkdownView>
            </div>
          )}

          {steps.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-3">
                Steps
                <span className="ml-2 text-slate-700 normal-case font-sans">— click to mark done</span>
              </h4>
              <div className="space-y-0">
                {steps.map((step, i) => {
                  const done = completedSteps.has(i);
                  return (
                    <div key={i} className="flex gap-3 step-connector pb-4 w-full">
                      <button
                        onClick={(e) => toggleStep(e, i)}
                        title={done ? 'Click to unmark' : 'Click to mark done'}
                        className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer select-none bg-[#1a1a1a] ${done ? 'border-[#2a2a2a] text-slate-600' : colors.circleEmpty}`}
                      >
                        <span className="text-[10px] font-mono font-bold">{i + 1}</span>
                      </button>
                      <div className={`flex-1 min-w-0 pt-1 transition-opacity ${done ? 'opacity-25' : ''}`}>
                        <MarkdownView className="text-sm leading-relaxed text-slate-300">{step}</MarkdownView>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {commands.length > 0 && (
            <div>
              <h4 className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2">Technical Notes</h4>
              {commands.map((cmd, i) => (
                <CodeBlock key={i} title={cmd.title} language={cmd.language}>
                  {cmd.code}
                </CodeBlock>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TechniqueCard);
