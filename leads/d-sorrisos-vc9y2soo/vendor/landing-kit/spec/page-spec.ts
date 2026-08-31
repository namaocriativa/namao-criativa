import { z } from 'zod';
import { COMPONENT_IDS, DENSITY_IDS, FONT_PAIR_IDS, IMAGE_STRATEGIES, PALETTE_IDS, RADIUS_IDS, SPACING_IDS, STYLE_IDS, resolveComponentId } from '../ids';

export const CtaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const NavItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const FaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const ContactLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const optionalString = z
  .string()
  .nullish()
  .transform((value) => value ?? '');

export const NavbarPropsSchema = z.object({
  brand: z.string().min(1),
  logo: z.string().optional(),
  nav: z.array(NavItemSchema).default([]),
  cta: CtaSchema.optional().nullable(),
});

export const HeroPropsSchema = z.object({
  eyebrow: optionalString,
  headline: z.string().min(1),
  description: optionalString,
  image: z.string().optional(),
  cta: CtaSchema.optional().nullable(),
});

export const MarketingHeroPropsSchema = HeroPropsSchema.extend({
  footnote: optionalString,
});

export const CinematicHeroPropsSchema = HeroPropsSchema.extend({
  video: z.string().optional(),
  overlayOpacity: z.number().min(0).max(1).optional().default(0.45),
  mouseParallax: z.boolean().optional().default(true),
});

export const MorphingHeroPropsSchema = z.object({
  eyebrow: optionalString,
  headline: optionalString,
  words: z.array(z.string()).min(1),
  mode: z
    .enum(['morph', 'fade', 'slide', 'blur', 'scale', 'stagger'])
    .optional()
    .default('fade'),
  description: optionalString,
  image: z.string().optional(),
  cta: CtaSchema.optional().nullable(),
});

export const SplitHeroPropsSchema = HeroPropsSchema.extend({
  side: z.enum(['image-right', 'image-left']).optional().default('image-right'),
});

export const InteractiveHeroPropsSchema = HeroPropsSchema.extend({
  magnetic: z.boolean().optional().default(true),
});

export const ProductHeroPropsSchema = HeroPropsSchema.extend({
  screenshot: z.string().optional(),
  device: z.enum(['browser', 'phone', 'desktop']).optional().default('browser'),
});

export const ImmersiveHeroPropsSchema = HeroPropsSchema.extend({
  mode: z.enum(['particles', 'video', 'image']).optional().default('particles'),
  video: z.string().optional(),
});

export const LayoutSectionPropsSchema = z.object({
  title: optionalString,
  body: optionalString,
  background: optionalString,
  padding: optionalString,
  minHeight: optionalString,
  align: z.enum(['start', 'center', 'end']).optional().default('start'),
  container: z.boolean().optional().default(true),
});

export const LayoutSplitPropsSchema = z.object({
  leftTitle: optionalString,
  leftBody: optionalString,
  rightTitle: optionalString,
  rightBody: optionalString,
  image: z.string().optional(),
  ratio: z.enum(['50-50', '40-60', '60-40']).optional().default('50-50'),
});

export const EffectCardPropsSchema = z.object({
  title: optionalString,
  body: optionalString,
  image: z.string().optional(),
});


export const SocialProofLogosPropsSchema = z.object({
  title: optionalString,
  logos: z
    .array(z.object({ src: z.string(), alt: z.string().optional() }))
    .default([]),
});

export const SocialProofNumbersPropsSchema = z.object({
  title: optionalString,
  rating: z.number().optional(),
  reviewCount: z.number().int().optional(),
  caption: optionalString,
});

export const SocialProofStatsPropsSchema = z.object({
  title: optionalString,
  items: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
      }),
    )
    .default([]),
});

export const FeaturesPropsSchema = z.object({
  title: z.string().default('Serviços'),
  subtitle: optionalString,
  items: z.array(z.string()).default([]),
});

export const GalleryPropsSchema = z.object({
  title: z.string().default('Galeria'),
  images: z.array(z.string()).default([]),
});

export const AboutPropsSchema = z.object({
  title: z.string().default('Sobre'),
  body: optionalString,
  image: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().int().optional(),
});

export const TestimonialsPropsSchema = z.object({
  title: z.string().default('Avaliações'),
  rating: z.number().optional(),
  reviewCount: z.number().int().optional(),
  quotes: z
    .array(
      z.object({
        quote: z.string(),
        author: z.string().optional(),
      }),
    )
    .default([]),
});

export const FaqPropsSchema = z.object({
  title: z.string().default('Perguntas frequentes'),
  subtitle: optionalString,
  items: z.array(FaqItemSchema).default([]),
});

export const CtaBandPropsSchema = z.object({
  title: z.string().min(1),
  subtitle: optionalString,
  footnote: optionalString,
  cta: CtaSchema.optional().nullable(),
  image: z.string().optional(),
});

export const ContactPropsSchema = z.object({
  title: z.string().default('Contato'),
  subtitle: optionalString,
  links: z.array(ContactLinkSchema).default([]),
  address: optionalString,
  cta: CtaSchema.optional().nullable(),
});

export const FooterPropsSchema = z.object({
  brand: z.string().min(1),
  location: optionalString,
  nav: z.array(NavItemSchema).default([]),
  links: z.array(ContactLinkSchema).default([]),
});

export const ContentBlockPropsSchema = z.object({
  title: optionalString,
  body: optionalString,
  items: z.array(z.string()).optional().default([]),
  cta: CtaSchema.optional().nullable(),
});

export const PROP_SCHEMAS = {
  'navbar.minimal': NavbarPropsSchema,
  'navbar.centered': NavbarPropsSchema,
  'navbar.premium': NavbarPropsSchema,
  'navbar.marketing': NavbarPropsSchema,
  'hero.split-image': HeroPropsSchema,
  'hero.centered': HeroPropsSchema,
  'hero.full-image': HeroPropsSchema,
  'hero.gradient': HeroPropsSchema,
  'hero.marketing': MarketingHeroPropsSchema,
  'hero.cinematic': CinematicHeroPropsSchema,
  'hero.morphing': MorphingHeroPropsSchema,
  'hero.split': SplitHeroPropsSchema,
  'hero.interactive': InteractiveHeroPropsSchema,
  'hero.product': ProductHeroPropsSchema,
  'hero.immersive': ImmersiveHeroPropsSchema,
  'social-proof.logos': SocialProofLogosPropsSchema,
  'social-proof.numbers': SocialProofNumbersPropsSchema,
  'social-proof.stats': SocialProofStatsPropsSchema,
  'features.cards': FeaturesPropsSchema,
  'features.bento': FeaturesPropsSchema,
  'features.alternating': FeaturesPropsSchema,
  'features.showcase': FeaturesPropsSchema,
  'gallery.grid': GalleryPropsSchema,
  'gallery.masonry': GalleryPropsSchema,
  'gallery.carousel': GalleryPropsSchema,
  'about.split': AboutPropsSchema,
  'about.editorial': AboutPropsSchema,
  'testimonials.cards': TestimonialsPropsSchema,
  'testimonials.quotes': TestimonialsPropsSchema,
  'faq.accordion': FaqPropsSchema,
  'cta.banner': CtaBandPropsSchema,
  'cta.split': CtaBandPropsSchema,
  'cta.dark': CtaBandPropsSchema,
  'contact.form': ContactPropsSchema,
  'footer.minimal': FooterPropsSchema,
  'footer.premium': FooterPropsSchema,
  'content.block': ContentBlockPropsSchema,
  'layout.section': LayoutSectionPropsSchema,
  'layout.container': LayoutSectionPropsSchema,
  'layout.fullscreen': LayoutSectionPropsSchema,
  'layout.split': LayoutSplitPropsSchema,
  'effects.glass-card': EffectCardPropsSchema,
  'effects.glow': EffectCardPropsSchema,
  'effects.parallax': EffectCardPropsSchema,
  'effects.spotlight': EffectCardPropsSchema,
  'effects.noise': EffectCardPropsSchema,
  'effects.scanline': EffectCardPropsSchema,
} as const;

export const ThemeSpecSchema = z.object({
  style: z.enum(STYLE_IDS),
  visualLanguage: z.string().default(''),
  colorStrategy: z.string().default(''),
  imageStrategy: z.enum(IMAGE_STRATEGIES).default('balanced'),
  density: z.enum(DENSITY_IDS).default('medium'),
  radius: z.enum(RADIUS_IDS).default('small'),
  spacing: z.enum(SPACING_IDS).default('generous'),
  paletteId: z.enum(PALETTE_IDS),
  fontPairId: z.enum(FONT_PAIR_IDS),
  animation: z.enum(['cinematic', 'none']).optional().default('cinematic'),
});

export const SectionSpecSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    component: z.enum(COMPONENT_IDS),
    purpose: z.string().default(''),
    props: z.record(z.unknown()).default({}),
  })
  .superRefine((section, ctx) => {
    const schema = PROP_SCHEMAS[section.component];
    const parsed = schema.safeParse(omitNulls(section.props ?? {}) ?? {});
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: ['props', ...issue.path],
        });
      }
    }
  });

export const OverlaySpecSchema = z.object({
  component: z.string().min(1),
  html: z.string().default(''),
  css: z.string().default(''),
  js: z.string().default(''),
  props: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const FeatureSpecSchema = z.object({
  id: z.string().min(1),
  props: z.record(z.unknown()).optional().default({}),
});

export const PageSpecSchema = z.object({
  version: z.literal(1).default(1),
  theme: ThemeSpecSchema,
  sections: z.array(SectionSpecSchema).min(1),
  overlays: z.array(OverlaySpecSchema).default([]),
  features: z.array(FeatureSpecSchema).default([]),
});

export const CreativeDirectionSchema = z.object({
  style: z.enum(STYLE_IDS),
  visualLanguage: z.string().min(1),
  colorStrategy: z.string().min(1),
  imageStrategy: z.enum(IMAGE_STRATEGIES).default('balanced'),
  density: z.enum(DENSITY_IDS).default('medium'),
  radius: z.enum(RADIUS_IDS).default('small'),
  spacing: z.enum(SPACING_IDS).default('generous'),
  primaryCta: CtaSchema.nullable().default(null),
});

export const ArchitectureSectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  component: z.enum(COMPONENT_IDS),
  purpose: z.string().default(''),
});

export const ArchitectureSchema = z.object({
  sections: z.array(ArchitectureSectionSchema).min(1),
});

export const CopywriterResultSchema = z.object({
  id: z.string().min(1),
  props: z.record(z.unknown()).default({}),
});

export const VisualReviewIssueSchema = z.object({
  sectionId: z.string().default(''),
  problem: z.string().min(1),
  suggestion: z
    .object({
      kind: z.enum(['swap-component', 'adjust-props']),
      component: z.enum(COMPONENT_IDS).optional(),
      props: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export const VisualReviewSchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(VisualReviewIssueSchema).default([]),
});

export type Cta = z.infer<typeof CtaSchema>;
export type NavItem = z.infer<typeof NavItemSchema>;
export type ThemeSpec = z.infer<typeof ThemeSpecSchema>;
export type SectionSpec = z.infer<typeof SectionSpecSchema>;
export type OverlaySpec = z.infer<typeof OverlaySpecSchema>;
export type FeatureSpec = z.infer<typeof FeatureSpecSchema>;
export type PageSpec = z.infer<typeof PageSpecSchema>;
export type CreativeDirection = z.infer<typeof CreativeDirectionSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type CopywriterResult = z.infer<typeof CopywriterResultSchema>;
export type VisualReview = z.infer<typeof VisualReviewSchema>;
export type NavbarProps = z.infer<typeof NavbarPropsSchema>;
export type HeroProps = z.infer<typeof HeroPropsSchema>;
export type MarketingHeroProps = z.infer<typeof MarketingHeroPropsSchema>;
export type FeaturesProps = z.infer<typeof FeaturesPropsSchema>;
export type GalleryProps = z.infer<typeof GalleryPropsSchema>;
export type AboutProps = z.infer<typeof AboutPropsSchema>;
export type TestimonialsProps = z.infer<typeof TestimonialsPropsSchema>;
export type FaqProps = z.infer<typeof FaqPropsSchema>;
export type CtaBandProps = z.infer<typeof CtaBandPropsSchema>;
export type ContactProps = z.infer<typeof ContactPropsSchema>;
export type FooterProps = z.infer<typeof FooterPropsSchema>;
export type ContentBlockProps = z.infer<typeof ContentBlockPropsSchema>;
export type SocialProofNumbersProps = z.infer<typeof SocialProofNumbersPropsSchema>;
export type SocialProofLogosProps = z.infer<typeof SocialProofLogosPropsSchema>;
export type SocialProofStatsProps = z.infer<typeof SocialProofStatsPropsSchema>;

export type CinematicHeroProps = z.infer<typeof CinematicHeroPropsSchema>;
export type MorphingHeroProps = z.infer<typeof MorphingHeroPropsSchema>;
export type SplitHeroProps = z.infer<typeof SplitHeroPropsSchema>;
export type InteractiveHeroProps = z.infer<typeof InteractiveHeroPropsSchema>;
export type ProductHeroProps = z.infer<typeof ProductHeroPropsSchema>;
export type ImmersiveHeroProps = z.infer<typeof ImmersiveHeroPropsSchema>;
export type LayoutSectionProps = z.infer<typeof LayoutSectionPropsSchema>;
export type LayoutSplitProps = z.infer<typeof LayoutSplitPropsSchema>;
export type EffectCardProps = z.infer<typeof EffectCardPropsSchema>;

export function omitNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(omitNulls);
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = omitNulls(nested);
      if (cleaned !== undefined) next[key] = cleaned;
    }
    return next;
  }
  return value;
}

function normalizeSpecInput(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.sections)) return value;
  return {
    ...raw,
    sections: raw.sections.map((section) => {
      if (!section || typeof section !== 'object') return section;
      const row = section as Record<string, unknown>;
      const resolved = resolveComponentId(String(row.component || ''));
      const props = omitNulls(row.props ?? {});
      return resolved
        ? { ...row, component: resolved, props }
        : { ...row, props };
    }),
  };
}

export function parsePageSpec(value: unknown): PageSpec {
  return PageSpecSchema.parse(normalizeSpecInput(value));
}

export function parseCreativeDirection(value: unknown): CreativeDirection {
  return CreativeDirectionSchema.parse(value);
}

export function parseArchitecture(value: unknown): Architecture {
  return ArchitectureSchema.parse(normalizeSpecInput(value));
}

export function parseCopywriterResult(value: unknown, expectedId: string): CopywriterResult {
  const parsed = CopywriterResultSchema.parse(value);
  if (parsed.id !== expectedId) {
    return { ...parsed, id: expectedId };
  }
  return parsed;
}

export function parseVisualReview(value: unknown): VisualReview {
  return VisualReviewSchema.parse(value);
}

export function parseComponentProps(component: keyof typeof PROP_SCHEMAS, props: unknown) {
  return PROP_SCHEMAS[component].parse(omitNulls(props ?? {}) ?? {});
}
