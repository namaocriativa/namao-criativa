export const SITE_OBJECTIVES = [
  'leads',
  'bookings',
  'present',
  'offers',
  'campaign',
  'other',
] as const;

export type SiteObjective = (typeof SITE_OBJECTIVES)[number];

export const SITE_OBJECTIVE_LABELS: Record<SiteObjective, string> = {
  leads: 'Captar novos clientes',
  bookings: 'Gerar agendamentos',
  present: 'Apresentar o negócio',
  offers: 'Divulgar produtos ou serviços',
  campaign: 'Promover uma campanha específica',
  other: 'Outro objetivo',
};

export const SITE_CONFIDENCE = [
  'confirmed',
  'identified',
  'suggested',
] as const;
export type SiteConfidence = (typeof SITE_CONFIDENCE)[number];

export const SITE_IMAGE_SECTIONS = [
  'hero',
  'about',
  'services',
  'contact',
] as const;
export type SiteImageSection = (typeof SITE_IMAGE_SECTIONS)[number];

export const SITE_SECTION_KINDS = [
  'hero',
  'about',
  'services',
  'benefits',
  'faq',
  'contact',
  'custom',
] as const;
export type SiteSectionKind = (typeof SITE_SECTION_KINDS)[number];

export type SiteBriefFact = {
  key: string;
  label: string;
  value: string;
  origin: string;
  confidence: SiteConfidence;
};

export type SiteBriefGap = {
  key: string;
  label: string;
  note: string;
};

export type SiteBriefImage = {
  filename: string;
  src: string;
  kind: 'logo' | 'photo';
  width: number | null;
  height: number | null;
  recommended: boolean;
  section: SiteImageSection;
};

export type SiteSkillBrief = {
  handle: string | null;
  igReady: boolean;
  igJobId: string | null;
  analyzedAt: string | null;
  notice: string | null;
  facts: SiteBriefFact[];
  gaps: SiteBriefGap[];
  images: SiteBriefImage[];
  voice: string[];
  pillars: string[];
};

export type SiteSection = {
  id: string;
  kind: SiteSectionKind;
  title: string;
  purpose: string;
  facts: string[];
  cta: string;
};

export type SiteStructureGap = {
  key: string;
  label: string;
  note: string;
  confidence: 'identified' | 'suggested';
};

export type SiteProposal = {
  objective: SiteObjective;
  objectiveNote: string;
  sections: SiteSection[];
  gaps: SiteStructureGap[];
};

export type SiteApprovedImage = {
  filename: string;
  section: SiteImageSection;
  kind: 'logo' | 'photo';
};

export type SiteApprovedBrief = {
  objective: SiteObjective;
  objectiveNote: string;
  sections: SiteSection[];
  gaps: SiteStructureGap[];
  images: SiteApprovedImage[];
  notes: string;
};

export function parseSiteObjective(value: unknown): SiteObjective {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!(SITE_OBJECTIVES as readonly string[]).includes(id)) {
    throw new Error('objetivo inválido');
  }
  return id as SiteObjective;
}
