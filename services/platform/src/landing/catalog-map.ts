import { CUSTOM_SECTION_TYPE } from './section-catalog';
import type { LandingSectionConfig } from './pipeline.types';

export type CatalogEntry = {
  type: string;
  requiredBriefFields: string[];
  optionalBriefFields: string[];
  deterministic: boolean;
  rule: string;
};

export const CATALOG_ENTRIES: CatalogEntry[] = [
  {
    type: 'header',
    requiredBriefFields: ['name'],
    optionalBriefFields: ['contacts', 'images'],
    deterministic: true,
    rule: 'nav âncoras para as outras seções + cta se primaryCta; title opcional',
  },
  {
    type: 'hero',
    requiredBriefFields: ['name'],
    optionalBriefFields: ['city', 'category', 'description', 'images'],
    deterministic: false,
    rule: 'title (nome), eyebrow (cidade/categoria), subtitle só se description existir, imageRefs só photos do brief',
  },
  {
    type: 'services',
    requiredBriefFields: ['services'],
    optionalBriefFields: [],
    deterministic: true,
    rule: 'items exatamente iguais ao brief.services',
  },
  {
    type: 'about',
    requiredBriefFields: [],
    optionalBriefFields: ['description', 'rating'],
    deterministic: false,
    rule: 'body = description; sem inventar números',
  },
  {
    type: 'gallery',
    requiredBriefFields: ['images'],
    optionalBriefFields: [],
    deterministic: true,
    rule: 'imageRefs só photos permitidas',
  },
  {
    type: 'testimonials',
    requiredBriefFields: ['rating'],
    optionalBriefFields: ['reviewCount'],
    deterministic: true,
    rule: 'NÃO invente citações. Só use rating/reviewCount do brief',
  },
  {
    type: 'faq',
    requiredBriefFields: ['description'],
    optionalBriefFields: ['services', 'city'],
    deterministic: false,
    rule: 'somente perguntas respondíveis com fatos do brief; se não houver, items vazio',
  },
  {
    type: 'cta',
    requiredBriefFields: [],
    optionalBriefFields: ['contacts'],
    deterministic: false,
    rule: 'title curto + ctaLabel/ctaHref do primaryCta',
  },
  {
    type: 'contact',
    requiredBriefFields: [],
    optionalBriefFields: ['contacts', 'address'],
    deterministic: false,
    rule: 'title/subtitle curtos; CTAs só com hrefs do brief',
  },
  {
    type: 'footer',
    requiredBriefFields: ['name'],
    optionalBriefFields: ['city'],
    deterministic: true,
    rule: 'title = nome',
  },
  {
    type: CUSTOM_SECTION_TYPE,
    requiredBriefFields: [],
    optionalBriefFields: ['description', 'contacts', 'services'],
    deterministic: false,
    rule: 'cumpra o propósito do usuário só com fatos do brief',
  },
];

const BY_TYPE = new Map(CATALOG_ENTRIES.map((entry) => [entry.type, entry]));

export function getCatalogEntry(type: string): CatalogEntry {
  return BY_TYPE.get(type) || BY_TYPE.get(CUSTOM_SECTION_TYPE)!;
}

export function isDeterministicType(type: string): boolean {
  return getCatalogEntry(type).deterministic;
}

export function formatCatalogLine(
  entry: CatalogEntry,
  sectionId?: string,
): string {
  const id = sectionId || entry.type;
  const mode = entry.deterministic ? 'deterministic' : 'copy';
  return `${id} type=${entry.type} required=[${entry.requiredBriefFields.join(',')}] optional=[${entry.optionalBriefFields.join(',')}] ${mode} — ${entry.rule}`;
}

export function catalogOverview(): string {
  return CATALOG_ENTRIES.filter((entry) => entry.type !== CUSTOM_SECTION_TYPE)
    .map((entry) => formatCatalogLine(entry))
    .join('\n');
}

export function catalogLinesForSections(
  sections: LandingSectionConfig[],
): string {
  return sections
    .map((section) => formatCatalogLine(getCatalogEntry(section.type), section.id))
    .join('\n');
}
