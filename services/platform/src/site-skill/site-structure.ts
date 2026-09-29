import type { SiteBriefGap, SiteSkillBrief } from './site-skill.contract';
import {
  SITE_IMAGE_SECTIONS,
  SITE_OBJECTIVE_LABELS,
  SITE_SECTION_KINDS,
  parseSiteObjective,
  type SiteApprovedBrief,
  type SiteImageSection,
  type SiteObjective,
  type SiteProposal,
  type SiteSection,
  type SiteSectionKind,
  type SiteStructureGap,
} from './site-skill.contract';

const SECTION_SEED: Record<
  SiteObjective,
  Array<{ kind: SiteSectionKind; title: string; purpose: string }>
> = {
  leads: [
    {
      kind: 'hero',
      title: 'Hero',
      purpose: 'Proposta de valor e chamada para contato.',
    },
    {
      kind: 'about',
      title: 'Sobre',
      purpose: 'Quem é o negócio, só com fatos do briefing.',
    },
    {
      kind: 'services',
      title: 'Serviços',
      purpose: 'Oferta identificada, sem inventar preço.',
    },
    {
      kind: 'benefits',
      title: 'Benefícios',
      purpose: 'Relevância para o público identificado.',
    },
    {
      kind: 'faq',
      title: 'Perguntas frequentes',
      purpose: 'Dúvidas reais, sem inventar condição comercial.',
    },
    {
      kind: 'contact',
      title: 'Contato',
      purpose: 'WhatsApp, telefone ou localização somente se existirem.',
    },
  ],
  bookings: [
    {
      kind: 'hero',
      title: 'Hero',
      purpose: 'Convite para agendar, com a oferta identificada.',
    },
    {
      kind: 'services',
      title: 'Serviços',
      purpose: 'Serviços que podem ser marcados.',
    },
    {
      kind: 'faq',
      title: 'Perguntas frequentes',
      purpose: 'Dúvidas sem inventar agenda ou preço.',
    },
    {
      kind: 'contact',
      title: 'Contato',
      purpose: 'Canal confirmado para marcação.',
    },
  ],
  present: [
    {
      kind: 'hero',
      title: 'Hero',
      purpose: 'Apresentação profissional da marca.',
    },
    {
      kind: 'about',
      title: 'Sobre',
      purpose: 'História e diferenciais identificados.',
    },
    {
      kind: 'services',
      title: 'Serviços',
      purpose: 'O que o negócio oferece.',
    },
    {
      kind: 'contact',
      title: 'Contato',
      purpose: 'Como falar com o negócio, se houver canal.',
    },
  ],
  offers: [
    {
      kind: 'hero',
      title: 'Hero',
      purpose: 'Oferta principal e consulta comercial.',
    },
    {
      kind: 'services',
      title: 'Ofertas',
      purpose: 'Produtos ou serviços identificados, sem inventar preço.',
    },
    {
      kind: 'benefits',
      title: 'Por que escolher',
      purpose: 'Diferenciais identificados.',
    },
    {
      kind: 'contact',
      title: 'Contato',
      purpose: 'Consulta comercial pelo canal confirmado.',
    },
  ],
  campaign: [
    {
      kind: 'hero',
      title: 'Hero',
      purpose: 'Campanha ou lançamento descrito pelo operador.',
    },
    {
      kind: 'services',
      title: 'O que está em destaque',
      purpose: 'Serviço ou oferta da campanha, sem extrapolar.',
    },
    {
      kind: 'benefits',
      title: 'Benefícios',
      purpose: 'Por que esta oferta importa para o público.',
    },
    {
      kind: 'contact',
      title: 'Contato',
      purpose: 'Próximo passo pelo canal confirmado.',
    },
  ],
  other: [
    {
      kind: 'hero',
      title: 'Hero',
      purpose: 'Resultado descrito no objetivo personalizado.',
    },
    {
      kind: 'about',
      title: 'Sobre',
      purpose: 'Contexto do negócio com fatos do briefing.',
    },
    { kind: 'services', title: 'Serviços', purpose: 'Oferta identificada.' },
    {
      kind: 'contact',
      title: 'Contato',
      purpose: 'Canal confirmado, se existir.',
    },
  ],
};

export function buildSiteStructureTask(input: {
  brief: SiteSkillBrief;
  objective: SiteObjective;
  objectiveNote: string;
}): string {
  const seed = SECTION_SEED[input.objective];
  return `Você propõe a estrutura de uma landing page. Não escreva o código. Não invente telefone, WhatsApp, endereço, preço, disponibilidade, depoimento ou condição comercial.

Objetivo: ${SITE_OBJECTIVE_LABELS[input.objective]}
Nota do objetivo: ${input.objectiveNote.trim() || '(nenhuma)'}

Adapte as seções ao objetivo e ao que o briefing realmente contém. Uma página de serviços profissionais não precisa do mesmo esqueleto de uma página de produtos. Remova seção que não tenha fato para sustentar. Se faltar um dado, registre em gaps em vez de preencher.

Ponto de partida, editável:
${JSON.stringify(seed)}

Briefing (origem e confiança já classificadas):
${JSON.stringify({
  handle: input.brief.handle,
  facts: input.brief.facts,
  gaps: input.brief.gaps,
  voice: input.brief.voice,
  pillars: input.brief.pillars,
})}

Devolva JSON:
{
  "sections": [
    { "id": "hero", "kind": "hero|about|services|benefits|faq|contact|custom", "title": "", "purpose": "", "facts": ["chave do fato usado"], "cta": "" }
  ],
  "gaps": [
    { "key": "", "label": "", "note": "o que falta e não deve ser inventado" }
  ]
}

Regras:
- 2 a 8 seções, em português do Brasil.
- facts: chaves que existem no briefing, ou lista vazia.
- cta: só se houver canal confirmado; senão string vazia.
- gaps: pendências novas. Não repita as que já estão no briefing.`;
}

export function parseSiteStructure(
  value: unknown,
  ctx: {
    objective: SiteObjective;
    objectiveNote: string;
    knownGaps: SiteBriefGap[];
    minSections?: number;
  },
): SiteProposal {
  const raw = asRecord(value);
  const sections = collectSections(raw?.sections);
  const minSections = ctx.minSections ?? 2;
  if (sections.length < minSections) throw new Error('estrutura curta demais');
  const modelGaps: SiteStructureGap[] = [];
  for (const item of Array.isArray(raw?.gaps) ? raw.gaps : []) {
    const row = asRecord(item);
    if (!row) continue;
    const label = clip(text(row.label), 80);
    const note = clip(text(row.note), 240);
    const key = clip(text(row.key), 40);
    if (!key || !label || !note) continue;
    modelGaps.push({ key, label, note, confidence: 'suggested' });
  }
  return {
    objective: ctx.objective,
    objectiveNote: clip(ctx.objectiveNote.trim(), 400),
    sections: sections.slice(0, 8),
    gaps: mergeGaps(ctx.knownGaps, modelGaps),
  };
}

export function parseApprovedBrief(value: unknown): SiteApprovedBrief {
  const raw = asRecord(value);
  if (!raw) throw new Error('briefing inválido');
  const objective = parseSiteObjective(raw.objective);
  const objectiveNote = clip(text(raw.objectiveNote), 400);
  if (objective === 'other' && !objectiveNote) {
    throw new Error('descreva o objetivo');
  }
  const proposal = parseSiteStructure(
    { sections: raw.sections, gaps: [] },
    { objective, objectiveNote, knownGaps: [], minSections: 1 },
  );
  const images = (Array.isArray(raw.images) ? raw.images : [])
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const filename = text(row.filename);
      if (!filename || filename.includes('/') || filename.includes('..'))
        return null;
      const sectionText = text(row.section);
      const section = (SITE_IMAGE_SECTIONS as readonly string[]).includes(
        sectionText,
      )
        ? (sectionText as SiteImageSection)
        : 'services';
      const kind =
        text(row.kind) === 'logo' ? ('logo' as const) : ('photo' as const);
      return { filename: filename.slice(0, 180), section, kind };
    })
    .filter((item): item is SiteApprovedBrief['images'][number] =>
      Boolean(item),
    )
    .slice(0, 24);
  const known = (Array.isArray(raw.gaps) ? raw.gaps : [])
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const key = clip(text(row.key), 40);
      const label = clip(text(row.label), 80);
      const note = clip(text(row.note), 240);
      if (!key || !label || !note) return null;
      const confidence =
        text(row.confidence) === 'suggested'
          ? ('suggested' as const)
          : ('identified' as const);
      return { key, label, note, confidence };
    })
    .filter((item): item is SiteStructureGap => Boolean(item));
  return {
    objective,
    objectiveNote,
    sections: proposal.sections,
    gaps: dedupeGaps(known),
    images,
    notes: clip(text(raw.notes), 4000),
  };
}

function collectSections(value: unknown): SiteSection[] {
  const sectionsRaw = Array.isArray(value) ? value : [];
  const sections: SiteSection[] = [];
  for (const item of sectionsRaw) {
    const row = asRecord(item);
    if (!row) continue;
    const title = clip(text(row.title), 80);
    const purpose = clip(text(row.purpose), 280);
    if (!title || !purpose) continue;
    const kindText = text(row.kind);
    const kind = (SITE_SECTION_KINDS as readonly string[]).includes(kindText)
      ? (kindText as SiteSectionKind)
      : 'custom';
    sections.push({
      id: clip(text(row.id), 40) || `sec-${sections.length + 1}`,
      kind,
      title,
      purpose,
      facts: stringList(row.facts, 6),
      cta: clip(text(row.cta), 120),
    });
  }
  return sections.slice(0, 8);
}

function dedupeGaps(gaps: SiteStructureGap[]): SiteStructureGap[] {
  const out: SiteStructureGap[] = [];
  const keys = new Set<string>();
  for (const gap of gaps) {
    if (keys.has(gap.key)) continue;
    keys.add(gap.key);
    out.push(gap);
    if (out.length >= 8) break;
  }
  return out;
}

export function parseStoredBrief(value: unknown): SiteApprovedBrief | null {
  if (value == null) return null;
  try {
    return parseApprovedBrief(value);
  } catch {
    return null;
  }
}

function mergeGaps(
  known: SiteBriefGap[],
  extra: SiteStructureGap[],
): SiteStructureGap[] {
  const out: SiteStructureGap[] = known.map((gap) => ({
    key: gap.key,
    label: gap.label,
    note: gap.note,
    confidence: 'identified',
  }));
  const keys = new Set(out.map((gap) => gap.key));
  for (const gap of extra) {
    if (keys.has(gap.key)) continue;
    keys.add(gap.key);
    out.push(gap);
    if (out.length >= 8) break;
  }
  return out;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
