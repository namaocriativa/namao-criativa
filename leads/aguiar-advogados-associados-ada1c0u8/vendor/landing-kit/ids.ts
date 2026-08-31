export const COMPONENT_IDS = [
  'navbar.minimal',
  'navbar.centered',
  'navbar.premium',
  'hero.split-image',
  'hero.centered',
  'hero.full-image',
  'hero.gradient',
  'hero.cinematic',
  'hero.morphing',
  'hero.split',
  'hero.interactive',
  'hero.product',
  'hero.immersive',
  'social-proof.logos',
  'social-proof.numbers',
  'features.cards',
  'features.bento',
  'features.alternating',
  'gallery.grid',
  'gallery.masonry',
  'about.split',
  'about.editorial',
  'testimonials.cards',
  'testimonials.quotes',
  'faq.accordion',
  'cta.banner',
  'cta.split',
  'contact.form',
  'footer.minimal',
  'footer.premium',
  'content.block',
  'layout.section',
  'layout.container',
  'layout.fullscreen',
  'layout.split',
  'effects.glass-card',
  'effects.glow',
  'effects.parallax',
  'effects.spotlight',
  'effects.noise',
  'effects.scanline',
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

export const FAMILY_IDS = [
  'navbar',
  'hero',
  'social-proof',
  'features',
  'gallery',
  'about',
  'testimonials',
  'faq',
  'cta',
  'contact',
  'footer',
  'content',
  'layout',
  'effects',
] as const;

export type FamilyId = (typeof FAMILY_IDS)[number];

export const USER_SECTION_TYPES = [
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
  'custom',
] as const;

export type UserSectionType = (typeof USER_SECTION_TYPES)[number];

export const STYLE_IDS = [
  'premium',
  'minimal',
  'luxury',
  'modern',
  'corporate',
  'playful',
  'editorial',
  'industrial',
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

export const DENSITY_IDS = ['low', 'medium'] as const;
export type DensityId = (typeof DENSITY_IDS)[number];

export const RADIUS_IDS = ['small', 'large'] as const;
export type RadiusId = (typeof RADIUS_IDS)[number];

export const SPACING_IDS = ['compact', 'generous'] as const;
export type SpacingId = (typeof SPACING_IDS)[number];

export const IMAGE_STRATEGIES = [
  'large-photography',
  'balanced',
  'minimal',
] as const;
export type ImageStrategy = (typeof IMAGE_STRATEGIES)[number];

export const PALETTE_IDS = [
  'slate-teal',
  'ink-gold',
  'navy-coral',
  'forest',
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export const FONT_PAIR_IDS = [
  'fraunces-source',
  'literata-ibm',
  'playfair-lato',
] as const;
export type FontPairId = (typeof FONT_PAIR_IDS)[number];

export const USER_TYPE_TO_FAMILY: Record<UserSectionType, FamilyId> = {
  header: 'navbar',
  hero: 'hero',
  services: 'features',
  about: 'about',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  cta: 'cta',
  contact: 'contact',
  footer: 'footer',
  custom: 'content',
};

export const FAMILY_TO_USER_TYPE: Record<FamilyId, UserSectionType> = {
  navbar: 'header',
  hero: 'hero',
  features: 'services',
  about: 'about',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  cta: 'cta',
  contact: 'contact',
  footer: 'footer',
  content: 'custom',
  layout: 'custom',
  effects: 'custom',
  'social-proof': 'testimonials',
};

export function familyOf(componentId: ComponentId): FamilyId {
  return componentId.split('.')[0] as FamilyId;
}

export function isComponentId(value: string): value is ComponentId {
  return (COMPONENT_IDS as readonly string[]).includes(value);
}

export const COMPONENT_ALIASES: Record<string, ComponentId> = {
  cinematicHero: 'hero.cinematic',
  morphingHero: 'hero.morphing',
  splitHero: 'hero.split',
  interactiveHero: 'hero.interactive',
  productHero: 'hero.product',
  immersiveHero: 'hero.immersive',
  glassCard: 'effects.glass-card',
  glowEffect: 'effects.glow',
  parallaxLayer: 'effects.parallax',
  spotlightEffect: 'effects.spotlight',
  noiseOverlay: 'effects.noise',
  scanlineEffect: 'effects.scanline',
  fullscreenSection: 'layout.fullscreen',
  splitLayout: 'layout.split',
};

export function resolveComponentId(value: string): ComponentId | undefined {
  if (isComponentId(value)) return value;
  return COMPONENT_ALIASES[value];
}
