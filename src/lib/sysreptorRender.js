// Render a SysReptor design template against filled state using Vue 3.
//
// This is a best-effort browser-side reimplementation of SysReptor's own
// renderer. SysReptor renders with headless Chromium + CSS Paged Media; we
// render with the user's browser print engine, so some advanced features
// (true repeating page headers, `running()` elements, footnote numbering)
// will fall back to a static approximation. Output looks ~90% like the
// design's intended layout for the common case.

// IMPORTANT: pull the full ESM build, NOT the runtime-only one. SysReptor's
// designs ship Vue templates as strings, so we need the runtime compiler.
import { createApp, reactive, ref as vueRefImport, h, nextTick, onMounted, computed } from 'vue/dist/vue.esm-bundler.js';
import { marked } from 'marked';
import { cvss3Score, cvssSeverity } from './sysreptor';

// SysReptor's "global" stylesheets — designs reference these via
// @import url("/assets/global/base.css"). Bundled as raw strings so we can
// inline them into the print window without needing a network.
// Files mirrored from github.com/Syslifters/sysreptor (AGPL-3.0).
import baseCss     from './sysreptorGlobalAssets/base.css?raw';
import baseTextCss from './sysreptorGlobalAssets/base-text.css?raw';
import baseRefCss  from './sysreptorGlobalAssets/base-ref.css?raw';

const GLOBAL_ASSETS = {
  'base.css':      baseCss,
  'base-text.css': baseTextCss,
  'base-ref.css':  baseRefCss,
};

// ─── CVSS object construction ─────────────────────────────────────────────────
// SysReptor's templates access finding.cvss.score / .level / .vector.

function cvssLevel(score) {
  if (score == null) return 'info';
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  if (score >= 0.1) return 'low';
  return 'info';
}

// CSS-safe id: must not start with a digit, hyphen-followed-by-digit, or
// contain characters that break a `#${id}` selector. Templates emit
// `<h2 :id="finding.id">` and `<a href="#finding.id">`, both must agree.
function cssSafeId(id) {
  if (!id) return id;
  const s = String(id);
  return /^[A-Za-z_]/.test(s) ? s : `f-${s}`;
}

function buildCvssObject(vector) {
  const score = cvss3Score(vector);
  return {
    vector: vector || 'n/a',
    score: score == null ? 0 : score,
    level: cvssLevel(score),
  };
}

// ─── Asset URL rewriting ──────────────────────────────────────────────────────
// Template references `/assets/name/foo.png`. The bundle stored those bytes
// at `<uuid>-assets/foo.png`. Map by basename and return blob URLs we can
// then drop into <img src=…> and CSS url(…).

function buildAssetMap(assets) {
  // assets: { [path]: Uint8Array }
  // We use data: URLs (not blob:) so the printed window can resolve them
  // independently of the parent window's URL registry. The size overhead is
  // ~33% per asset, fine for the handful of logos/backgrounds in a design.
  const map = new Map();
  for (const [path, bytes] of Object.entries(assets || {})) {
    const base = path.split('/').pop();
    if (!base) continue;
    const mime = guessMime(base);
    const url = `data:${mime};base64,${uint8ToBase64(bytes)}`;
    map.set(base.toLowerCase(), url);
  }
  return { map, created: [] };
}

function uint8ToBase64(bytes) {
  // btoa requires a binary string, not a Uint8Array.
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function guessMime(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    svg: 'image/svg+xml', webp: 'image/webp',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
    css: 'text/css',
  }[ext] || 'application/octet-stream';
}

function rewriteAssetUrls(input, assetMap) {
  if (!input) return input;
  // Match `/assets/name/<filename>` and any longer path under it.
  return input.replace(/\/assets\/(?:name|local)\/([^"'\s)>]+)/g, (full, file) => {
    const base = file.split('/').pop().toLowerCase();
    return assetMap.get(base) || full;
  });
}

// Designs reference `/assets/global/base.css` etc. — inline their contents
// before sending styles to the print window. base.css itself @imports
// base-text.css and base-ref.css, so this has to recurse.
function inlineGlobalAssets(styles, depth = 0) {
  if (!styles || depth > 8) return styles;
  return styles.replace(
    /@import\s+url\(\s*["']?\/assets\/global\/([^"')\s]+)["']?\s*\)\s*;?/g,
    (full, name) => GLOBAL_ASSETS[name]
      ? `/* inlined ${name} */\n${inlineGlobalAssets(GLOBAL_ASSETS[name], depth + 1)}\n`
      : full
  );
}

// ─── finding_stats ────────────────────────────────────────────────────────────

function computeFindingStats(findings) {
  const stats = {
    count_total: findings.length,
    count_critical: 0,
    count_high: 0,
    count_medium: 0,
    count_low: 0,
    count_info: 0,
    count_none: 0,
  };
  for (const f of findings) {
    const lvl = f.cvss.level;
    if (lvl === 'critical') stats.count_critical++;
    else if (lvl === 'high') stats.count_high++;
    else if (lvl === 'medium') stats.count_medium++;
    else if (lvl === 'low') stats.count_low++;
    else stats.count_info++;
  }
  return stats;
}

// ─── Field enrichment ─────────────────────────────────────────────────────────
// Some scalar fields in the data are objects in the template (e.g. retest_status).
// Look at the design's finding_fields and section fields: for `enum` types,
// expand `value → { value, label }`.

function enrichByFieldSchema(data, fields) {
  const out = { ...data };
  for (const f of fields || []) {
    const v = out[f.id];
    if (f.type === 'enum') {
      const choice = f.choices?.find((c) => c.value === v);
      out[f.id] = { value: v ?? '', label: choice?.label ?? v ?? '' };
    } else if (f.type === 'object' && v && typeof v === 'object' && f.properties) {
      out[f.id] = enrichByFieldSchema(v, f.properties);
    } else if (f.type === 'list' && Array.isArray(v) && f.items?.type === 'object') {
      out[f.id] = v.map((item) => enrichByFieldSchema(item, f.items.properties));
    }
  }
  return out;
}

// ─── Build the props Vue sees ─────────────────────────────────────────────────

function buildVueContext(design, schema, filled) {
  // report = flat dict of all section fields' values
  const report = {};
  for (const s of schema.sections) {
    const sectionData = enrichByFieldSchema(filled.sections[s.id] || {}, s.fields);
    for (const f of s.fields) {
      report[f.id] = sectionData[f.id] !== undefined
        ? sectionData[f.id]
        : (f.default !== undefined ? f.default : null);
    }
  }
  // findings: sorted CVSS desc, with enriched fields and `cvss` as an object
  const findingsRaw = filled.findings || [];
  const findings = findingsRaw.map((f) => {
    const data = enrichByFieldSchema(f.data || {}, schema.findingFields);
    const cvss = buildCvssObject(typeof data.cvss === 'string' ? data.cvss : data.cvss?.vector);
    const severity = data.severity && typeof data.severity === 'object'
      ? data.severity
      : { value: cvss.level, label: cvss.level.charAt(0).toUpperCase() + cvss.level.slice(1) };
    return {
      // Finding IDs from SysReptor preview_data are UUIDs that often start
      // with a digit. paged.js 0.4.3 builds selectors as `#${id}` and throws
      // on selectors that start with `#<digit>` (invalid CSS). Prefix to keep
      // them CSS-safe; WeasyPrint escapes properly so SysReptor itself never
      // hits this.
      id: cssSafeId(f.id),
      ...data,
      cvss,
      severity,
    };
  }).sort((a, b) => (b.cvss.score - a.cvss.score));

  const finding_stats = computeFindingStats(findings);

  return { report, findings, finding_stats };
}

// ─── Custom components ────────────────────────────────────────────────────────

// <markdown :text="…" /> or <markdown>…</markdown>
//
// When markdown source comes via the default slot, the design template
// usually indents the content for readability:
//
//   <markdown>
//     # Heading
//     Body text.
//   </markdown>
//
// Without dedenting, marked sees lines starting with 4+ spaces and treats
// them as a code block, producing the wrong output. Strip the common leading
// indent before parsing.
function dedent(text) {
  if (!text) return text;
  const lines = String(text).replace(/^\s*\n/, '').replace(/\n\s*$/, '').split('\n');
  let minIndent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^([ \t]*)/);
    if (m) minIndent = Math.min(minIndent, m[1].length);
  }
  if (minIndent === Infinity || minIndent === 0) return text;
  return lines.map((l) => l.slice(minIndent)).join('\n');
}

const MarkdownComp = {
  props: { text: { type: String, default: null } },
  setup(props, { slots }) {
    return () => {
      const raw = props.text != null
        ? String(props.text)
        : extractSlotText(slots.default?.());
      const md = props.text != null ? raw : dedent(raw);
      const html = renderMarkdown(md);
      return h('div', { class: 'markdown', innerHTML: html });
    };
  },
};

function extractSlotText(vnodes) {
  if (!vnodes) return '';
  const flat = Array.isArray(vnodes) ? vnodes : [vnodes];
  return flat.map((v) => {
    if (typeof v.children === 'string') return v.children;
    if (Array.isArray(v.children)) return extractSlotText(v.children);
    return '';
  }).join('');
}

function renderMarkdown(text) {
  if (!text) return '';
  try {
    // Strip pandoc-style heading attributes `# Heading {#id .class}` → marked
    // doesn't parse them and they'd appear as literal text. Pull out id and
    // re-attach it to the rendered heading.
    const preprocessed = String(text).replace(/^(#{1,6}\s+.+?)\s*\{([^}]+)\}\s*$/gm, (full, head, attrs) => {
      const idMatch = attrs.match(/#([A-Za-z0-9_-]+)/);
      const classMatch = [...attrs.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
      const tag = head.match(/^(#{1,6})/)[1];
      const level = tag.length;
      const inner = head.slice(tag.length).trim();
      const id = idMatch ? ` id="${idMatch[1]}"` : '';
      const cls = classMatch.length ? ` class="${classMatch.join(' ')}"` : '';
      return `<h${level}${id}${cls}>${inner}</h${level}>`;
    });
    return marked.parse(preprocessed, { gfm: true, breaks: true });
  } catch {
    return String(text);
  }
}

// <pagebreak />
const PageBreak = { setup: () => () => h('div', { class: 'sr-pagebreak', style: 'page-break-after: always;' }) };

// <ref :to="id">text?</ref>
// Mirrors SysReptor's Ref.vue: emits <a><span class="ref-title">...</span></a>
// and after mount resolves the target element to apply level-specific classes
// like .ref-heading-level3 / .ref-figure / .ref-appendix-level2 — base-ref.css
// uses these as hooks for `target-counter()` ::before content.

function resolveRefTarget(rootEl, toId) {
  let el = rootEl?.ownerDocument.getElementById(toId);
  if (!el) return null;
  // SysReptor's traversal: IMG → enclosing figure's figcaption, FIGURE → its
  // figcaption, FIGCAPTION → parent figure, TABLE → its caption, CAPTION → parent table.
  if (el.tagName === 'IMG')        el = el.closest('figure')?.querySelector('figcaption') || el;
  if (el.tagName === 'FIGURE')     el = el.querySelector('figcaption') || el;
  if (el.tagName === 'FIGCAPTION') {
    const parent = el.closest('figure');
    if (parent && !parent.id) parent.id = `fig-${Math.random().toString(36).slice(2, 9)}`;
    el = parent || el;
  }
  if (el.tagName === 'TABLE')      el = el.querySelector('caption') || el;
  if (el.tagName === 'CAPTION') {
    const parent = el.closest('table');
    if (parent && !parent.id) parent.id = `tbl-${Math.random().toString(36).slice(2, 9)}`;
    el = parent || el;
  }
  return el;
}

function computeRefClasses(el) {
  if (!el) return ['ref'];
  const classes = ['ref'];
  const tag = el.tagName;
  if (/^H[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const inAppendix = !!el.closest('.appendix');
    const numbered = el.classList.contains('numbered');
    classes.push(inAppendix ? 'ref-appendix' : 'ref-heading');
    if (numbered) {
      classes.push(inAppendix ? `ref-appendix-level${level}` : `ref-heading-level${level}`);
    }
  } else if (tag === 'FIGURE' || tag === 'FIGCAPTION') {
    classes.push('ref-figure');
  } else if (tag === 'TABLE' || tag === 'CAPTION') {
    classes.push('ref-table');
  }
  return classes;
}

function computeRefTitle(el) {
  if (!el) return null;
  const tocTitle = el.getAttribute?.('data-toc-title');
  if (tocTitle) return tocTitle;
  if (el.tagName === 'FIGURE')  return el.querySelector('figcaption')?.textContent || el.textContent;
  if (el.tagName === 'TABLE')   return el.querySelector('caption')?.textContent || el.textContent;
  return el.textContent || '';
}

const RefComp = {
  props: { to: { type: String, default: '' } },
  setup(props, { slots }) {
    const refEl = vueRefImport(null);
    const hasSlot = computed(() => !!slots.default);

    onMounted(async () => {
      // 4 ticks like SysReptor — gives TOC's 3-tick scan time to assign IDs first.
      for (let i = 0; i < 4; i++) await nextTick();
      refEl.value = resolveRefTarget(document, props.to);
    });

    return () => {
      const el = refEl.value;
      const cls = computeRefClasses(el);
      const titleContent = slots.default
        ? slots.default()
        : (el ? (computeRefTitle(el) || props.to) : props.to);
      return h('a', {
        href: '#' + (el?.id || props.to),
        class: cls,
      }, [h('span', { class: 'ref-title' }, titleContent)]);
    };
  },
};

// <comma-and-join>{{a}}{{b}}{{c}}</comma-and-join>
// Renders each child / named slot, filters non-empty, joins with ", " and "and".
const CommaAndJoin = {
  setup(_, { slots }) {
    return () => {
      const parts = [];
      // Collect all named slots (including default).
      for (const [name, fn] of Object.entries(slots)) {
        const rendered = fn();
        // Skip slots that rendered to truly empty content.
        const text = extractSlotText(rendered);
        if (text.trim() === '' && !hasNonTextNode(rendered)) continue;
        parts.push(rendered);
      }
      if (parts.length === 0) return null;
      if (parts.length === 1) return h('span', parts[0]);
      const out = [];
      parts.forEach((p, i) => {
        out.push(h('span', p));
        if (i < parts.length - 2) out.push(', ');
        else if (i === parts.length - 2) out.push(parts.length === 2 ? ' and ' : ', and ');
      });
      return h('span', out);
    };
  },
};

function hasNonTextNode(vnodes) {
  if (!vnodes) return false;
  const flat = Array.isArray(vnodes) ? vnodes : [vnodes];
  for (const v of flat) {
    if (v && v.type && typeof v.type !== 'symbol' && v.type !== 'Text') return true;
  }
  return false;
}

// <table-of-contents v-slot="items">…</table-of-contents>
// SysReptor exposes a dual-shape slot prop: an Array with an extra `.items`
// property pointing to itself. So templates work for `v-slot="items"` AND
// `v-slot="{ items }"` patterns alike.
function makeSlotData(items) {
  const arr = items.slice();
  arr.items = arr; // self-reference for `v-slot="{ items }"` destructuring
  return arr;
}

function makeTocComponent(tocItems, shouldRender) {
  return {
    setup(_, { slots }) {
      return () => {
        if (!shouldRender.value) return null;
        const data = makeSlotData(tocItems.value);
        return h('div', { class: 'sr-toc' },
          slots.default ? slots.default(data) : null);
      };
    },
  };
}

// <chart :config="…" />
// SysReptor templates pass a Chart.js config. We support `type: 'bar'` and `type: 'pie'/'doughnut'`
// for severity distribution — the overwhelming common case. Other configs render as a labeled box.
const ChartComp = {
  props: {
    config: { type: Object, default: () => ({}) },
    width: { type: [Number, String], default: 15 },   // cm
    height: { type: [Number, String], default: 10 },  // cm
  },
  setup(props) {
    return () => {
      const cfg = props.config || {};
      const w = Number(props.width) * 38; // ~38px per cm for the SVG
      const hh = Number(props.height) * 38;
      const type = cfg.type || 'bar';
      const dataset = cfg.data?.datasets?.[0] || {};
      const labels = cfg.data?.labels || [];
      const values = dataset.data || [];
      const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : [];

      if (type === 'bar') {
        return renderBarChart({ labels, values, colors, width: w, height: hh });
      }
      if (type === 'pie' || type === 'doughnut') {
        return renderPieChart({ labels, values, colors, width: w, height: hh, donut: type === 'doughnut' });
      }
      // Unsupported config — render a labeled box so the page still flows.
      return h('div', { class: 'sr-chart-fallback', style: `width:${w}px;height:${hh}px;border:1px dashed #94a3b8;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:11px;` }, `Chart (${type})`);
    };
  },
};

function renderBarChart({ labels, values, colors, width, height }) {
  const padX = 40, padY = 20;
  const max = Math.max(1, ...values.map((v) => Number(v) || 0));
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = values.length || 1;
  const barW = innerW / n * 0.6;
  const step = innerW / n;
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${width} ${height}`,
    style: `width:${width}px;height:${height}px;font-family:Inter,sans-serif;`,
  }, [
    // Y axis line
    h('line', { x1: padX, y1: padY, x2: padX, y2: height - padY, stroke: '#cbd5e1', 'stroke-width': 1 }),
    // X axis line
    h('line', { x1: padX, y1: height - padY, x2: width - padX, y2: height - padY, stroke: '#cbd5e1', 'stroke-width': 1 }),
    // Bars + labels
    ...values.flatMap((v, i) => {
      const val = Number(v) || 0;
      const x = padX + i * step + (step - barW) / 2;
      const h2 = (val / max) * innerH;
      const y = height - padY - h2;
      const color = resolveColor(colors[i]) || '#5b86c8';
      return [
        h('rect', { x, y, width: barW, height: h2, fill: color, rx: 2 }),
        val > 0 ? h('text', {
          x: x + barW / 2, y: y - 4,
          'text-anchor': 'middle', 'font-size': 10, fill: '#1f2937',
        }, String(val)) : null,
        h('text', {
          x: x + barW / 2, y: height - padY + 12,
          'text-anchor': 'middle', 'font-size': 10, fill: '#475569',
        }, String(labels[i] || '')),
      ].filter(Boolean);
    }),
  ]);
}

function renderPieChart({ labels, values, colors, width, height, donut }) {
  const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
  if (total === 0) {
    return h('div', { style: `width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;color:#94a3b8;` }, 'No data');
  }
  const cx = width / 2, cy = height / 2;
  const r = Math.min(width, height) / 2 - 8;
  const inner = donut ? r * 0.55 : 0;
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const portion = (Number(v) || 0) / total;
    const a0 = angle;
    const a1 = angle + portion * Math.PI * 2;
    angle = a1;
    if (portion === 0) return null;
    const large = portion > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    if (donut) {
      const ix0 = cx + inner * Math.cos(a0), iy0 = cy + inner * Math.sin(a0);
      const ix1 = cx + inner * Math.cos(a1), iy1 = cy + inner * Math.sin(a1);
      return h('path', {
        d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 0 ${ix0} ${iy0} Z`,
        fill: resolveColor(colors[i]) || '#5b86c8',
      });
    }
    return h('path', {
      d: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`,
      fill: resolveColor(colors[i]) || '#5b86c8',
    });
  }).filter(Boolean);
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${width} ${height}`,
    style: `width:${width}px;height:${height}px;`,
  }, slices);
}

function resolveColor(c) {
  if (!c) return null;
  if (typeof c !== 'string') return null;
  // SysReptor templates use `cssvar('--color-risk-critical')` which returns
  // the resolved CSS var at render time. We approximate with our own palette
  // so charts work even if the design's CSS isn't applied to the canvas.
  const m = c.match(/var\(\s*(--[\w-]+)\s*\)/);
  if (m) return CSSVAR_DEFAULTS[m[1]] || '#5b86c8';
  return c;
}

const CSSVAR_DEFAULTS = {
  '--color-risk-critical': '#d36868',
  '--color-risk-high':     '#d68c5a',
  '--color-risk-medium':   '#d4a14a',
  '--color-risk-low':      '#67b365',
  '--color-risk-info':     '#5b86c8',
};

// Provide `cssvar` to the template too.
function cssvar(name) {
  if (typeof getComputedStyle !== 'undefined' && typeof document !== 'undefined') {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    if (v) return v.trim();
  }
  return CSSVAR_DEFAULTS[name] || '';
}

// SysReptor's templates (HTB CAPE/CDSA/CWEE/etc.) call `formatDate(date, style)`.
// Mirror SysReptor's accepted style values: 'long', 'short', 'medium', 'numeric'.
function formatDate(date, style = 'long') {
  if (!date) return '';
  try {
    const d = (date instanceof Date) ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return String(date);
    const opts = {
      long:    { year: 'numeric', month: 'long',  day: 'numeric' },
      medium:  { year: 'numeric', month: 'short', day: 'numeric' },
      short:   { year: 'numeric', month: '2-digit', day: '2-digit' },
      numeric: { year: 'numeric', month: '2-digit', day: '2-digit' },
    }[style] || { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-US', opts);
  } catch {
    return String(date);
  }
}

// ─── lodash stub ──────────────────────────────────────────────────────────────
// SysReptor templates often call `lodash.capitalize`, etc. Ship a tiny stub
// covering the calls seen in demo templates.

const lodashStub = {
  capitalize: (s) => (typeof s === 'string' && s) ? s[0].toUpperCase() + s.slice(1) : s,
  upperFirst: (s) => (typeof s === 'string' && s) ? s[0].toUpperCase() + s.slice(1) : s,
  lowerCase: (s) => (typeof s === 'string') ? s.toLowerCase() : s,
  upperCase: (s) => (typeof s === 'string') ? s.toUpperCase() : s,
  isEmpty: (v) => v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && v === ''),
  get: (obj, path, def) => {
    try {
      return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj) ?? def;
    } catch { return def; }
  },
};

// ─── Public: render to print window ───────────────────────────────────────────

export async function renderToPrint(design, schema, filled, assets = {}) {
  const { report, findings, finding_stats } = buildVueContext(design, schema, filled);

  const assetInfo = buildAssetMap(assets);
  const templateRaw = design.toml?.report_template || '';
  const stylesRaw   = design.toml?.report_styles || '';
  const template    = rewriteAssetUrls(templateRaw, assetInfo.map);
  // Inline SysReptor's base.css / base-text.css / base-ref.css first, then
  // rewrite per-design asset URLs. Order matters: the inlined CSS may itself
  // contain font / image references, but the global assets we bundle don't.
  const styles      = rewriteAssetUrls(inlineGlobalAssets(stylesRaw), assetInfo.map);

  // Stage area in the parent document, offscreen, so charts and fonts compute.
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;'; // ~A4 width @ 96dpi
  // Apply the design's styles within the stage so any computed sizes reflect them.
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  stage.appendChild(styleEl);
  const root = document.createElement('div');
  root.className = 'report-document';
  stage.appendChild(root);
  document.body.appendChild(stage);

  const tocItems = vueRefImport([]);
  const tocReady = vueRefImport(false);

  const app = createApp({
    template: `<div>${template}</div>`,
    data: () => ({ report, findings, finding_stats }),
    methods: { capitalize: lodashStub.capitalize, cssvar, formatDate },
    computed: { lodash: () => lodashStub },
  });

  // SysReptor compiler options for parity:
  //  - whitespace 'preserve' so prose layout in the design is honoured
  //  - <footnote> is a custom element (no Vue component lookup)
  app.config.compilerOptions.whitespace = 'preserve';
  app.config.compilerOptions.isCustomElement = (tag) => tag === 'footnote';

  // Surface template errors loudly — silent failures here are the worst outcome.
  app.config.warnHandler = (msg, _, trace) => {
    console.warn('[sysreptor template warning]', msg, trace);
  };
  app.config.errorHandler = (err, _, info) => {
    console.error('[sysreptor template error]', err, info);
  };

  app.component('markdown', MarkdownComp);
  app.component('pagebreak', PageBreak);
  app.component('ref', RefComp);
  app.component('comma-and-join', CommaAndJoin);
  app.component('table-of-contents', makeTocComponent(tocItems, tocReady));
  app.component('chart', ChartComp);

  // Provide a global `lodash` for templates that use it as a bare identifier.
  app.config.globalProperties.lodash = lodashStub;
  app.config.globalProperties.capitalize = lodashStub.capitalize;
  app.config.globalProperties.cssvar = cssvar;
  app.config.globalProperties.formatDate = formatDate;

  app.mount(root);

  // SysReptor's main.ts: do 10 nextTicks, then drain pending render tasks (the
  // 3-tick TOC scan and 4-tick Ref resolution complete inside this window).
  // We approximate that with two rounds of 10 ticks separated by the TOC scan.
  for (let i = 0; i < 10; i++) await nextTick();

  // Populate ToC by scanning all rendered .in-toc / [data-toc-title] elements.
  // SysReptor's getAllElements queries from the app root's element — same here.
  tocItems.value = scanToc(root);
  tocReady.value = true;

  // Let the TOC re-render, then let Ref components resolve their targets.
  for (let i = 0; i < 10; i++) await nextTick();
  // One rAF tick so any layout-affecting class additions settle in the DOM.
  await new Promise((r) => requestAnimationFrame(r));

  // Snapshot the rendered HTML.
  const html = root.innerHTML;

  // Cleanup the stage
  app.unmount();
  document.body.removeChild(stage);

  // Render the final PDF via WeasyPrint (SysReptor's actual pipeline), not
  // paged.js. The dev-server middleware at /__weasyprint pipes our HTML
  // through `weasyprint - -` and returns the resulting PDF bytes.
  await renderWithWeasyPrint({ html, styles, title: report.title || 'Report' });
}

async function renderWithWeasyPrint({ html, styles, title }) {
  const fullDoc = buildWeasyDocument({ html, styles, title });

  let res;
  try {
    res = await fetch('/__weasyprint', {
      method: 'POST',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: fullDoc,
    });
  } catch (e) {
    alert(
      'Could not reach the WeasyPrint renderer.\n\n' +
      'This export uses the Vite dev server middleware at /__weasyprint. ' +
      'Make sure you are running `npm run dev` and weasyprint is installed ' +
      '(it is on Kali via `apt install weasyprint`).\n\n' +
      `Error: ${e?.message || e}`
    );
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    const stderr = decodeURIComponent(res.headers.get('X-WeasyPrint-Stderr') || '');
    const w = window.open('', '_blank');
    w?.document.write(
      `<pre style="font-family:monospace;padding:20px;color:#fca5a5;background:#1a0a0a;">` +
      `WeasyPrint render failed (HTTP ${res.status}).\n\n${text || stderr}` +
      `</pre>`
    );
    return;
  }

  const pdfBlob = await res.blob();
  const url = URL.createObjectURL(pdfBlob);
  const w = window.open(url, '_blank');
  if (!w) {
    // Pop-up blocked — offer a download link instead.
    const a = document.createElement('a');
    a.href = url;
    a.download = (title || 'report').replace(/[^a-z0-9_-]+/gi, '_') + '.pdf';
    a.click();
  }
  // Revoke the URL later so the popup has time to load it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function buildWeasyDocument({ html, styles, title }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeAttr(title)}</title>
<style>
${styles}
</style>
</head>
<body>
${html}
</body>
</html>`;
}

function scanToc(root) {
  const items = [];
  const nodes = root.querySelectorAll('.in-toc, [data-toc-title]');
  nodes.forEach((el) => {
    if (!el.id) el.id = `toc-${Math.random().toString(36).slice(2, 10)}`;
    const level = parseInt(el.tagName.match(/^H(\d)/i)?.[1] || '1', 10) || 1;
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    items.push({
      id: el.id,
      href: '#' + el.id,
      title: el.dataset.tocTitle || el.textContent.trim(),
      level,
      attrs,
    });
  });
  return items;
}

// Parse the design CSS to extract running-element mappings — paged.js 0.4.3
// has buggy handling of `position: running()` when the parent is positioned
// (which HTB designs do — `#header { position: absolute; width: 0 }`).
// We re-implement the placement in our own post-pagination pass.
function extractRunningMap(cssText) {
  if (!cssText) return { sources: {}, regions: {} };
  // Strip CSS comments first.
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // sources: { [name]: cssSelector }  — element(s) that produce the running content
  const sources = {};
  const sourceRe = /([^{}@]+)\{[^{}]*?position\s*:\s*running\(\s*([A-Za-z_][\w-]*)\s*\)/g;
  let m;
  while ((m = sourceRe.exec(clean)) !== null) {
    const selector = m[1].trim();
    const name = m[2].trim();
    if (selector && name) sources[name] = selector;
  }

  // regions: { 'page-name|*': { [marginBoxName]: runningName } }
  // Match @page [name] { ... @region { content: element(NAME) ... } ... }
  // We scan @page blocks at the top level, parsing their nested margin-box rules.
  const regions = {};
  const pageRe = /@page\s*([A-Za-z_][\w-]*)?\s*\{/g;
  while ((m = pageRe.exec(clean)) !== null) {
    const pageName = m[1] || '*';
    // Find the matching close brace for this @page block.
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    const body = clean.slice(m.index + m[0].length, i);
    // Inside the @page body, find @top-left etc. blocks with `content: element(X)`.
    const regionRe = /@([A-Za-z][\w-]*)\s*\{([^{}]*)\}/g;
    let r;
    while ((r = regionRe.exec(body)) !== null) {
      const boxName = r[1];
      const ruleBody = r[2];
      const elMatch = ruleBody.match(/content\s*:\s*element\(\s*([A-Za-z_][\w-]*)\s*\)/);
      if (elMatch) {
        if (!regions[pageName]) regions[pageName] = {};
        regions[pageName][boxName] = elMatch[1];
      }
      // Also pick up `content: none` overrides so the cover page hides headers.
      if (/content\s*:\s*none/i.test(ruleBody)) {
        if (!regions[pageName]) regions[pageName] = {};
        regions[pageName][boxName] = '__NONE__';
      }
    }
  }

  return { sources, regions };
}

function openPrintWindow({ html, styles, title, pagedScript, runningMap }) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked — please allow pop-ups for this site to render the report.');
    return;
  }
  // The design CSS is loaded into a data-attribute we hand to paged.js, NOT
  // into a normal <style> tag — because paged.js needs to parse the rules
  // itself to implement @page running()/element()/etc.
  const designStylesEscaped = escapeAttr(styles || '');

  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeAttr(title)}</title>
<style>
  /* Host-page chrome — paged.js will replace .pagedjs_pages with its own
     paginated DOM. */
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #525659; color: #1a1a1a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  body { padding: 20px 0; }

  /* Source content — hidden once paged.js takes over. */
  #report-source { display: none; }

  /* Paged.js's per-page boxes — drawn like a PDF reader. */
  .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .pagedjs_page { background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,0.4); margin: 0; }

  /* Risk colour fallbacks (designs override these). */
  .risk-critical { color: #d36868; }
  .risk-high     { color: #d68c5a; }
  .risk-medium   { color: #d4a14a; }
  .risk-low      { color: #67b365; }
  .risk-info     { color: #5b86c8; }
  .markdown-inline > p { display: inline; margin: 0; }

  /* Status bar — hidden when printing. */
  .print-bar {
    position: fixed; top: 12px; right: 12px; z-index: 9999;
    display: flex; gap: 10px; align-items: center;
    background: #1d1d1d; color: #e8e8e8;
    padding: 9px 13px; border-radius: 8px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.5);
    font-family: 'Inter', sans-serif; font-size: 13px;
  }
  .print-bar button {
    background: #5b86c8; color: white; border: 0; padding: 6px 12px;
    border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;
  }
  .print-bar button:hover:not(:disabled) { background: #7ea0d2; }
  .print-bar button:disabled { background: #3a3a3a; color: #7a7a7a; cursor: default; }
  .print-bar .hint { color: #9a9a9a; font-size: 11.5px; min-width: 130px; }

  @media print {
    html, body { background: white; }
    body { padding: 0; }
    .pagedjs_pages { gap: 0; }
    .pagedjs_page { box-shadow: none; margin: 0; }
    .print-bar { display: none !important; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <span class="hint" id="print-hint">Mounting…</span>
  <button id="print-btn" disabled onclick="window.print()">Save as PDF</button>
</div>

<!-- Source content: paged.js consumes this, paginates into .pagedjs_pages, then hides it. -->
<div id="report-source">${html}</div>

<!-- Design's own stylesheet — paged.js parses this via a <link>/<style> in the doc. -->
<style id="design-styles">${styles}</style>

<!-- paged.js polyfill (bundled inline so this works offline). -->
<script id="paged-config">
  window.PagedConfig = {
    auto: false,
    before: () => {
      var hint = document.getElementById('print-hint');
      if (hint) hint.textContent = 'Paginating…';
    },
    after: (flow) => {
      // Manual running-element injector runs after paged.js finishes.
      try { injectRunningElements(); } catch (e) { console.warn('[running inject]', e); }
      var hint = document.getElementById('print-hint');
      var btn = document.getElementById('print-btn');
      if (hint) hint.textContent = 'Ready · ' + flow.total + ' page' + (flow.total === 1 ? '' : 's');
      if (btn) btn.disabled = false;
    },
  };

  window.RUNNING_MAP = ${JSON.stringify(runningMap || {})};
  window.SOURCE_HTML = ${JSON.stringify(html || '')};

  // Map @page region names → the class paged.js uses for the corresponding
  // margin box on each generated page.
  var MARGIN_BOX_CLASSES = {
    'top-left-corner':    'pagedjs_margin-top-left-corner',
    'top-left':           'pagedjs_margin-top-left',
    'top-center':         'pagedjs_margin-top-center',
    'top-right':          'pagedjs_margin-top-right',
    'top-right-corner':   'pagedjs_margin-top-right-corner',
    'bottom-left-corner': 'pagedjs_margin-bottom-left-corner',
    'bottom-left':        'pagedjs_margin-bottom-left',
    'bottom-center':      'pagedjs_margin-bottom-center',
    'bottom-right':       'pagedjs_margin-bottom-right',
    'bottom-right-corner':'pagedjs_margin-bottom-right-corner',
    'left-top':           'pagedjs_margin-left-top',
    'left-middle':        'pagedjs_margin-left-middle',
    'left-bottom':        'pagedjs_margin-left-bottom',
    'right-top':          'pagedjs_margin-right-top',
    'right-middle':       'pagedjs_margin-right-middle',
    'right-bottom':       'pagedjs_margin-right-bottom',
  };

  function injectRunningElements() {
    var map = window.RUNNING_MAP || { sources: {}, regions: {} };
    var sources = map.sources || {};
    var regions = map.regions || {};
    if (Object.keys(sources).length === 0) return;

    // Parse the source HTML in a detached document so we can pull the
    // running-element nodes by their selectors — without yanking them out of
    // the paginated DOM. paged.js may have set them display:none or moved them.
    var parser = new DOMParser();
    var srcDoc = parser.parseFromString('<!doctype html><html><body>' + (window.SOURCE_HTML || '') + '</body></html>', 'text/html');

    // For each running-element name, grab the first matching element from source.
    var sourceClones = {};
    for (var name in sources) {
      try {
        var el = srcDoc.querySelector(sources[name]);
        if (el) {
          var clone = el.cloneNode(true);
          // Defensive: clear any stray inline display:none paged.js may have stamped.
          if (clone.style && clone.style.display === 'none') clone.style.display = '';
          sourceClones[name] = clone;
        }
      } catch (e) { /* invalid selector */ }
    }

    var globalRegions = regions['*'] || {};
    var pages = document.querySelectorAll('.pagedjs_page');
    pages.forEach(function (page) {
      // Detect named-page assignment, e.g. .pagedjs_page_pageType-page-cover.
      var pageName = null;
      var nameMatch = (page.className || '').match(/pagedjs_page_pageType-([\\w-]+)/);
      if (nameMatch) pageName = nameMatch[1];

      // Effective region map = global merged with page-specific (page-specific wins).
      var effective = Object.assign({}, globalRegions, regions[pageName] || {});

      for (var boxName in effective) {
        var runningName = effective[boxName];
        var marginClass = MARGIN_BOX_CLASSES[boxName];
        if (!marginClass) continue;
        var box = page.querySelector('.' + marginClass);
        if (!box) continue;

        if (runningName === '__NONE__') {
          // Explicit content:none override — clear the box.
          box.innerHTML = '';
          continue;
        }

        var content = sourceClones[runningName];
        if (!content) continue;
        // paged.js wraps content in .pagedjs_margin-content; reuse if present.
        var target = box.querySelector('.pagedjs_margin-content') || box;
        target.innerHTML = '';
        target.appendChild(content.cloneNode(true));
        box.classList.add('hasContent');
        // page-counter selectors use this attribute too.
      }
    });
  }

  // Capture warnings/errors so the user sees them without DevTools.
  window.__capturedLogs = [];
  var origWarn = console.warn.bind(console);
  var origError = console.error.bind(console);
  console.warn = function () {
    window.__capturedLogs.push({ kind: 'warn', args: Array.from(arguments).map(String) });
    origWarn.apply(null, arguments);
  };
  console.error = function () {
    window.__capturedLogs.push({ kind: 'error', args: Array.from(arguments).map(String) });
    origError.apply(null, arguments);
  };
</script>
<script>${pagedScript}</script>
<script>
  function waitImages() {
    var imgs = Array.from(document.images);
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
            setTimeout(res, 3000);
          })
    ));
  }
  window.addEventListener('load', async () => {
    await waitImages();
    var hint = document.getElementById('print-hint');
    if (hint) hint.textContent = 'Preparing…';
    try {
      // Move #report-source contents into a fresh container so paged.js sees
      // them as the content root. Then trigger pagination.
      var source = document.getElementById('report-source');
      var content = source.innerHTML;
      source.remove();
      var previewer = new window.Paged.Previewer();
      // Pass undefined for stylesheets so paged.js auto-discovers the
      // <style id="design-styles"> already in the doc. Passing the element
      // directly is what tripped the parser previously.
      await previewer.preview(content, undefined, document.body);
    } catch (e) {
      console.error('[paged.js] pagination failed:', e);
      var hint = document.getElementById('print-hint');
      if (hint) hint.textContent = 'Layout error';

      // Surface the error visibly so the user doesn't need DevTools to debug.
      var escape = function (s) {
        return String(s).replace(/[<>&]/g, function (c) {
          return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
        });
      };
      var captured = (window.__capturedLogs || [])
        .map(function (l) { return '[' + l.kind + '] ' + l.args.join(' '); })
        .join('\\n');

      var errBox = document.createElement('div');
      errBox.style.cssText = 'max-width:880px;margin:24px auto;padding:18px 22px;background:#2a1212;border:1px solid #7c2a2a;border-radius:10px;color:#f5d4d4;font-family:Inter,sans-serif;font-size:13px;line-height:1.55;';
      errBox.innerHTML =
        '<div style="font-weight:600;color:#fca5a5;margin-bottom:6px;">paged.js could not paginate this design.</div>' +
        '<div style="margin-bottom:10px;">Error:</div>' +
        '<pre style="background:#1a0a0a;padding:10px 12px;border-radius:6px;font-family:JetBrains Mono,ui-monospace,monospace;font-size:11px;color:#fca5a5;white-space:pre-wrap;overflow-x:auto;margin:0;max-height:220px;">' +
          escape(e && (e.stack || e.message || e)) +
        '</pre>' +
        (captured
          ? '<div style="margin:14px 0 6px;font-weight:500;color:#f5d4d4;">Console output during pagination:</div>' +
            '<pre style="background:#1a0a0a;padding:10px 12px;border-radius:6px;font-family:JetBrains Mono,ui-monospace,monospace;font-size:11px;color:#fbbf24;white-space:pre-wrap;overflow-x:auto;margin:0;max-height:300px;">' +
              escape(captured) +
            '</pre>'
          : '') +
        '<div style="margin-top:14px;color:#c4c4c4;">Showing unpaginated content below — you can still print it, but layout won\\'t match the design.</div>';
      document.body.appendChild(errBox);

      // Show the unpaginated content below the error so the user gets *something*.
      var fb = document.createElement('div');
      fb.style.cssText = 'max-width:794px;margin:0 auto;background:#fff;padding:22mm 18mm;box-shadow:0 2px 14px rgba(0,0,0,0.4);';
      fb.innerHTML = (document.getElementById('report-source') && document.getElementById('report-source').innerHTML) || '';
      document.body.appendChild(fb);

      var btn = document.getElementById('print-btn');
      if (btn) btn.disabled = false;
    }
  });
</script>
</body>
</html>`;

  w.document.open();
  w.document.write(doc);
  w.document.close();
}

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
