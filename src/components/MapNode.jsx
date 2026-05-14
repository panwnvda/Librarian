import React, { memo } from 'react';
import { titleColorOptions } from '../lib/pageStyleOptions';

const colorMap = Object.fromEntries(
  titleColorOptions.map((opt) => [opt.value, opt.nodeBorder])
);

const headerColorMap = Object.fromEntries(
  titleColorOptions.map((opt) => [opt.value, opt.text])
);

const isUrl = (value) => typeof value === 'string' && /^(https?:\/\/|www\.)/i.test(value.trim());

function MapNode({ title, subtitle, accentColor = 'cyan', onClick = undefined, small = false, titleFont = 'font-mono', techniques = [], showCount = true }) {
  const visibleTechniques = (Array.isArray(techniques) ? techniques : []).filter((entry) => !isUrl(entry));
  const hasTechniques = visibleTechniques.length > 0;

  return (
    <div
      onClick={onClick}
      className={`map-node group border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#272727] rounded-md cursor-pointer transition-all ${small ? 'px-3 py-2.5' : 'px-4 py-3.5'} bg-[#202020]`}
    >
      <p className={`${titleFont} font-semibold ${small ? 'text-xs' : 'text-sm'} ${headerColorMap[accentColor] || headerColorMap.cyan} leading-tight`}>
        {title}
      </p>
      {subtitle && (
        <p className={`text-slate-500 font-mono ${small ? 'text-[10px]' : 'text-xs'} mt-1 leading-tight`}>
          {subtitle}
        </p>
      )}
      {hasTechniques && (
        <div className="mt-2">
          {showCount && (
            <div className="flex justify-start">
              <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-slate-600">
                ({visibleTechniques.length})
              </span>
            </div>
          )}
          <div className={`${showCount ? 'mt-1' : ''} max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-48 group-hover:opacity-100`}>
            <div className="space-y-1 pt-1">
              {visibleTechniques.map((technique, index) => (
                <p
                  key={`${technique}-${index}`}
                  className={`text-[10px] ${titleFont} leading-tight text-slate-500`}
                >
                  {technique}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MapNode);
