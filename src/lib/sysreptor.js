// SysReptor template loader + serializer.
//
// SysReptor exchanges templates as .tar.gz bundles containing one TOML file
// plus an optional `<id>-assets/` directory. The TOML's `format` field is the
// discriminator:
//
//   projecttypes/v2  → design (field schema + Vue HTML + CSS)
//   templates/v2     → finding template (one reusable finding)
//   projects/v2      → filled project export
//
// We support reading all three and writing `projects/v2` for round-tripping
// a filled report back into real SysReptor.

import { gunzipSync, strFromU8 } from 'fflate';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

// ─── tar reader ───────────────────────────────────────────────────────────────
// USTAR header = 512 bytes. File body padded to a 512-byte boundary.

const decoder = new TextDecoder();

function parseTarHeader(view, offset) {
  const slice = (start, len) => {
    const bytes = view.subarray(offset + start, offset + start + len);
    // Strip trailing NULs and whitespace
    let end = bytes.length;
    while (end > 0 && (bytes[end - 1] === 0 || bytes[end - 1] === 0x20)) end--;
    return decoder.decode(bytes.subarray(0, end));
  };
  const name = slice(0, 100);
  if (!name) return null; // zero block → end of archive
  const sizeOctal = slice(124, 12);
  const size = parseInt(sizeOctal || '0', 8);
  const typeflag = String.fromCharCode(view[offset + 156]);
  // ustar prefix
  const prefix = slice(345, 155);
  const fullPath = prefix ? `${prefix}/${name}` : name;
  return { path: fullPath, size, typeflag };
}

function readTar(uint8) {
  const files = [];
  let offset = 0;
  while (offset + 512 <= uint8.length) {
    const header = parseTarHeader(uint8, offset);
    if (!header) break; // empty block — end of archive
    offset += 512;
    if (header.typeflag === '0' || header.typeflag === '' || header.typeflag === '\0') {
      // regular file
      const body = uint8.subarray(offset, offset + header.size);
      files.push({ path: header.path, bytes: body });
    }
    // advance past file body, rounded up to 512
    offset += Math.ceil(header.size / 512) * 512;
  }
  return files;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Read a SysReptor bundle (File / Blob / ArrayBuffer) and return its parsed shape.
 * Accepts:
 *   - .tar.gz containing one TOML + assets
 *   - bare .toml file
 *   - bare .json (CLI export)
 */
export async function loadSysreptorFile(input) {
  let bytes;
  let filename = '';
  if (input instanceof File || input instanceof Blob) {
    filename = input.name || '';
    bytes = new Uint8Array(await input.arrayBuffer());
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    throw new Error('loadSysreptorFile: unsupported input');
  }

  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const isTar = !isGzip && bytes.length > 257 &&
    bytes[257] === 0x75 && bytes[258] === 0x73 && bytes[259] === 0x74 && bytes[260] === 0x61 && bytes[261] === 0x72;

  // ── tar.gz path ─────────────────────────────────────────────────────────────
  if (isGzip || isTar) {
    const tarBytes = isGzip ? gunzipSync(bytes) : bytes;
    const files = readTar(tarBytes);

    // SysReptor's CLI emits .toml; their web bundles emit .json — accept either.
    // Skip files inside `<id>-assets/` directories (those are bundled assets, not designs).
    const isData = (p) => (/\.(toml|json)$/i.test(p)) && !p.split('/').some((seg) => seg.endsWith('-assets')) && !p.startsWith('.');
    const candidates = files.filter((f) => isData(f.path));
    if (!candidates.length) throw new Error('No .toml or .json template file inside the bundle');

    // Parse every candidate. If more than one is a design (e.g. HTB's
    // multi-design bundle), surface them all so the caller can show a picker.
    const parsed = candidates.map((c) => {
      try {
        return { path: c.path, data: parseDataFile(c.path, c.bytes) };
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Assets keyed by file path (any file outside an existing candidate path).
    const candidatePaths = new Set(parsed.map((p) => p.path));
    const assets = {};
    for (const f of files) {
      if (candidatePaths.has(f.path)) continue;
      if (/\/$/.test(f.path)) continue;
      assets[f.path] = f.bytes;
    }

    const designs = parsed.filter((p) => p.data?.format === 'projecttypes/v2');
    if (designs.length > 1) {
      return {
        kind: 'bundle',
        sourceName: filename,
        designs: designs.map((d) => ({
          toml: d.data,
          sourceName: d.path,
          name: d.data?.name || d.path,
        })),
        assets,
      };
    }

    // Single design (or no designs but maybe finding-templates / projects).
    const chosen = parsed.find((p) => p.data?.format === 'projecttypes/v2') || parsed[0];
    return classify({ toml: chosen.data, assets, sourceName: filename || chosen.path });
  }

  // ── bare .toml path ─────────────────────────────────────────────────────────
  if (/\.toml$/i.test(filename) || looksLikeToml(bytes)) {
    const toml = parseToml(strFromU8(bytes));
    return classify({ toml, assets: {}, sourceName: filename });
  }

  // ── bare .json path ─────────────────────────────────────────────────────────
  if (/\.json$/i.test(filename)) {
    const json = JSON.parse(strFromU8(bytes));
    return classify({ toml: json, assets: {}, sourceName: filename });
  }

  throw new Error(`Could not detect format of ${filename || 'uploaded file'}`);
}

function looksLikeToml(bytes) {
  const head = strFromU8(bytes.subarray(0, 128));
  return /^\s*(format\s*=|\[\[|#)/m.test(head);
}

function parseDataFile(path, bytes) {
  const text = strFromU8(bytes);
  if (/\.json$/i.test(path)) return JSON.parse(text);
  return parseToml(text);
}

function classify({ toml, assets, sourceName }) {
  const format = toml.format || '';
  if (format === 'projecttypes/v2') {
    return { kind: 'design', toml, assets, sourceName };
  }
  if (format === 'templates/v2') {
    return { kind: 'finding-template', toml, assets, sourceName };
  }
  if (format === 'projects/v2') {
    return { kind: 'project', toml, assets, sourceName };
  }
  // Heuristics for older or partial templates
  if (toml.report_sections && toml.finding_fields) {
    return { kind: 'design', toml, assets, sourceName };
  }
  if (toml.translations) {
    return { kind: 'finding-template', toml, assets, sourceName };
  }
  return { kind: 'unknown', toml, assets, sourceName };
}

// ─── Schema extraction ────────────────────────────────────────────────────────

/**
 * Given a design TOML, return a normalized view:
 *   {
 *     name,
 *     language,
 *     sections: [{ id, label, fields: Field[] }],
 *     findingFields: Field[],
 *   }
 *
 * Field = { id, type, label, required, default, choices, items, properties }
 */
export function extractSchema(design) {
  const t = design.toml || {};
  const sections = (t.report_sections || []).map((s) => ({
    id: s.id,
    label: s.label || s.id,
    fields: (s.fields || []).map(normalizeField),
  }));
  const findingFields = (t.finding_fields || []).map(normalizeField);
  return {
    name: t.name || design.sourceName || 'Untitled report design',
    language: t.language || 'en-US',
    sections,
    findingFields,
    findingOrdering: t.finding_ordering || [],
    previewData: t.report_preview_data || null,
  };
}

function normalizeField(f) {
  const out = {
    id: f.id || '',
    type: f.type || 'string',
    label: f.label || f.id || '',
    required: !!f.required,
    default: f.default,
    spellcheck: f.spellcheck !== false,
    origin: f.origin || 'custom',
  };
  if (f.choices) out.choices = f.choices.map((c) => ({ value: c.value, label: c.label || c.value }));
  if (f.items) out.items = normalizeField(f.items);
  if (f.properties) out.properties = f.properties.map(normalizeField);
  return out;
}

// Default value for a brand-new instance of a field, used when adding a list/finding item.
export function defaultForField(field) {
  if (field.default !== undefined && field.default !== null) return field.default;
  switch (field.type) {
    case 'list':   return [];
    case 'object': {
      const o = {};
      (field.properties || []).forEach((p) => { o[p.id] = defaultForField(p); });
      return o;
    }
    case 'boolean': return false;
    case 'number':  return 0;
    case 'enum':    return field.choices?.[0]?.value ?? '';
    case 'date':    return '';
    case 'cvss':    return 'n/a';
    default:        return '';
  }
}

export function emptyFindingData(schema) {
  const data = {};
  for (const f of schema.findingFields) {
    data[f.id] = defaultForField(f);
  }
  return data;
}

export function emptySectionData(schema, sectionId) {
  const section = schema.sections.find((s) => s.id === sectionId);
  if (!section) return {};
  const data = {};
  for (const f of section.fields) {
    data[f.id] = defaultForField(f);
  }
  return data;
}

// ─── CVSS helpers ─────────────────────────────────────────────────────────────
// Convert a CVSS v3.1 vector string to a numeric base score (rounded up to 1 dp).
// Returns null if the string isn't parseable.

const CVSS3_METRICS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR_unchanged: { N: 0.85, L: 0.62, H: 0.27 },
  PR_changed:   { N: 0.85, L: 0.68, H: 0.5 },
  UI: { N: 0.85, R: 0.62 },
  C:  { H: 0.56, L: 0.22, N: 0 },
  I:  { H: 0.56, L: 0.22, N: 0 },
  A:  { H: 0.56, L: 0.22, N: 0 },
};

export function cvss3Score(vec) {
  if (!vec || typeof vec !== 'string') return null;
  if (!vec.startsWith('CVSS:3')) return null;
  const parts = vec.split('/').slice(1);
  const m = {};
  for (const p of parts) {
    const [k, v] = p.split(':');
    m[k] = v;
  }
  const AV = CVSS3_METRICS.AV[m.AV];
  const AC = CVSS3_METRICS.AC[m.AC];
  const UI = CVSS3_METRICS.UI[m.UI];
  const Scope = m.S;
  const PR = Scope === 'C' ? CVSS3_METRICS.PR_changed[m.PR] : CVSS3_METRICS.PR_unchanged[m.PR];
  const C = CVSS3_METRICS.C[m.C];
  const I = CVSS3_METRICS.I[m.I];
  const A = CVSS3_METRICS.A[m.A];
  if ([AV, AC, UI, PR, C, I, A].some((v) => v === undefined)) return null;
  const iss = 1 - (1 - C) * (1 - I) * (1 - A);
  const impact = Scope === 'C'
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  const exploitability = 8.22 * AV * AC * PR * UI;
  if (impact <= 0) return 0;
  const base = Scope === 'C'
    ? Math.min(1.08 * (impact + exploitability), 10)
    : Math.min(impact + exploitability, 10);
  return Math.ceil(base * 10) / 10;
}

export function cvssSeverity(score) {
  if (score == null) return { label: 'N/A',      color: '#7a7a7a' };
  if (score === 0)    return { label: 'None',     color: '#7a7a7a' };
  if (score < 4)      return { label: 'Low',      color: '#67b365' };
  if (score < 7)      return { label: 'Medium',   color: '#d4a14a' };
  if (score < 9)      return { label: 'High',     color: '#d68c5a' };
  return { label: 'Critical', color: '#d36868' };
}

// ─── Serializer: filled state → projects/v2 TOML ──────────────────────────────

/**
 * filled = { sections: { [sectionId]: { [fieldId]: value } },
 *            findings: [{ id, status, data: { [fieldId]: value } }],
 *            meta: { name, language, ... } }
 */
export function exportProjectToml(filled, schema) {
  const proj = {
    format: 'projects/v2',
    id: crypto.randomUUID(),
    name: filled.meta?.name || schema.name || 'Untitled',
    language: filled.meta?.language || schema.language || 'en-US',
    tags: filled.meta?.tags || [],
    members: [],
    pentesters: [],
    imported_members: [],
    images: [],
    sections: schema.sections.map((s) => ({
      id: s.id,
      status: filled.sections?.[s.id]?._status || 'in-progress',
      assignee: null,
    })),
    report_data: flattenReportData(filled, schema),
    findings: (filled.findings || []).map((f) => ({
      id: f.id,
      status: f.status || 'in-progress',
      assignee: null,
      template: null,
      data: stripPrivate(f.data || {}),
    })),
  };
  return stringifyToml(proj);
}

function flattenReportData(filled, schema) {
  const out = {};
  for (const s of schema.sections) {
    const data = filled.sections?.[s.id] || {};
    for (const f of s.fields) {
      if (f.id in data && data[f.id] !== undefined) {
        out[f.id] = data[f.id];
      } else if (f.default !== undefined) {
        out[f.id] = f.default;
      }
    }
  }
  return out;
}

function stripPrivate(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

// ─── Helper: hydrate filled state from a `projects/v2` import ────────────────

export function hydrateFromProject(project, schema) {
  const t = project.toml || {};
  const sections = {};
  for (const s of schema.sections) {
    sections[s.id] = {};
    for (const f of s.fields) {
      sections[s.id][f.id] = t.report_data?.[f.id] ?? defaultForField(f);
    }
  }
  const findings = (t.findings || []).map((f) => ({
    id: f.id || crypto.randomUUID(),
    status: f.status || 'in-progress',
    data: { ...(f.data || {}) },
  }));
  return {
    sections,
    findings,
    meta: { name: t.name, language: t.language, tags: t.tags || [] },
  };
}
