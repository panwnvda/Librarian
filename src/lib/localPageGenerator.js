const colorCycle = ['cyan', 'green', 'red', 'purple', 'orange', 'pink', 'blue', 'yellow'];

const notesTemplates = {
  cloud: ['Identity', 'Enumeration', 'Privilege Escalation', 'Persistence', 'Data Access'],
  web: ['Recon', 'Authentication', 'Authorization', 'Server-Side', 'Client-Side'],
  active_directory: ['Recon', 'Credential Access', 'Lateral Movement', 'Delegation', 'Persistence'],
  phishing: ['Infrastructure', 'Lures', 'Delivery', 'Credential Capture', 'Follow-up'],
  malware: ['Execution', 'Injection', 'Evasion', 'Loader Design', 'Persistence'],
  default: ['Overview', 'Discovery', 'Execution', 'Validation', 'References'],
};

const resourceTemplates = {
  cloud: ['Documentation', 'Tooling', 'Detection', 'Case Studies'],
  web: ['Cheat Sheets', 'References', 'Practice Labs', 'Payload Lists'],
  default: ['References', 'Tooling', 'Research', 'Examples'],
};

const textTemplates = {
  report: ['Summary', 'Scope', 'Findings', 'Next Steps'],
  plan: ['Objectives', 'Assumptions', 'Execution Plan', 'Risks'],
  default: ['Overview', 'Details', 'Notes', 'Next Steps'],
};

function toWords(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function detectTheme(prompt) {
  const text = prompt.toLowerCase();
  if (/(aws|azure|gcp|cloud|iam|kubernetes|k8s)/.test(text)) return 'cloud';
  if (/(web|api|oauth|jwt|xss|sqli|idor|graphql)/.test(text)) return 'web';
  if (/(adcs|kerberos|ldap|domain|active directory|gpo|dcsync)/.test(text)) return 'active_directory';
  if (/(phish|email|lure|evilginx|gophish)/.test(text)) return 'phishing';
  if (/(malware|loader|shellcode|implant|beacon|injection)/.test(text)) return 'malware';
  if (/(report|writeup|write-up|summary)/.test(text)) return 'report';
  if (/(plan|roadmap|checklist)/.test(text)) return 'plan';
  return 'default';
}

function inferPageType(prompt) {
  const text = prompt.toLowerCase();
  if (/(attack chain|attack path|pivot chain|engagement map|lateral path)/.test(text)) return 'attackchain';
  if (/(report|writeup|write-up|summary|notes|meeting|journal|plan)/.test(text)) return 'text';
  if (/(resource|bookmark|links|tools|references|cves|docs|reading list)/.test(text)) return 'resource';
  if (/(dashboard|overview|index|portal|workspace home)/.test(text)) return 'home';
  return 'notes';
}

function makeTitle(prompt, hasImage) {
  const words = toWords(prompt).filter((word) => word.length > 2);
  const selected = words.slice(0, 3);

  if (selected.length === 0) {
    return hasImage ? 'Visual Notes' : 'New Notes';
  }

  return selected.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function makeColumns(theme, pageName) {
  const headers = notesTemplates[theme] || notesTemplates.default;
  return headers.map((header, index) => ({
    header,
    color: colorCycle[index % colorCycle.length],
    nodes: [
      { title: `${header} Goals`, subtitle: `Key objectives for ${pageName.toLowerCase()}` },
      { title: `${header} Tactics`, subtitle: 'Primary techniques, tooling, or workflow notes' },
      { title: `${header} Validation`, subtitle: 'Checks, evidence, and follow-up actions' },
    ],
  }));
}

function makeCategories(theme) {
  const sections = resourceTemplates[theme] || resourceTemplates.default;
  return sections.map((name, index) => ({
    name,
    items: [
      { title: `${name} Reference`, url: 'https://example.com' },
      { title: `${name} Toolkit`, url: 'https://example.com' },
      { title: `${name} Notes`, url: 'https://example.com' },
    ],
    color: colorCycle[index % colorCycle.length],
  }));
}

function makeSections(theme, pageName) {
  const sectionNames = textTemplates[theme] || textTemplates.default;
  return sectionNames.map((title) => ({
    title,
    body: `${title} for ${pageName}. Replace this with your project-specific content.`,
  }));
}

export function generateLocalPageTemplate({ prompt = '', imageName = '' }) {
  const effectivePrompt = [prompt, imageName].filter(Boolean).join(' ').trim();
  const theme = detectTheme(effectivePrompt);
  const pageType = inferPageType(effectivePrompt);
  const pageName = makeTitle(effectivePrompt, Boolean(imageName));

  return {
    pageName,
    pageType,
    columns: pageType === 'notes' || pageType === 'home' ? makeColumns(theme, pageName) : [],
    categories: pageType === 'resource' ? makeCategories(theme) : [],
    sections: pageType === 'text' ? makeSections(theme, pageName) : [],
    attackchain: pageType === 'attackchain' ? { nodes: [], connections: [] } : null,
  };
}
