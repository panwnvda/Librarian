import React from 'react';
import MapNode from './MapNode';

export default function ArchitectureMap({ columns, onNodeClick }) {
  const columnColorMap = {
    // Phase colors (no two same in a row)
    'C2 & OPSEC': 'cyan',
    'RECONNAISSANCE': 'green',
    'INITIAL COMPROMISE': 'blue',
    'HOST OPERATIONS': 'purple',
    'PRIVILEGE ESCALATION': 'red',
    'CREDENTIAL ACCESS': 'orange',
    'LATERAL MOVEMENT': 'pink',
    'KERBEROS': 'yellow',
    'AD ATTACKS': 'cyan',
    'DOMAIN DOMINANCE': 'green',
    'EVASION (CRTO)': 'blue',
    'EVASION': 'blue',
    'EVASION — PAYLOAD & STAGING': 'blue',
    'EVASION — C2 & TEMPLATES': 'orange',
    'EVASION — POST-EXPLOITATION': 'pink',
    'PROCESS MASKING': 'purple',
    'C2 INFRASTRUCTURE': 'purple',
    'WINDOWS APIs': 'red',
    'PROCESS INJECTION': 'orange',
    'DEFENCE EVASION': 'pink',
    'ASR & WDAC': 'yellow',
    'EDR EVASION (CRTL)': 'cyan',
    'EDR EVASION': 'cyan',
    // Legacy/fallbacks
    'INFRASTRUCTURE': 'cyan',
    'INITIAL ACCESS': 'green',
    'EXECUTION': 'red',
    'POST EXPLOITATION': 'orange',
    'COLLECTION': 'pink',
    'EXFILTRATION': 'yellow',
    'CREDENTIAL ACCESS_OLD': 'green',
    'PRIVILEGE ESCALATION_OLD': 'red',
    'LATERAL MOVEMENT_OLD': 'blue',
    'PERSISTENCE': 'purple',
    'INFORMATION GATHERING': 'cyan',
    'ACLS': 'green',
    'TRUST': 'blue',
    'ADCS': 'purple',
    'SCCM': 'orange',
    'MSSQL': 'yellow',
    'EXCHANGE': 'pink',
  };

  const headerColorMap = {
    cyan: 'text-cyan-400 border-cyan-500/30',
    green: 'text-emerald-400 border-emerald-500/30',
    red: 'text-red-400 border-red-500/30',
    purple: 'text-purple-400 border-purple-500/30',
    orange: 'text-orange-400 border-orange-500/30',
    pink: 'text-pink-400 border-pink-500/30',
    blue: 'text-blue-400 border-blue-500/30',
    yellow: 'text-yellow-400 border-yellow-500/30',
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex gap-4 min-w-max">
        {columns.map((col, i) => {
          const color = col.color || columnColorMap[col.header] || 'cyan';
          const hColors = headerColorMap[color];
          return (
            <div key={i} className="flex flex-col gap-2 min-w-[180px] max-w-[200px]">
              <div className={`text-center py-2 border-b-2 mb-2 ${hColors}`}>
                <span className="font-mono text-[11px] font-bold tracking-[0.2em]">
                  {col.header}
                </span>
              </div>
              <div className="flex flex-col gap-2 border border-slate-800/50 rounded-lg p-2 bg-[#1a1a1a]">
                {col.nodes.map((node, j) => (
                  <MapNode
                    key={j}
                    title={node.title}
                    subtitle={node.subtitle}
                    accentColor={color}
                    onClick={() => onNodeClick && onNodeClick(node.id || node.title)}
                    small
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
