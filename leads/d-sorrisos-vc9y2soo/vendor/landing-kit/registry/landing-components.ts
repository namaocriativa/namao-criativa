import { lazy, type ComponentType } from 'react';
import { COMPONENT_CATALOG, getComponentMeta } from '../catalog/variants';
import type { ComponentId, FamilyId } from '../ids';
import { resolveComponentId } from '../ids';
import { PROP_SCHEMAS, parseComponentProps } from '../spec/page-spec';
import { AboutEditorial, AboutSplit } from '../components/about/variants';
import { ContactForm } from '../components/contact/variants';
import { ContentBlock } from '../components/content/block';
import { CtaBanner, CtaDark, CtaSplit } from '../components/cta/variants';
import { FaqAccordion } from '../components/faq/variants';
import {
  FeaturesAlternating,
  FeaturesBento,
  FeaturesCards,
  FeaturesShowcase,
} from '../components/features/variants';
import { FooterMinimal, FooterPremium } from '../components/footer/variants';
import {
  GalleryCarousel,
  GalleryGrid,
  GalleryMasonry,
} from '../components/gallery/variants';
import {
  HeroCentered,
  HeroFullImage,
  HeroGradient,
  HeroMarketing,
  HeroSplitImage,
} from '../components/hero/variants';
import {
  NavbarCentered,
  NavbarMarketing,
  NavbarMinimal,
  NavbarPremium,
} from '../components/navbar/variants';
import {
  SocialProofLogos,
  SocialProofNumbers,
  SocialProofStats,
} from '../components/social-proof/variants';
import {
  TestimonialsCards,
  TestimonialsQuotes,
} from '../components/testimonials/variants';
import { aliasesFor, capabilitiesFor } from './component-capabilities';
import type { RegistryEntry, SectionComponent } from './component-types';
import { SAMPLE_PROPS } from './examples';

const LITE: Partial<Record<ComponentId, SectionComponent>> = {
  'navbar.minimal': NavbarMinimal as SectionComponent,
  'navbar.centered': NavbarCentered as SectionComponent,
  'navbar.premium': NavbarPremium as SectionComponent,
  'navbar.marketing': NavbarMarketing as SectionComponent,
  'hero.split-image': HeroSplitImage as SectionComponent,
  'hero.centered': HeroCentered as SectionComponent,
  'hero.full-image': HeroFullImage as SectionComponent,
  'hero.gradient': HeroGradient as SectionComponent,
  'hero.marketing': HeroMarketing as SectionComponent,
  'social-proof.logos': SocialProofLogos as SectionComponent,
  'social-proof.numbers': SocialProofNumbers as SectionComponent,
  'social-proof.stats': SocialProofStats as SectionComponent,
  'features.cards': FeaturesCards as SectionComponent,
  'features.bento': FeaturesBento as SectionComponent,
  'features.alternating': FeaturesAlternating as SectionComponent,
  'features.showcase': FeaturesShowcase as SectionComponent,
  'gallery.grid': GalleryGrid as SectionComponent,
  'gallery.masonry': GalleryMasonry as SectionComponent,
  'gallery.carousel': GalleryCarousel as SectionComponent,
  'about.split': AboutSplit as SectionComponent,
  'about.editorial': AboutEditorial as SectionComponent,
  'testimonials.cards': TestimonialsCards as SectionComponent,
  'testimonials.quotes': TestimonialsQuotes as SectionComponent,
  'faq.accordion': FaqAccordion as SectionComponent,
  'cta.banner': CtaBanner as SectionComponent,
  'cta.split': CtaSplit as SectionComponent,
  'cta.dark': CtaDark as SectionComponent,
  'contact.form': ContactForm as SectionComponent,
  'footer.minimal': FooterMinimal as SectionComponent,
  'footer.premium': FooterPremium as SectionComponent,
  'content.block': ContentBlock as SectionComponent,
};

const PREMIUM_LOADERS: Partial<
  Record<ComponentId, () => Promise<{ default: SectionComponent }>>
> = {
  'hero.cinematic': () =>
    import('../components/landing/hero/cinematic-hero').then((m) => ({
      default: m.CinematicHero as SectionComponent,
    })),
  'hero.morphing': () =>
    import('../components/landing/hero/morphing-hero').then((m) => ({
      default: m.MorphingHero as SectionComponent,
    })),
  'hero.split': () =>
    import('../components/landing/hero/split-hero').then((m) => ({
      default: m.SplitHero as SectionComponent,
    })),
  'hero.interactive': () =>
    import('../components/landing/hero/interactive-hero').then((m) => ({
      default: m.InteractiveHero as SectionComponent,
    })),
  'hero.product': () =>
    import('../components/landing/hero/product-hero').then((m) => ({
      default: m.ProductHero as SectionComponent,
    })),
  'hero.immersive': () =>
    import('../components/landing/hero/immersive-hero').then((m) => ({
      default: m.ImmersiveHero as SectionComponent,
    })),
  'layout.section': () =>
    import('../components/landing/layout/section').then((m) => ({
      default: m.LayoutSection as SectionComponent,
    })),
  'layout.container': () =>
    import('../components/landing/layout/section').then((m) => ({
      default: m.LayoutContainer as SectionComponent,
    })),
  'layout.fullscreen': () =>
    import('../components/landing/layout/section').then((m) => ({
      default: m.LayoutFullscreen as SectionComponent,
    })),
  'layout.split': () =>
    import('../components/landing/layout/section').then((m) => ({
      default: m.LayoutSplit as SectionComponent,
    })),
  'effects.glass-card': () =>
    import('../components/landing/effects/effects').then((m) => ({
      default: m.GlassCard as SectionComponent,
    })),
  'effects.glow': () =>
    import('../components/landing/effects/effects').then((m) => ({
      default: m.GlowEffect as SectionComponent,
    })),
  'effects.parallax': () =>
    import('../components/landing/effects/effects').then((m) => ({
      default: m.ParallaxEffect as SectionComponent,
    })),
  'effects.spotlight': () =>
    import('../components/landing/effects/effects').then((m) => ({
      default: m.SpotlightEffect as SectionComponent,
    })),
  'effects.noise': () =>
    import('../components/landing/effects/effects').then((m) => ({
      default: m.NoiseOverlay as SectionComponent,
    })),
  'effects.scanline': () =>
    import('../components/landing/effects/effects').then((m) => ({
      default: m.ScanlineEffect as SectionComponent,
    })),
};

const lazyCache = new Map<ComponentId, ComponentType<{ id: string; props: never }>>();

export function getLazyComponent(id: ComponentId) {
  const existing = lazyCache.get(id);
  if (existing) return existing;
  const load = PREMIUM_LOADERS[id];
  if (!load) return null;
  const Cmp = lazy(load);
  lazyCache.set(id, Cmp);
  return Cmp;
}

function buildEntry(id: ComponentId): RegistryEntry {
  const meta = getComponentMeta(id) || COMPONENT_CATALOG.find((item) => item.id === id);
  const caps = capabilitiesFor(id);
  return {
    id,
    aliases: aliasesFor(id),
    category: (meta?.family || id.split('.')[0]) as FamilyId,
    capabilities: caps.capabilities,
    runtime: caps.runtime,
    description: meta?.description || id,
    goodFor: meta?.goodFor || [],
    avoidFor: meta?.avoidFor || [],
    propsSchema: PROP_SCHEMAS[id],
    component: LITE[id],
    load: PREMIUM_LOADERS[id],
    performance: caps.performance,
    mobile: caps.mobile,
    example: SAMPLE_PROPS[id],
  };
}

const ENTRIES = new Map<ComponentId, RegistryEntry>(
  COMPONENT_CATALOG.map((item) => [item.id, buildEntry(item.id)]),
);

export function getComponent(id: string): RegistryEntry | undefined {
  const resolved = resolveComponentId(id);
  if (!resolved) return undefined;
  return ENTRIES.get(resolved);
}

export function listRegistry(): RegistryEntry[] {
  return [...ENTRIES.values()];
}

export function listRegistryByCategory(category: FamilyId) {
  return listRegistry().filter((item) => item.category === category);
}

export function listRegistryByCapability(capability: RegistryEntry['capabilities'][number]) {
  return listRegistry().filter((item) => item.capabilities.includes(capability));
}

export function parseProps(id: string, value: unknown) {
  const resolved = resolveComponentId(id);
  if (!resolved) throw new Error(`Unknown component: ${id}`);
  return parseComponentProps(resolved, value);
}

export { toLlmCatalog } from './catalog';
