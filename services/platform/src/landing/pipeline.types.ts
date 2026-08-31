import type { ThemePayload } from '@namao/landing-kit';

export const PRESET_SECTION_IDS = [
  'header',
  'hero',
  'services',
  'about',
  'gallery',
  'testimonials',
  'faq',
  'cta',
  'contact',
  'footer',
] as const;

export type PresetSectionId = (typeof PRESET_SECTION_IDS)[number];

/** id estável da seção na página (`hero`, ou slug de seção custom). */
export type SectionId = string;

/** @deprecated use PRESET_SECTION_IDS */
export const SECTION_IDS = PRESET_SECTION_IDS;

export type BriefImage = {
  filename: string;
  publicPath: string;
  kind: 'logo' | 'photo';
  source?: string | null;
};

export type BriefVideo = {
  filename: string;
  publicPath: string;
  pexelsId?: number;
  photographer?: string;
  photographerUrl?: string;
  pageUrl?: string;
  slot?: 'background' | 'portrait';
};

export type AllowedContacts = {
  phone?: string;
  whatsapp?: string;
  whatsappUrl?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  mapsUrl?: string;
};

export type LeadBrief = {
  leadId: string;
  name: string;
  slug: string;
  outputDir: string;
  category: string | null;
  description: string | null;
  services: string[] | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  omitted: string[];
  present: string[];
  images: BriefImage[];
  videos: BriefVideo[];
  contacts: AllowedContacts;
};

/** Fatos extras do wizard para o copywriter, quando o enrichment veio incompleto. */
export type CopywriterBriefOverride = {
  category?: string;
  description?: string;
  services?: string[];
  address?: string;
  notes?: string;
};

export type LandingSectionConfig = {
  id: SectionId;
  type: string;
  title: string;
  description: string;
  /** Variante do landing-kit travada pelo usuário; se ausente, o architect escolhe. */
  component?: string;
  /** Pedido do wizard: baixar vídeo genérico do nicho (Pexels) para o hero. */
  stockVideo?: boolean;
  /** Imagens e vídeos escolhidos no wizard para esta seção. */
  media?: SectionMedia;
};

export type SectionMedia = {
  images?: string[];
  logo?: string;
  video?: string;
  portraitVideo?: string;
};

export type SelectedUiComponent = {
  component: string;
  props?: Record<string, string | number | boolean>;
  html: string;
  css: string;
  js: string;
};

export type LandingFeature = {
  id: string;
  props?: Record<string, string | number | boolean>;
};

export type LandingGenerateConfig = {
  sections: LandingSectionConfig[];
  components: SelectedUiComponent[];
  features: LandingFeature[];
  copywriter?: CopywriterBriefOverride;
  theme?: ThemePayload;
};

export type SectionDesignGuide = {
  sectionId: SectionId;
  layout: string;
  visualEmphasis: string;
  hierarchy: string;
  imageUse: string;
  spacing: string;
  cta: string;
  notes: string;
};

export type SitePlan = {
  visualDirection: string;
  tone: string;
  primaryCta: { label: string; href: string } | null;
  sections: SectionId[];
  sectionConfigs: LandingSectionConfig[];
  sectionGuides: SectionDesignGuide[];
  notes: string;
};

export type DesignSystem = {
  paletteId: string;
  fontPairId: string;
  colors: Record<string, string>;
  fonts: { display: string; body: string };
  googleFontsHref?: string;
  spacing: Record<string, string>;
  containerMaxWidth: string;
  cssVariables: string;
  baseCss: string;
};

export type SectionContentPayload = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  items?: string[];
  imageRefs?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  nav?: Array<{ label: string; href: string }>;
};

export type GeneratedSection = {
  id: SectionId;
  type?: string;
  content: SectionContentPayload;
  /** @deprecated legado HTML livre — mantido vazio no template por slots */
  html?: string;
  css?: string;
};

export type ReviewIssue = {
  sectionId: string;
  field?: string;
  problem: string;
};

export type ReviewResult = {
  approved: boolean;
  issues: ReviewIssue[];
};

export type VisionAnalysis = {
  atmosphere: string;
  colorHints: string[];
  logoNotes: string;
  photoNotes: string;
  heroSuggestion: string;
  avoid: string[];
};

export type GeneratedFile = { path: string; content: string };

export const ALLOWED_OUTPUT_FILES = new Set([
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/theme.css',
  'page-spec.json',
  'package.json',
  'vite.config.js',
  'tsconfig.json',
  'tsconfig.node.json',
  'README.md',
]);
