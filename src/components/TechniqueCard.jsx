import React, { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import CodeBlock from './CodeBlock';
import MarkdownView from './MarkdownView';
import { getTitleFontClass } from '../lib/pageStyleOptions';

// Colors are sourced from MapBlock's COLORS palette (same dot/text hex values)
// so that card accent colors match column colors exactly.
//   title/circleEmpty  → palette `text`  hex
//   progress/circleFilled bg → palette `dot` hex
const COLOR_MAP = {
  red:     { title: 'text-[#e89797]', tag: 'text-[#e89797] border-[#2a2a2a]', progress: 'bg-[#d36868]', circleEmpty: 'border-[#3a3a3a] text-[#e89797]', circleFilled: 'bg-[#d36868] border-[#d36868] text-white' },
  ruby:    { title: 'text-[#e07878]', tag: 'text-[#e07878] border-[#2a2a2a]', progress: 'bg-[#b53a3a]', circleEmpty: 'border-[#3a3a3a] text-[#e07878]', circleFilled: 'bg-[#b53a3a] border-[#b53a3a] text-white' },
  rose:    { title: 'text-[#f59ca8]', tag: 'text-[#f59ca8] border-[#2a2a2a]', progress: 'bg-[#e16078]', circleEmpty: 'border-[#3a3a3a] text-[#f59ca8]', circleFilled: 'bg-[#e16078] border-[#e16078] text-white' },
  pink:    { title: 'text-[#e0a8cf]', tag: 'text-[#e0a8cf] border-[#2a2a2a]', progress: 'bg-[#d178b5]', circleEmpty: 'border-[#3a3a3a] text-[#e0a8cf]', circleFilled: 'bg-[#d178b5] border-[#d178b5] text-white' },
  magenta: { title: 'text-[#e88adf]', tag: 'text-[#e88adf] border-[#2a2a2a]', progress: 'bg-[#d44ec6]', circleEmpty: 'border-[#3a3a3a] text-[#e88adf]', circleFilled: 'bg-[#d44ec6] border-[#d44ec6] text-white' },
  fuchsia: { title: 'text-[#e288e1]', tag: 'text-[#e288e1] border-[#2a2a2a]', progress: 'bg-[#c850c6]', circleEmpty: 'border-[#3a3a3a] text-[#e288e1]', circleFilled: 'bg-[#c850c6] border-[#c850c6] text-white' },
  purple:  { title: 'text-[#c0a8e0]', tag: 'text-[#c0a8e0] border-[#2a2a2a]', progress: 'bg-[#9b7ec8]', circleEmpty: 'border-[#3a3a3a] text-[#c0a8e0]', circleFilled: 'bg-[#9b7ec8] border-[#9b7ec8] text-white' },
  violet:  { title: 'text-[#b3a6f0]', tag: 'text-[#b3a6f0] border-[#2a2a2a]', progress: 'bg-[#8a76e0]', circleEmpty: 'border-[#3a3a3a] text-[#b3a6f0]', circleFilled: 'bg-[#8a76e0] border-[#8a76e0] text-white' },
  indigo:  { title: 'text-[#a0aee8]', tag: 'text-[#a0aee8] border-[#2a2a2a]', progress: 'bg-[#7080d4]', circleEmpty: 'border-[#3a3a3a] text-[#a0aee8]', circleFilled: 'bg-[#7080d4] border-[#7080d4] text-white' },
  blue:    { title: 'text-[#86b0e3]', tag: 'text-[#86b0e3] border-[#2a2a2a]', progress: 'bg-[#5b86c8]', circleEmpty: 'border-[#3a3a3a] text-[#86b0e3]', circleFilled: 'bg-[#5b86c8] border-[#5b86c8] text-white' },
  sky:     { title: 'text-[#8cc8e8]', tag: 'text-[#8cc8e8] border-[#2a2a2a]', progress: 'bg-[#5fa5d6]', circleEmpty: 'border-[#3a3a3a] text-[#8cc8e8]', circleFilled: 'bg-[#5fa5d6] border-[#5fa5d6] text-slate-900' },
  cyan:    { title: 'text-[#86d4e0]', tag: 'text-[#86d4e0] border-[#2a2a2a]', progress: 'bg-[#5bb8c8]', circleEmpty: 'border-[#3a3a3a] text-[#86d4e0]', circleFilled: 'bg-[#5bb8c8] border-[#5bb8c8] text-slate-900' },
  teal:    { title: 'text-[#86c8b8]', tag: 'text-[#86c8b8] border-[#2a2a2a]', progress: 'bg-[#5db09e]', circleEmpty: 'border-[#3a3a3a] text-[#86c8b8]', circleFilled: 'bg-[#5db09e] border-[#5db09e] text-slate-900' },
  mint:    { title: 'text-[#a0e8c8]', tag: 'text-[#a0e8c8] border-[#2a2a2a]', progress: 'bg-[#6ed4a9]', circleEmpty: 'border-[#3a3a3a] text-[#a0e8c8]', circleFilled: 'bg-[#6ed4a9] border-[#6ed4a9] text-slate-900' },
  emerald: { title: 'text-[#86c89c]', tag: 'text-[#86c89c] border-[#2a2a2a]', progress: 'bg-[#5db075]', circleEmpty: 'border-[#3a3a3a] text-[#86c89c]', circleFilled: 'bg-[#5db075] border-[#5db075] text-slate-900' },
  green:   { title: 'text-[#90cc8e]', tag: 'text-[#90cc8e] border-[#2a2a2a]', progress: 'bg-[#67b365]', circleEmpty: 'border-[#3a3a3a] text-[#90cc8e]', circleFilled: 'bg-[#67b365] border-[#67b365] text-slate-900' },
  lime:    { title: 'text-[#c4dd87]', tag: 'text-[#c4dd87] border-[#2a2a2a]', progress: 'bg-[#a3c95a]', circleEmpty: 'border-[#3a3a3a] text-[#c4dd87]', circleFilled: 'bg-[#a3c95a] border-[#a3c95a] text-slate-900' },
  yellow:  { title: 'text-[#e2c47a]', tag: 'text-[#e2c47a] border-[#2a2a2a]', progress: 'bg-[#cfa84b]', circleEmpty: 'border-[#3a3a3a] text-[#e2c47a]', circleFilled: 'bg-[#cfa84b] border-[#cfa84b] text-slate-900' },
  amber:   { title: 'text-[#e8c378]', tag: 'text-[#e8c378] border-[#2a2a2a]', progress: 'bg-[#d4a14a]', circleEmpty: 'border-[#3a3a3a] text-[#e8c378]', circleFilled: 'bg-[#d4a14a] border-[#d4a14a] text-slate-900' },
  orange:  { title: 'text-[#e8a87c]', tag: 'text-[#e8a87c] border-[#2a2a2a]', progress: 'bg-[#d68c5a]', circleEmpty: 'border-[#3a3a3a] text-[#e8a87c]', circleFilled: 'bg-[#d68c5a] border-[#d68c5a] text-white' },
  brown:   { title: 'text-[#c69f85]', tag: 'text-[#c69f85] border-[#2a2a2a]', progress: 'bg-[#a07458]', circleEmpty: 'border-[#3a3a3a] text-[#c69f85]', circleFilled: 'bg-[#a07458] border-[#a07458] text-white' },
  stone:   { title: 'text-[#a8a29e]', tag: 'text-[#a8a29e] border-[#2a2a2a]', progress: 'bg-[#78716c]', circleEmpty: 'border-[#3a3a3a] text-[#a8a29e]', circleFilled: 'bg-[#78716c] border-[#78716c] text-white' },
  slate:   { title: 'text-[#94a3b8]', tag: 'text-[#94a3b8] border-[#2a2a2a]', progress: 'bg-[#64748b]', circleEmpty: 'border-[#3a3a3a] text-[#94a3b8]', circleFilled: 'bg-[#64748b] border-[#64748b] text-white' },
  gray:    { title: 'text-[#c4c4c4]', tag: 'text-[#c4c4c4] border-[#2a2a2a]', progress: 'bg-[#7a7a7a]', circleEmpty: 'border-[#3a3a3a] text-[#c4c4c4]', circleFilled: 'bg-[#7a7a7a] border-[#7a7a7a] text-white' },
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
      {/* Colored top bar — matches the map column's accent bar so a card and
          its column read as the same color at a glance. Uses the same `dot`
          shade the column does (via COLOR_MAP[accent].progress). */}
      <div className={`h-[3px] w-full ${colors.progress}`} aria-hidden />
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
                            <MarkdownView accent={accentColor} className="text-xs text-slate-500 mt-0.5">{sub.description}</MarkdownView>
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
              <MarkdownView accent={accentColor} className="text-sm text-slate-300">{overview}</MarkdownView>
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
                        <MarkdownView accent={accentColor} className="text-sm leading-relaxed text-slate-300">{step}</MarkdownView>
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
