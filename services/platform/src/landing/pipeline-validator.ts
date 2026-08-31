import { isAllowedHref } from './pipeline-assembler';
import type {
  GeneratedFile,
  GeneratedSection,
  LeadBrief,
  SitePlan,
} from './pipeline.types';

const CONTACT_KEYS = [
  'phone',
  'whatsapp',
  'email',
  'website',
  'instagram',
  'facebook',
  'linkedin',
] as const;

export function validateAssembledFiles(
  files: GeneratedFile[],
  brief: LeadBrief,
): string[] {
  const issues: string[] = [];
  const byPath = new Map(files.map((f) => [f.path, f.content]));

  if (!byPath.has('index.html')) issues.push('Falta index.html');
  if (!byPath.has('src/main.tsx') && !byPath.has('src/main.js')) {
    issues.push('Falta src/main.tsx');
  }
  if (!byPath.has('page-spec.json') && !byPath.has('src/style.css')) {
    issues.push('Falta page-spec.json');
  }
  if (!byPath.has('README.md')) issues.push('Falta README.md');

  const html = byPath.get('index.html') || '';
  if (html && !html.includes('/src/main.tsx') && !html.includes('/src/main.js')) {
    issues.push('index.html precisa carregar o bundle principal');
  }

  const combined = files.map((f) => f.content).join('\n');

  const imageRefs = [...combined.matchAll(/\/images\/[^\s"'`)>]+/g)].map(
    (m) => m[0],
  );
  const allowedImages = new Set(brief.images.map((img) => img.publicPath));
  for (const ref of imageRefs) {
    if (!allowedImages.has(ref)) {
      issues.push(`Imagem não permitida: ${ref}`);
    }
  }

  const invented = findInventedContacts(combined, brief);
  issues.push(...invented);

  return issues;
}

export function validateSectionContent(
  section: GeneratedSection,
  brief: LeadBrief,
  plan: SitePlan,
): string[] {
  const issues: string[] = [];
  const type =
    section.type ||
    plan.sectionConfigs.find((item) => item.id === section.id)?.type ||
    section.id;
  const content = section.content || {};
  const blob = JSON.stringify(content);
  const allowedImages = new Set(brief.images.map((img) => img.publicPath));

  for (const ref of content.imageRefs || []) {
    if (!allowedImages.has(ref)) {
      issues.push(`Imagem não permitida: ${ref}`);
    }
  }

  if (content.ctaHref && !isAllowedHref(content.ctaHref, brief)) {
    issues.push(`href inventado ou fora do brief: ${content.ctaHref}`);
  }
  for (const item of content.nav || []) {
    if (item.href && !isAllowedHref(item.href, brief)) {
      issues.push(`href inventado ou fora do brief: ${item.href}`);
    }
  }

  if (type === 'services' && brief.services?.length) {
    const expected = brief.services.map((item) => item.trim()).filter(Boolean);
    const got = (content.items || []).map((item) => item.trim()).filter(Boolean);
    if (JSON.stringify(expected) !== JSON.stringify(got)) {
      issues.push('services: items devem ser exatamente iguais ao brief.services');
    }
  }

  if (type === 'testimonials' && content.items?.length) {
    issues.push('testimonials: não invente citações');
  }

  issues.push(...findInventedContacts(blob, brief));
  return issues;
}

export function mapIssuesToSectionIds(
  issues: string[],
  sections: GeneratedSection[],
): string[] {
  const ids = new Set<string>();
  for (const issue of issues) {
    for (const section of sections) {
      const blob = JSON.stringify(section.content);
      const imageMatch = issue.match(/\/images\/[^\s"'`)]+/);
      if (imageMatch && blob.includes(imageMatch[0])) {
        ids.add(section.id);
        continue;
      }
      const contactMatch = issue.match(
        /(?:fora do brief|inventado):\s*(.+)$/i,
      );
      if (contactMatch && blob.toLowerCase().includes(contactMatch[1].trim().toLowerCase())) {
        ids.add(section.id);
      }
    }
  }
  return [...ids];
}

export function findInventedContacts(
  content: string,
  brief: LeadBrief,
): string[] {
  const issues: string[] = [];
  const allowedValues = new Set<string>();
  for (const key of CONTACT_KEYS) {
    const value = brief.contacts[key];
    if (value) allowedValues.add(normalize(value));
  }
  if (brief.contacts.whatsappUrl) {
    allowedValues.add(normalize(brief.contacts.whatsappUrl));
  }
  if (brief.contacts.mapsUrl) {
    allowedValues.add(normalize(brief.contacts.mapsUrl));
  }

  const patterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'e-mail', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { label: 'whatsapp', regex: /https?:\/\/wa\.me\/\d+/gi },
    {
      label: 'instagram',
      regex: /https?:\/\/(www\.)?instagram\.com\/[^\s"'`)]+/gi,
    },
    {
      label: 'facebook',
      regex: /https?:\/\/(www\.)?facebook\.com\/[^\s"'`)]+/gi,
    },
    {
      label: 'linkedin',
      regex: /https?:\/\/(www\.)?linkedin\.com\/[^\s"'`)]+/gi,
    },
  ];

  for (const { label, regex } of patterns) {
    const matches = content.match(regex) || [];
    for (const match of matches) {
      if (!allowedValues.has(normalize(match))) {
        issues.push(`${label} inventado ou fora do brief: ${match}`);
      }
    }
  }

  if (brief.omitted.includes('phone') && brief.omitted.includes('whatsapp')) {
    const tel = content.match(/tel:\+?\d[\d\s()-]{7,}/gi) || [];
    for (const match of tel) {
      issues.push(`telefone inventado: ${match}`);
    }
  }

  return issues;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '');
}
