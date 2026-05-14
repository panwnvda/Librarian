import React, { useRef, useState } from 'react';
import { Download, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { exportProject, importProjectFile } from '@/lib/projectFile';

/**
 * Import / Export controls shown in the navbar.
 * Props:
 *   customPages, hiddenPages, navOrder — current app state
 *   onImport(project) — called after a successful import with the parsed project
 */
export default function ImportExportControls({ customPages, hiddenPages, navOrder, onImport }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState(null); // null | 'exporting' | 'importing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = async () => {
    setStatus('exporting');
    try {
      await exportProject(customPages, hiddenPages, navOrder);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Export failed.');
    }
    setTimeout(() => setStatus(null), 2500);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-imported if needed
    e.target.value = '';
    setStatus('importing');
    setErrorMsg('');
    try {
      const project = await importProjectFile(file);
      setStatus('success');
      setTimeout(() => {
        setStatus(null);
        onImport(project);
      }, 800);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Import failed.');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const busy = status === 'exporting' || status === 'importing';

  return (
    <div className="flex items-center gap-1.5">
      {/* Status feedback */}
      {status === 'success' && (
        <span className="flex items-center gap-1 text-emerald-400 font-title-oswald tracking-[0.08em] text-xs">
          <CheckCircle className="w-3 h-3" /> Done
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-red-400 font-title-oswald tracking-[0.08em] text-xs" title={errorMsg}>
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      )}

      {/* Import */}
      <button
        onClick={handleImportClick}
        disabled={busy}
        title="Import .library project file"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-title-oswald tracking-[0.08em] text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-slate-700 hover:border-emerald-500/30 transition-all disabled:opacity-40"
      >
        {status === 'importing' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Upload className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Import</span>
      </button>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={busy}
        title="Export project as .library file"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-title-oswald tracking-[0.08em] text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/30 transition-all disabled:opacity-40"
      >
        {status === 'exporting' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Export</span>
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".library,.cybernotes,.rednotes,.zip,.json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
