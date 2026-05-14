import React, { memo } from 'react';

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-2xl font-semibold font-mono text-slate-200 tracking-tight">{title}</h1>
      {subtitle && (
        <p className="text-slate-500 font-mono text-sm mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export default memo(SectionHeader);
