import { COMPONENT_ALIASES, familyOf, type ComponentId } from '../ids';
import type { CapabilityMeta, ComponentCapability, ComponentRuntime } from './component-types';

const PREMIUM: Partial<Record<ComponentId, CapabilityMeta>> = {
  'hero.cinematic': {
    capabilities: ['animation', 'scroll', 'mouse', 'video', 'image', 'parallax'],
    runtime: 'premium',
    performance: 'GSAP parallax + Motion; vídeo só quando visível',
    mobile: 'sem mouse parallax; vídeo/imagem estáticos se reduced motion',
  },
  'hero.morphing': {
    capabilities: ['animation', 'words'],
    runtime: 'premium',
    performance: 'ciclo de palavras com Motion',
    mobile: 'mostra a primeira palavra se reduced motion',
  },
  'hero.split': {
    capabilities: ['animation', 'image'],
    runtime: 'premium',
    performance: 'entrada independente por coluna',
    mobile: 'empilha; animações curtas',
  },
  'hero.interactive': {
    capabilities: ['animation', 'mouse', 'magnetic', 'image'],
    runtime: 'premium',
    performance: 'cursor + camadas; magnetic no CTA',
    mobile: 'desliga mouse e magnetic',
  },
  'hero.product': {
    capabilities: ['animation', 'screenshot', 'image'],
    runtime: 'premium',
    performance: 'float suave no mockup',
    mobile: 'mockup abaixo do copy',
  },
  'hero.immersive': {
    capabilities: ['animation', 'webgl', 'video', 'image', 'scroll'],
    runtime: 'premium',
    performance: 'Three lazy; fallback imagem/vídeo',
    mobile: 'cai para imagem/vídeo; título sempre no DOM',
  },
  'layout.section': {
    capabilities: ['layout'],
    runtime: 'premium',
  },
  'layout.container': {
    capabilities: ['layout'],
    runtime: 'premium',
  },
  'layout.fullscreen': {
    capabilities: ['layout'],
    runtime: 'premium',
  },
  'layout.split': {
    capabilities: ['layout', 'image'],
    runtime: 'premium',
  },
  'effects.glass-card': {
    capabilities: ['animation', 'mouse'],
    runtime: 'premium',
    mobile: 'sem highlight de cursor',
  },
  'effects.glow': {
    capabilities: ['animation'],
    runtime: 'premium',
  },
  'effects.parallax': {
    capabilities: ['scroll', 'parallax', 'image'],
    runtime: 'premium',
    mobile: 'sem parallax se reduced motion',
  },
  'effects.spotlight': {
    capabilities: ['mouse'],
    runtime: 'premium',
    mobile: 'spotlight estático',
  },
  'effects.noise': {
    capabilities: ['animation'],
    runtime: 'premium',
  },
  'effects.scanline': {
    capabilities: ['animation'],
    runtime: 'premium',
  },
};

const LITE_CAPS: Record<string, ComponentCapability[]> = {
  navbar: ['layout'],
  hero: ['image'],
  'social-proof': ['image'],
  features: ['layout'],
  gallery: ['image'],
  about: ['image'],
  testimonials: ['layout'],
  faq: ['layout'],
  cta: ['layout'],
  contact: ['layout'],
  footer: ['layout'],
  content: ['layout'],
};

export function capabilitiesFor(id: ComponentId): CapabilityMeta {
  const premium = PREMIUM[id];
  if (premium) return premium;
  return {
    capabilities: LITE_CAPS[familyOf(id)] || [],
    runtime: 'lite',
  };
}

export function runtimeFor(id: ComponentId): ComponentRuntime {
  return capabilitiesFor(id).runtime;
}

export function aliasesFor(id: ComponentId): string[] {
  return Object.entries(COMPONENT_ALIASES)
    .filter(([, canonical]) => canonical === id)
    .map(([alias]) => alias);
}

export function isPremiumComponent(id: ComponentId): boolean {
  return runtimeFor(id) === 'premium';
}
