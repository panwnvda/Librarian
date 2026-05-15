import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import {
  Upload, FileText, AlertTriangle, Plus, Trash2, Download, Printer,
  ChevronRight, ChevronDown, X, FileDown, FileType,
} from 'lucide-react';
import { persistGet, persistSet } from '@/lib/persistentStorage';
import {
  loadSysreptorFile, extractSchema, emptyFindingData, emptySectionData,
  cvss3Score, cvssSeverity, exportProjectToml, hydrateFromProject, defaultForField,
} from '@/lib/sysreptor';
// renderToPrint pulls in Vue 3 + marked + sysreptor's CSS assets (~70 KB
// gzipped). Only loaded on demand when the user clicks Export-to-PDF, so
// the main editor bundle stays slim. See dynamic import below.

// ─── Storage ──────────────────────────────────────────────────────────────────

const reportKey = (id) => `library_report_${id}`;

const newId = (prefix = 'rep') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 6)}`;

// ─── Field renderers ──────────────────────────────────────────────────────────

function FieldLabel({ field }) {
  return (
    <label className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#7a7a7a]">
      <span>{field.label}</span>
      {field.required && <span className="text-[#d36868]">*</span>}
      <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-[#5a5a5a]">{field.type}</span>
    </label>
  );
}

function StringField({ field, value, onChange }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.default ?? ''}
      className="w-full rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#4a4a4a] focus:border-[#3a3a3a]"
    />
  );
}

function MarkdownField({ field, value, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${Math.max(80, ref.current.scrollHeight)}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.default ?? 'Markdown supported — **bold**, *italic*, `code`, lists…'}
      className="w-full resize-none overflow-hidden rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-2 font-mono text-[12.5px] leading-relaxed text-[#e8e8e8] outline-none placeholder:text-[#4a4a4a] focus:border-[#3a3a3a]"
    />
  );
}

function CvssField({ field, value, onChange }) {
  const score = cvss3Score(value);
  const sev = cvssSeverity(score);
  return (
    <div className="flex items-center gap-2">
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        className="min-w-0 flex-1 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 font-mono text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#4a4a4a] focus:border-[#3a3a3a]"
      />
      <div
        className="flex flex-shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium"
        style={{ borderColor: `${sev.color}66`, color: sev.color, background: `${sev.color}14` }}
      >
        <span className="tabular-nums">{score == null ? '—' : score.toFixed(1)}</span>
        <span>·</span>
        <span>{sev.label}</span>
      </div>
    </div>
  );
}

function EnumField({ field, value, onChange }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1.5 text-[13px] text-[#e8e8e8] outline-none focus:border-[#3a3a3a]"
    >
      {field.choices?.map((c) => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  );
}

function DateField({ field, value, onChange }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 text-[13px] text-[#e8e8e8] outline-none focus:border-[#3a3a3a]"
    />
  );
}

function BooleanField({ field, value, onChange }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#c4c4c4]">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-[#3a3a3a] bg-[#1a1a1a]"
      />
      <span>{value ? 'Yes' : 'No'}</span>
    </label>
  );
}

function NumberField({ field, value, onChange }) {
  return (
    <input
      type="number"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-32 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 text-[13px] tabular-nums text-[#e8e8e8] outline-none focus:border-[#3a3a3a]"
    />
  );
}

function ListField({ field, value, onChange }) {
  const arr = Array.isArray(value) ? value : [];
  const itemSpec = field.items || { id: '', type: 'string', label: '' };
  const isPrimitive = itemSpec.type === 'string' || itemSpec.type === 'number';

  const update = (i, v) => {
    const next = [...arr];
    next[i] = v;
    onChange(next);
  };
  const remove = (i) => onChange(arr.filter((_, idx) => idx !== i));
  const add = () => onChange([...arr, defaultForField(itemSpec)]);

  return (
    <div className="space-y-1.5">
      {arr.map((v, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-2">
          <span className="mt-1.5 flex-shrink-0 font-mono text-[10px] text-[#5a5a5a]">{i + 1}</span>
          <div className="flex-1 min-w-0">
            {isPrimitive ? (
              <FieldByType field={itemSpec} value={v} onChange={(nv) => update(i, nv)} />
            ) : (
              <ObjectField field={itemSpec} value={v} onChange={(nv) => update(i, nv)} />
            )}
          </div>
          <button
            onClick={() => remove(i)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[#5a5a5a] transition-colors hover:bg-red-500/10 hover:text-[#e57373]"
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-[#3a3a3a] px-2.5 py-1 text-[12px] text-[#7a7a7a] transition-colors hover:border-[#5a5a5a] hover:text-[#c4c4c4]"
      >
        <Plus className="h-3 w-3" /> Add {itemSpec.label || 'item'}
      </button>
    </div>
  );
}

function ObjectField({ field, value, onChange }) {
  const obj = value && typeof value === 'object' ? value : {};
  return (
    <div className="space-y-2">
      {(field.properties || []).map((p) => (
        <div key={p.id}>
          <FieldLabel field={p} />
          <FieldByType
            field={p}
            value={obj[p.id]}
            onChange={(nv) => onChange({ ...obj, [p.id]: nv })}
          />
        </div>
      ))}
    </div>
  );
}

function ComboboxField({ field, value, onChange }) {
  // SysReptor combobox = free text with a suggestion list. We render an
  // <input> wired to a <datalist> so users get suggestions but can type
  // anything (e.g. for HTB CDSA's incident_severity).
  const listId = `combo-${field.id}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <>
      <input
        list={listId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.default ?? ''}
        className="w-full rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#4a4a4a] focus:border-[#3a3a3a]"
      />
      <datalist id={listId}>
        {(field.choices || []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        {(field.suggestions || []).map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}

function CweField({ field, value, onChange }) {
  // CWE is an identifier string like "CWE-79". No catalog lookup in this
  // local-first app — accept any string with a hint.
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="CWE-79"
      className="w-full rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 font-mono text-[12.5px] text-[#e8e8e8] outline-none placeholder:text-[#4a4a4a] focus:border-[#3a3a3a]"
    />
  );
}

function FieldByType({ field, value, onChange }) {
  switch (field.type) {
    case 'markdown': return <MarkdownField field={field} value={value} onChange={onChange} />;
    case 'cvss':     return <CvssField field={field} value={value} onChange={onChange} />;
    case 'cwe':      return <CweField field={field} value={value} onChange={onChange} />;
    case 'enum':     return <EnumField field={field} value={value} onChange={onChange} />;
    case 'combobox': return <ComboboxField field={field} value={value} onChange={onChange} />;
    case 'date':     return <DateField field={field} value={value} onChange={onChange} />;
    case 'boolean':  return <BooleanField field={field} value={value} onChange={onChange} />;
    case 'number':   return <NumberField field={field} value={value} onChange={onChange} />;
    case 'list':     return <ListField field={field} value={value} onChange={onChange} />;
    case 'object':   return <ObjectField field={field} value={value} onChange={onChange} />;
    case 'user':     return <StringField field={field} value={value} onChange={onChange} />;
    default:         return <StringField field={field} value={value} onChange={onChange} />;
  }
}

function FieldRow({ field, value, onChange }) {
  return (
    <div>
      <FieldLabel field={field} />
      <FieldByType field={field} value={value} onChange={onChange} />
    </div>
  );
}

// ─── Uploader ─────────────────────────────────────────────────────────────────

function Uploader({ onLoad }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    setError(null);
    setBusy(true);
    try {
      const parsed = await loadSysreptorFile(file);
      onLoad(parsed);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={`my-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-[#5b86c8] bg-[#5b86c8]/5' : 'border-[#2a2a2a] bg-[#1d1d1d]'
      }`}
      contentEditable={false}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="rounded-full bg-white/[0.04] p-3">
          <FileText className="h-6 w-6 text-[#7a7a7a]" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-[#e8e8e8]">SysReptor report</p>
          <p className="mt-1 text-[12px] text-[#7a7a7a]">
            Drop a design <span className="font-mono text-[#9a9a9a]">.tar.gz</span>,
            template <span className="font-mono text-[#9a9a9a]">.toml</span>,
            or project export to begin.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2 rounded-md border border-[#3a3a3a] bg-[#252525] px-3 py-1.5 text-[12.5px] text-[#e8e8e8] transition-colors hover:bg-[#2c2c2c] disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {busy ? 'Loading…' : 'Choose file'}
        </button>
        <p className="text-[11px] text-[#5a5a5a]">
          Grab one from{' '}
          <span className="font-mono">docs.sysreptor.com/demo-reports</span>
        </p>
        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-left text-[12px] text-[#e57373]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".tar.gz,.tgz,.toml,.json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

// ─── Bundle chooser ──────────────────────────────────────────────────────────
// Shown when the upload was a multi-design archive (e.g. htb-designs.tar.gz
// which contains all 8 HTB certification designs). User picks which one.

function BundleChooser({ bundle, onPick, onCancel }) {
  return (
    <div
      className="my-2 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1d1d1d]"
      contentEditable={false}
    >
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] text-[#c4c4c4]">
          <FileText className="h-3.5 w-3.5 text-[#7a7a7a]" />
          <span className="font-medium">Choose a report template</span>
          <span className="text-[#6e6e6e]">·</span>
          <span className="text-[#6e6e6e]">
            {bundle.designs.length} designs in this bundle
          </span>
        </div>
        <button
          onClick={onCancel}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#9a9a9a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {bundle.designs.map((d) => {
          const sections = d.toml?.report_sections?.length ?? 0;
          const findings = d.toml?.finding_fields?.length ?? 0;
          return (
            <button
              key={d.sourceName}
              onClick={() => onPick(d)}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex flex-col items-start gap-1 rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] p-3 text-left transition-colors hover:border-[#3a3a3a] hover:bg-[#272727]"
            >
              <FileText className="h-[18px] w-[18px] text-[#9a9a9a]" strokeWidth={1.7} />
              <span className="mt-1 text-[12.5px] font-medium text-[#e8e8e8]">{d.name}</span>
              <span className="text-[11px] leading-snug text-[#7a7a7a]">
                {sections} section{sections !== 1 ? 's' : ''} · {findings} finding field{findings !== 1 ? 's' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Loaded report editor ─────────────────────────────────────────────────────

function ReportEditor({ designRef, schemaRef, filled, assets, onChange, onReplace }) {
  const schema = schemaRef;
  const [selected, setSelected] = useState(() =>
    schema.sections[0]?.id ? `section:${schema.sections[0].id}` : (filled.findings[0] ? `finding:${filled.findings[0].id}` : null)
  );
  const [findingsOpen, setFindingsOpen] = useState(true);
  const [sectionsOpen, setSectionsOpen] = useState(true);

  const selectedSection = selected?.startsWith('section:')
    ? schema.sections.find((s) => s.id === selected.slice('section:'.length))
    : null;
  const selectedFinding = selected?.startsWith('finding:')
    ? filled.findings.find((f) => f.id === selected.slice('finding:'.length))
    : null;

  const setSectionField = (sectionId, fieldId, value) => {
    onChange({
      ...filled,
      sections: {
        ...filled.sections,
        [sectionId]: { ...(filled.sections[sectionId] || {}), [fieldId]: value },
      },
    });
  };

  const setFindingField = (findingId, fieldId, value) => {
    onChange({
      ...filled,
      findings: filled.findings.map((f) =>
        f.id === findingId ? { ...f, data: { ...f.data, [fieldId]: value } } : f
      ),
    });
  };

  const addFinding = () => {
    const f = { id: newId('find'), status: 'in-progress', data: emptyFindingData(schema) };
    f.data.title = f.data.title || 'New finding';
    onChange({ ...filled, findings: [...filled.findings, f] });
    setSelected(`finding:${f.id}`);
  };

  const removeFinding = (id) => {
    const next = filled.findings.filter((f) => f.id !== id);
    onChange({ ...filled, findings: next });
    if (selected === `finding:${id}`) {
      setSelected(next[0] ? `finding:${next[0].id}` : (schema.sections[0] ? `section:${schema.sections[0].id}` : null));
    }
  };

  const handleExportToml = () => {
    const toml = exportProjectToml(filled, schema);
    const blob = new Blob([toml], { type: 'application/toml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(filled.meta?.name || schema.name || 'report').replace(/[^a-z0-9_-]+/gi, '_')}.toml`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportPdf = async () => {
    const tmpl = designRef.toml?.report_template;
    if (!tmpl) {
      // No design template available (probably a finding-template or project import).
      // Fall back to our generic print view so the user still gets something.
      openPrintView(schema, filled);
      return;
    }
    try {
      // Dynamic import so Vue + marked + sysreptor CSS are only fetched
      // the first time the user clicks Export-to-PDF, keeping the main
      // editor bundle slim. Vite emits a separate chunk for this.
      const { renderToPrint } = await import('@/lib/sysreptorRender');
      await renderToPrint(designRef, schema, filled, assets || {});
    } catch (e) {
      console.error('[report] render failed', e);
      alert(`Render failed: ${e?.message || e}\n\nFalling back to generic print view.`);
      openPrintView(schema, filled);
    }
  };

  return (
    <div
      className="my-2 w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1d1d1d]"
      contentEditable={false}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#2a2a2a] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-[#c4c4c4]">
          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#7a7a7a]" />
          <span className="truncate font-medium">{filled.meta?.name || schema.name}</span>
          <span className="flex-shrink-0 text-[#6e6e6e]">·</span>
          <span className="flex-shrink-0 text-[#6e6e6e]">
            {schema.sections.length} sections, {filled.findings.length} finding{filled.findings.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={handleExportPdf}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#9a9a9a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
            title="Open print preview (save as PDF)"
          >
            <Printer className="h-3.5 w-3.5" /> PDF
          </button>
          <button
            onClick={handleExportToml}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#9a9a9a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
            title="Download a projects/v2 TOML re-importable into SysReptor"
          >
            <FileDown className="h-3.5 w-3.5" /> .toml
          </button>
          <button
            onClick={onReplace}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#9a9a9a] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
            title="Replace template"
          >
            <FileType className="h-3.5 w-3.5" /> Template
          </button>
        </div>
      </div>

      <div className="flex min-h-[480px]">
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-[#2a2a2a] bg-[#1a1a1a] p-2">
          {/* Sections group */}
          <button
            onClick={() => setSectionsOpen((v) => !v)}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10.5px] uppercase tracking-wider text-[#7a7a7a] transition-colors hover:text-[#c4c4c4]"
          >
            {sectionsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Sections
          </button>
          {sectionsOpen && (
            <div className="mt-0.5 space-y-0.5">
              {schema.sections.map((s) => {
                const active = selected === `section:${s.id}`;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(`section:${s.id}`)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12.5px] transition-colors ${
                      active ? 'bg-white/[0.07] text-[#e8e8e8]' : 'text-[#9a9a9a] hover:bg-white/[0.04] hover:text-[#c4c4c4]'
                    }`}
                  >
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Findings group */}
          <div className="mt-3">
            <button
              onClick={() => setFindingsOpen((v) => !v)}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10.5px] uppercase tracking-wider text-[#7a7a7a] transition-colors hover:text-[#c4c4c4]"
            >
              {findingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Findings
              <span className="ml-auto text-[10px] tabular-nums normal-case text-[#5a5a5a]">{filled.findings.length}</span>
            </button>
            {findingsOpen && (
              <div className="mt-0.5 space-y-0.5">
                {filled.findings.map((f) => {
                  const active = selected === `finding:${f.id}`;
                  const score = cvss3Score(f.data?.cvss);
                  const sev = cvssSeverity(score);
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelected(`finding:${f.id}`)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`group flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12.5px] transition-colors ${
                        active ? 'bg-white/[0.07] text-[#e8e8e8]' : 'text-[#9a9a9a] hover:bg-white/[0.04] hover:text-[#c4c4c4]'
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: sev.color }}
                        title={sev.label}
                      />
                      <span className="min-w-0 flex-1 truncate">{f.data?.title || 'Untitled finding'}</span>
                      <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-[#5a5a5a]">
                        {score == null ? '—' : score.toFixed(1)}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={addFinding}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[12px] text-[#7a7a7a] transition-colors hover:bg-white/[0.04] hover:text-[#c4c4c4]"
                >
                  <Plus className="h-3 w-3" /> Add finding
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main pane */}
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {selectedSection && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-[15px] font-semibold text-[#e8e8e8]">{selectedSection.label}</h3>
                <p className="mt-0.5 font-mono text-[11px] text-[#5a5a5a]">{selectedSection.id}</p>
              </div>
              {selectedSection.fields.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  value={filled.sections[selectedSection.id]?.[f.id]}
                  onChange={(v) => setSectionField(selectedSection.id, f.id, v)}
                />
              ))}
              {selectedSection.fields.length === 0 && (
                <p className="text-[12px] text-[#7a7a7a]">This section has no editable fields.</p>
              )}
            </div>
          )}

          {selectedFinding && (
            <div className="space-y-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-[#e8e8e8]">
                    {selectedFinding.data?.title || 'Untitled finding'}
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] text-[#5a5a5a]">
                    finding · {selectedFinding.id}
                  </p>
                </div>
                <button
                  onClick={() => removeFinding(selectedFinding.id)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#9a9a9a] transition-colors hover:bg-red-500/10 hover:text-[#e57373]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
              {schema.findingFields.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  value={selectedFinding.data?.[f.id]}
                  onChange={(v) => setFindingField(selectedFinding.id, f.id, v)}
                />
              ))}
            </div>
          )}

          {!selectedSection && !selectedFinding && (
            <div className="flex h-full items-center justify-center text-[12.5px] text-[#7a7a7a]">
              Select a section or finding from the left.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Print view ───────────────────────────────────────────────────────────────
// Open a new window with a printable HTML rendering of the filled report,
// then trigger window.print(). User can "save as PDF" from the print dialog.

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Minimal markdown → HTML (headings, bold, italic, code, lists, paragraphs).
// Pentest report fields are usually short prose — this is intentionally simple.
function md(input) {
  if (!input) return '';
  let s = escapeHtml(input);
  // fenced code
  s = s.replace(/```([a-z0-9]*)\n([\s\S]*?)```/gi, (_, lang, code) =>
    `<pre><code class="lang-${lang || 'text'}">${code}</code></pre>`);
  // headings
  s = s.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  s = s.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  s = s.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  s = s.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  s = s.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  s = s.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  // bold + italic + inline code
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // lists
  s = s.replace(/(^|\n)((?:[ \t]*[-*+]\s+.+\n?)+)/g, (_, lead, block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^[ \t]*[-*+]\s+/, ''));
    return `${lead}<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  });
  s = s.replace(/(^|\n)((?:[ \t]*\d+\.\s+.+\n?)+)/g, (_, lead, block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^[ \t]*\d+\.\s+/, ''));
    return `${lead}<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
  });
  // paragraphs (anything left that isn't already a block)
  s = s.split(/\n{2,}/).map((para) => {
    if (/^\s*<(h\d|ul|ol|pre|blockquote)/.test(para)) return para;
    return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');
  return s;
}

function renderValue(field, value) {
  if (value == null || value === '') return '<span class="empty">—</span>';
  switch (field.type) {
    case 'markdown': return md(value);
    case 'cvss': {
      const score = cvss3Score(value);
      const sev = cvssSeverity(score);
      return `<span class="cvss-vec">${escapeHtml(value)}</span> <span class="cvss-score" style="background:${sev.color}22;color:${sev.color};border-color:${sev.color}66">${score == null ? '—' : score.toFixed(1)} · ${sev.label}</span>`;
    }
    case 'list':
      if (!Array.isArray(value) || !value.length) return '<span class="empty">—</span>';
      if (field.items?.type === 'object') {
        return `<ol>${value.map((item) => `<li>${
          (field.items.properties || []).map((p) => `<div><strong>${escapeHtml(p.label)}:</strong> ${renderValue(p, item?.[p.id])}</div>`).join('')
        }</li>`).join('')}</ol>`;
      }
      return `<ul>${value.map((v) => `<li>${escapeHtml(String(v))}</li>`).join('')}</ul>`;
    case 'object':
      return (field.properties || []).map((p) =>
        `<div class="row"><strong>${escapeHtml(p.label)}:</strong> ${renderValue(p, value?.[p.id])}</div>`
      ).join('');
    case 'boolean': return value ? 'Yes' : 'No';
    case 'date': return escapeHtml(value);
    default: return escapeHtml(String(value));
  }
}

function openPrintView(schema, filled) {
  const meta = filled.meta || {};
  const title = meta.name || schema.name || 'Report';

  // Sort findings by CVSS desc so the most severe lead.
  const findings = [...filled.findings].sort((a, b) => {
    const sa = cvss3Score(a.data?.cvss) ?? -1;
    const sb = cvss3Score(b.data?.cvss) ?? -1;
    return sb - sa;
  });

  const sectionsHtml = schema.sections.map((s) => {
    const data = filled.sections[s.id] || {};
    return `
      <section class="report-section">
        <h2>${escapeHtml(s.label)}</h2>
        ${s.fields.map((f) => `
          <div class="field">
            <h3>${escapeHtml(f.label)}</h3>
            <div class="value">${renderValue(f, data[f.id])}</div>
          </div>
        `).join('')}
      </section>
    `;
  }).join('');

  const findingsHtml = findings.map((f, idx) => {
    const score = cvss3Score(f.data?.cvss);
    const sev = cvssSeverity(score);
    return `
      <section class="finding">
        <header class="finding-header">
          <div class="finding-num">${idx + 1}</div>
          <div class="finding-title-wrap">
            <h2 class="finding-title">${escapeHtml(f.data?.title || 'Untitled finding')}</h2>
            <div class="finding-meta">
              <span class="cvss-pill" style="background:${sev.color}22;color:${sev.color};border-color:${sev.color}66">
                ${score == null ? '—' : score.toFixed(1)} · ${sev.label}
              </span>
              ${f.data?.cvss ? `<span class="cvss-vec">${escapeHtml(f.data.cvss)}</span>` : ''}
            </div>
          </div>
        </header>
        ${schema.findingFields.filter((ff) => ff.id !== 'title' && ff.id !== 'cvss').map((ff) => `
          <div class="field">
            <h3>${escapeHtml(ff.label)}</h3>
            <div class="value">${renderValue(ff, f.data?.[ff.id])}</div>
          </div>
        `).join('')}
      </section>
    `;
  }).join('');

  // Severity summary for the cover/exec area
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0, None: 0, 'N/A': 0 };
  for (const f of findings) {
    const s = cvssSeverity(cvss3Score(f.data?.cvss));
    sevCounts[s.label] = (sevCounts[s.label] || 0) + 1;
  }

  const html = `<!doctype html>
<html lang="${escapeHtml(meta.language || schema.language || 'en')}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1a1a1a; background: #ffffff;
    font-size: 11pt; line-height: 1.55;
  }
  h1, h2, h3, h4 { font-family: 'Inter', sans-serif; color: #0f172a; }
  h1 { font-size: 28pt; margin: 0 0 8pt; letter-spacing: -0.5pt; }
  h2 { font-size: 16pt; margin: 24pt 0 10pt; padding-bottom: 4pt; border-bottom: 1pt solid #d1d5db; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 14pt 0 4pt; color: #475569; text-transform: uppercase; letter-spacing: 0.5pt; font-weight: 600; }
  p { margin: 6pt 0; }
  code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9.5pt; background: #f1f5f9; padding: 1pt 4pt; border-radius: 3pt; }
  pre { background: #0f172a; color: #e2e8f0; padding: 8pt 10pt; border-radius: 4pt; overflow-x: auto; font-size: 9pt; }
  pre code { background: transparent; color: inherit; padding: 0; }
  ul, ol { padding-left: 18pt; margin: 6pt 0; }
  .empty { color: #94a3b8; font-style: italic; }

  .cover {
    page-break-after: always;
    height: calc(297mm - 44mm);
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .cover .title-block { margin-top: 60pt; }
  .cover .badge {
    display: inline-block; padding: 3pt 8pt; border: 1pt solid #cbd5e1;
    border-radius: 4pt; font-size: 9pt; letter-spacing: 0.5pt; text-transform: uppercase;
    color: #475569; margin-bottom: 12pt;
  }
  .cover .summary { margin-top: auto; }
  .sev-grid { display: flex; gap: 8pt; margin-top: 14pt; }
  .sev-cell { flex: 1; padding: 10pt 12pt; border: 1pt solid #e2e8f0; border-radius: 4pt; }
  .sev-cell .n { font-size: 22pt; font-weight: 700; line-height: 1; }
  .sev-cell .l { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #64748b; margin-top: 4pt; }

  .report-section { page-break-inside: auto; }
  .finding { page-break-inside: avoid; margin-top: 18pt; padding-top: 12pt; border-top: 0.6pt solid #e2e8f0; }
  .finding:first-of-type { border-top: none; }
  .finding-header { display: flex; gap: 12pt; align-items: flex-start; }
  .finding-num {
    flex-shrink: 0; width: 32pt; height: 32pt; border-radius: 50%;
    background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center;
    font-weight: 600; font-size: 12pt;
  }
  .finding-title { margin: 0; font-size: 15pt; }
  .finding-meta { margin-top: 4pt; display: flex; gap: 8pt; flex-wrap: wrap; align-items: center; }
  .cvss-pill { display: inline-block; padding: 1pt 7pt; border-radius: 4pt; border: 0.6pt solid; font-size: 9pt; font-weight: 600; }
  .cvss-vec { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 8.5pt; color: #64748b; }

  .field { margin: 8pt 0 14pt; }
  .field .value { color: #1f2937; }
  .row { margin: 3pt 0; }
</style>
</head>
<body>
  <section class="cover">
    <div class="title-block">
      <div class="badge">Penetration Test Report</div>
      <h1>${escapeHtml(title)}</h1>
      <p style="color:#475569;font-size:12pt;margin-top:4pt">${escapeHtml(meta.language || schema.language || '')}</p>
    </div>
    <div class="summary">
      <h3 style="margin-bottom:4pt">Findings summary</h3>
      <div class="sev-grid">
        ${['Critical','High','Medium','Low','None'].map((label) => {
          const c = cvssSeverity(label === 'Critical' ? 9.5 : label === 'High' ? 8 : label === 'Medium' ? 5 : label === 'Low' ? 2 : 0).color;
          return `<div class="sev-cell" style="border-color:${c}66"><div class="n" style="color:${c}">${sevCounts[label] || 0}</div><div class="l">${label}</div></div>`;
        }).join('')}
      </div>
      <p style="margin-top:18pt;color:#94a3b8;font-size:8.5pt">Generated by Cyber-Notes · ${new Date().toLocaleDateString()}</p>
    </div>
  </section>

  ${sectionsHtml}

  ${findings.length > 0 ? `<section class="report-section"><h2>Findings</h2>${findingsHtml}</section>` : ''}

  <script>
    window.addEventListener('load', () => setTimeout(() => window.print(), 200));
  </script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked — please allow pop-ups for this site to export PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ─── Block root ───────────────────────────────────────────────────────────────

function ReportBlockInner({ block, editor }) {
  const reportId = block.props.reportId || `rep_${block.id.slice(0, 12)}`;
  const [state, setState] = useState(null); // { design, schema, filled } | null
  const [bundle, setBundle] = useState(null); // { designs, assets } when user uploaded a multi-design archive
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!block.props.reportId) {
      editor.updateBlock(block, { type: 'report', props: { ...block.props, reportId } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted state
  useEffect(() => {
    let cancelled = false;
    persistGet(reportKey(reportId)).then((stored) => {
      if (cancelled) return;
      if (stored?.design?.toml) {
        const schema = extractSchema(stored.design);
        setState({
          design: stored.design,
          schema,
          filled: stored.filled,
          assets: stored.assets || {},
        });
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reportId]);

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Keep the design TOML + assets. IndexedDB serializes Uint8Array natively.
      const designForStorage = next.design ? {
        toml: next.design.toml,
        sourceName: next.design.sourceName,
        kind: next.design.kind,
      } : null;
      persistSet(reportKey(reportId), {
        design: designForStorage,
        filled: next.filled,
        assets: next.assets || {},
      });
    }, 400);
  }, [reportId]);

  // Internal: load one specific design (used both for direct design uploads
  // and after a user picks one out of a multi-design bundle).
  const loadDesign = useCallback((designLike, assets) => {
    const schema = extractSchema(designLike);
    const filled = {
      sections: Object.fromEntries(schema.sections.map((s) => [s.id, emptySectionData(schema, s.id)])),
      findings: [],
      meta: { name: schema.name, language: schema.language },
    };
    const preview = designLike.toml?.report_preview_data || {};
    // Seed section fields from preview_data.report (flat dict keyed by field id).
    if (preview.report) {
      for (const s of schema.sections) {
        for (const f of s.fields) {
          const seeded = preview.report[f.id];
          if (seeded !== undefined) filled.sections[s.id][f.id] = seeded;
        }
      }
    }
    // Seed findings from preview_data.findings — these come as flat objects
    // (not wrapped in {data:}) in the design's preview_data. Wrap each so it
    // matches my internal { id, status, data } shape.
    if (Array.isArray(preview.findings) && preview.findings.length) {
      filled.findings = preview.findings.map((pf, i) => {
        const { id, status, order, created, ...data } = pf;
        return {
          id: id || `find_preview_${i}`,
          status: status || 'in-progress',
          data,
        };
      });
    }
    const next = { design: designLike, schema, filled, assets: assets || {} };
    setState(next);
    setBundle(null);
    persist(next);
  }, [persist]);

  const handleBundlePick = useCallback((picked) => {
    loadDesign({ kind: 'design', toml: picked.toml, sourceName: picked.sourceName }, bundle?.assets || {});
  }, [bundle, loadDesign]);

  const handleLoad = useCallback((parsed) => {
    if (parsed.kind === 'bundle') {
      // Multi-design archive (htb-designs.tar.gz, etc.) — show the chooser.
      setBundle({ designs: parsed.designs, assets: parsed.assets });
      return;
    }
    if (parsed.kind === 'finding-template') {
      // Without a design we can't show sections. Wrap in a minimal synthetic design.
      const synth = {
        kind: 'design',
        sourceName: parsed.sourceName,
        toml: {
          format: 'projecttypes/v2',
          name: parsed.toml.translations?.[0]?.data?.title || 'Single-finding report',
          language: parsed.toml.translations?.[0]?.language || 'en-US',
          report_sections: [],
          finding_fields: inferFindingFieldsFromTemplate(parsed.toml),
        },
      };
      const schema = extractSchema(synth);
      const main = parsed.toml.translations?.find((t) => t.is_main) || parsed.toml.translations?.[0];
      const filled = {
        sections: {},
        findings: [{ id: newId('find'), status: 'in-progress', data: { ...(main?.data || {}) } }],
        meta: { name: synth.toml.name, language: synth.toml.language },
      };
      const next = { design: synth, schema, filled, assets: parsed.assets || {} };
      setState(next);
      persist(next);
      return;
    }
    if (parsed.kind === 'project') {
      // A filled project — but without its design, we can only show what fields it stored.
      const synth = {
        kind: 'design',
        sourceName: parsed.sourceName,
        toml: {
          format: 'projecttypes/v2',
          name: parsed.toml.name,
          language: parsed.toml.language,
          report_sections: inferSectionsFromProject(parsed.toml),
          finding_fields: inferFindingFieldsFromProject(parsed.toml),
        },
      };
      const schema = extractSchema(synth);
      const filled = hydrateFromProject(parsed, schema);
      const next = { design: synth, schema, filled, assets: parsed.assets || {} };
      setState(next);
      persist(next);
      return;
    }
    // design — delegate to loadDesign so preview-data seeding (sections + findings)
    // happens identically here and via the bundle picker.
    loadDesign(parsed, parsed.assets || {});
  }, [persist, loadDesign]);

  const handleFilledChange = useCallback((nextFilled) => {
    setState((s) => {
      const next = { ...s, filled: nextFilled };
      persist(next);
      return next;
    });
  }, [persist]);

  const handleReplace = useCallback(() => {
    if (!confirm('Replace the current report template? Your filled data will be cleared.')) return;
    setState(null);
    persistSet(reportKey(reportId), null);
  }, [reportId]);

  if (loading) {
    return (
      <div className="my-2 flex h-24 w-full items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#202020] text-[12px] text-[#6e6e6e]" contentEditable={false}>
        Loading report…
      </div>
    );
  }

  if (bundle) {
    return <BundleChooser bundle={bundle} onPick={handleBundlePick} onCancel={() => setBundle(null)} />;
  }

  if (!state) {
    return <Uploader onLoad={handleLoad} />;
  }

  return (
    <ReportEditor
      designRef={state.design}
      schemaRef={state.schema}
      filled={state.filled}
      assets={state.assets}
      onChange={handleFilledChange}
      onReplace={handleReplace}
    />
  );
}

// ─── Inference helpers (for non-design uploads) ───────────────────────────────

function inferFindingFieldsFromTemplate(templateToml) {
  const data = templateToml.translations?.[0]?.data || {};
  return inferFieldsFromObject(data);
}

function inferFindingFieldsFromProject(projectToml) {
  const sample = projectToml.findings?.[0]?.data || {};
  return inferFieldsFromObject(sample);
}

function inferSectionsFromProject(projectToml) {
  const ids = (projectToml.sections || []).map((s) => s.id);
  const data = projectToml.report_data || {};
  // Without the design we don't know which field belongs to which section,
  // so collapse everything into a single "Report data" section.
  if (!ids.length) {
    return [{ id: 'report', label: 'Report', fields: inferFieldsFromObject(data) }];
  }
  return [{ id: ids[0], label: ids[0].replace(/_/g, ' '), fields: inferFieldsFromObject(data) }];
}

function inferFieldsFromObject(obj) {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    out.push({
      id: k,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type: inferType(k, v),
      required: false,
    });
  }
  return out;
}

function inferType(key, v) {
  if (key === 'cvss' || (typeof v === 'string' && v.startsWith('CVSS:'))) return 'cvss';
  if (Array.isArray(v)) return 'list';
  if (v && typeof v === 'object') return 'object';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string' && v.includes('\n')) return 'markdown';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date';
  return 'string';
}

// ─── Block spec ───────────────────────────────────────────────────────────────

export const ReportBlock = createReactBlockSpec(
  {
    type: 'report',
    propSchema: { reportId: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => <ReportBlockInner block={block} editor={editor} />,
  }
);
