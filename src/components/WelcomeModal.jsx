import React, { useEffect, useState } from 'react';
import {
  X,
  Layers,
  FileText,
  FolderOpen,
  Shield,
  FileCode2,
  FilePlus2,
  PenLine,
  Save,
} from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: 'Attack Maps',
    description: 'Column-based TTP matrices modelled on MITRE ATT&CK.',
  },
  {
    icon: FileText,
    title: 'Technique Cards',
    description: 'Steps, code blocks, and progress tracking per technique.',
  },
  {
    icon: FileCode2,
    title: 'Document Editor',
    description: 'Full markdown editor with live split preview.',
  },
  {
    icon: FolderOpen,
    title: 'Portable Workspaces',
    description: 'Export and import everything as a single .library file.',
  },
];

const workflow = [
  { icon: FilePlus2, step: '01', label: 'Create', text: 'Add a page and pick a type — notes, map, document, or resources.' },
  { icon: PenLine,   step: '02', label: 'Document', text: 'Capture techniques, steps, and code inline as you work.' },
  { icon: Save,      step: '03', label: 'Export', text: 'Save your workspace to a portable file and reload it anywhere.' },
];

const DISMISS_KEY = 'library_welcome_modal_dismissed';
const LEGACY_DISMISS_KEYS = ['cybernotes_welcome_modal_dismissed', 'redops_welcome_modal_dismissed'];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [persistDismissal, setPersistDismissal] = useState(false);

  useEffect(() => {
    try {
      const dismissed =
        localStorage.getItem(DISMISS_KEY) === 'true' ||
        LEGACY_DISMISS_KEYS.some((key) => localStorage.getItem(key) === 'true');
      if (!dismissed) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    if (persistDismissal) {
      try { localStorage.setItem(DISMISS_KEY, 'true'); } catch {}
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, persistDismissal]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="flex min-h-full items-center justify-center p-4 md:p-8"
        onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/60 animate-in fade-in-0 zoom-in-95 duration-300 ease-out"
        >
          {/* Top accent line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <header className="flex flex-col items-center px-8 pb-7 pt-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-[#202020]">
              <Shield className="h-6 w-6 text-red-400" />
            </div>
            <h1
              id="welcome-modal-title"
              className="mt-4 font-title-oswald text-3xl uppercase tracking-[0.14em] text-white"
            >
              Librarian
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
              A local-first workspace for red team methodology, attack maps, and technique documentation.
            </p>
          </header>

          {/* Features 2×2 grid */}
          <section className="border-t border-slate-800 px-8 py-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Features</p>
            <div className="grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3.5 transition-colors hover:border-slate-700"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-red-500/20 bg-red-500/10 text-red-400">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Workflow — compact 3-step row */}
          <section className="border-t border-slate-800 px-8 py-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How it works</p>
            <div className="flex flex-col gap-2.5">
              {workflow.map(({ icon: Icon, step, label, text }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-red-500/20 bg-red-500/10 text-red-400">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-slate-100">
                      <span className="mr-1.5 font-mono text-xs text-slate-500">{step}</span>
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="flex items-center justify-between gap-4 border-t border-slate-800 px-8 py-5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 transition-colors hover:text-slate-300">
              <input
                type="checkbox"
                checked={persistDismissal}
                onChange={(e) => setPersistDismissal(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-red-500 focus:ring-red-500"
              />
              Don&apos;t show again
            </label>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md bg-red-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Open workspace
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
