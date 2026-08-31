import { familyOf, type ComponentId, type FamilyId, type ImageStrategy } from '../ids';
import type { PageSpec } from '../spec/page-spec';
import { getComponentMeta } from './variants';

export type GrammarBrief = {
  hasPhotos: boolean;
  hasServices: boolean;
  hasRating: boolean;
  hasDescription: boolean;
  hasContacts: boolean;
  hasLogo: boolean;
  hasVideo?: boolean;
  imageStrategy?: ImageStrategy;
  runtime?: 'lite' | 'premium';
  lockedTypes?: string[];
};

export const GRAMMAR_TEXT = `REQUIRED (quando o usuário não travou seções):
- navbar, hero, footer

OPTIONAL gated by brief:
- gallery só com photos
- features só com services
- social-proof.numbers / testimonials só com rating
- faq só com description
- contact/cta só com contacts

ORDER:
navbar → hero → proof? → about? → features → gallery? → social → faq? → cta → contact? → footer

RULES:
- exatamente um hero
- CTA (hero, cta band ou contact) pelo menos uma vez se houver contato
- contact perto do fim (depois de faq/cta, antes do footer)
- no máximo 3 seções consecutivas card-like
- testimonials depois da proposta de valor (about ou features)
- gallery antes de testimonials
- não dois heros
- não inventar quotes em testimonials`;

const FAMILY_ORDER: FamilyId[] = [
  'navbar',
  'hero',
  'social-proof',
  'about',
  'features',
  'gallery',
  'testimonials',
  'faq',
  'cta',
  'contact',
  'content',
  'footer',
];

export function grammarViolations(
  spec: Pick<PageSpec, 'sections'>,
  brief: GrammarBrief,
): string[] {
  const issues: string[] = [];
  const families = spec.sections.map((section) => familyOf(section.component));
  const locked = Boolean(brief.lockedTypes?.length);

  if (!locked) {
    if (!families.includes('navbar')) issues.push('faltando navbar');
    if (!families.includes('hero')) issues.push('faltando hero');
    if (!families.includes('footer')) issues.push('faltando footer');
  }

  const heroCount = families.filter((item) => item === 'hero').length;
  if (heroCount !== 1 && spec.sections.some((s) => familyOf(s.component) === 'hero')) {
    if (heroCount > 1) issues.push('mais de um hero');
  }
  if (!locked && heroCount !== 1) {
    if (heroCount === 0) issues.push('faltando hero');
  }

  if (!brief.hasPhotos) {
    for (const section of spec.sections) {
      if (familyOf(section.component) === 'gallery') {
        issues.push(`gallery sem fotos: ${section.component}`);
      }
    }
  }

  if (!brief.hasServices) {
    for (const section of spec.sections) {
      if (familyOf(section.component) === 'features') {
        issues.push(`features sem services no brief: ${section.component}`);
      }
    }
  }

  if (!brief.hasRating) {
    for (const section of spec.sections) {
      const family = familyOf(section.component);
      if (family === 'testimonials' || section.component === 'social-proof.numbers' || section.component === 'social-proof.stats') {
        issues.push(`prova social sem rating: ${section.component}`);
      }
    }
  }

  const first = (family: FamilyId) => families.indexOf(family);
  const galleryAt = first('gallery');
  const testimonialsAt = first('testimonials');
  if (galleryAt >= 0 && testimonialsAt >= 0 && galleryAt > testimonialsAt) {
    issues.push('gallery deve aparecer antes de testimonials');
  }

  const aboutAt = first('about');
  const featuresAt = first('features');
  const valueAt =
    aboutAt >= 0 && featuresAt >= 0
      ? Math.min(aboutAt, featuresAt)
      : Math.max(aboutAt, featuresAt);
  if (testimonialsAt >= 0 && valueAt >= 0 && testimonialsAt < valueAt) {
    issues.push('testimonials deve aparecer depois da proposta de valor');
  }

  const contactAt = first('contact');
  const footerAt = first('footer');
  if (contactAt >= 0 && footerAt >= 0 && contactAt > footerAt) {
    issues.push('contact deve aparecer antes do footer');
  }
  if (contactAt >= 0 && footerAt >= 0 && footerAt - contactAt > 2) {
    issues.push('contact deve ficar perto do fim');
  }

  let cardRun = 0;
  for (const section of spec.sections) {
    const meta = getComponentMeta(section.component);
    if (meta?.cardLike) {
      cardRun += 1;
      if (cardRun > 3) {
        issues.push('mais de 3 seções consecutivas de cards');
        break;
      }
    } else {
      cardRun = 0;
    }
  }

  if (!locked) {
    const orderIndex = (family: FamilyId) => {
      const idx = FAMILY_ORDER.indexOf(family);
      return idx < 0 ? 50 : idx;
    };
    for (let i = 1; i < families.length; i += 1) {
      if (orderIndex(families[i]) < orderIndex(families[i - 1]) - 1) {
        issues.push(
          `ordem fraca: ${families[i - 1]} antes de ${families[i]} quebra a gramática`,
        );
        break;
      }
    }
  }

  return [...new Set(issues)];
}

export function defaultComponentForType(
  type: string,
  brief: GrammarBrief,
): ComponentId {
  switch (type) {
    case 'header':
      return 'navbar.minimal';
    case 'hero':
      return brief.hasPhotos ? 'hero.split-image' : 'hero.gradient';
    case 'services':
      return 'features.cards';
    case 'about':
      return brief.hasPhotos ? 'about.split' : 'about.editorial';
    case 'gallery':
      return 'gallery.grid';
    case 'testimonials':
      return 'social-proof.numbers';
    case 'faq':
      return 'faq.accordion';
    case 'cta':
      return 'cta.banner';
    case 'contact':
      return 'contact.form';
    case 'footer':
      return 'footer.minimal';
    default:
      return 'content.block';
  }
}

function uniqueIds(ids: ComponentId[]): ComponentId[] {
  return [...new Set(ids)];
}

function heroAllowList(brief: GrammarBrief): ComponentId[] {
  const lite: ComponentId[] = brief.hasPhotos
    ? [
        'hero.split-image',
        'hero.centered',
        'hero.full-image',
        'hero.gradient',
        'hero.marketing',
      ]
    : ['hero.marketing', 'hero.gradient', 'hero.centered', 'hero.morphing'];

  if (brief.runtime !== 'premium') return lite;

  const premium: ComponentId[] = ['hero.morphing'];
  if (brief.hasPhotos) {
    premium.push('hero.split', 'hero.interactive', 'hero.product');
    if (brief.imageStrategy === 'large-photography') {
      premium.push('hero.cinematic');
    }
  }
  if (brief.hasPhotos || brief.hasVideo) {
    premium.push('hero.immersive');
  }
  return uniqueIds([...lite, ...premium]);
}

export function allowedComponentsForType(
  type: string,
  brief: GrammarBrief,
): ComponentId[] {
  const defaults: Record<string, ComponentId[]> = {
    header: [
      'navbar.minimal',
      'navbar.centered',
      'navbar.premium',
      'navbar.marketing',
    ],
    hero: heroAllowList(brief),
    services: [
      'features.cards',
      'features.bento',
      'features.alternating',
      'features.showcase',
    ],
    about: brief.hasPhotos
      ? ['about.split', 'about.editorial']
      : ['about.editorial'],
    gallery: ['gallery.grid', 'gallery.masonry', 'gallery.carousel'],
    testimonials: [
      'social-proof.numbers',
      'social-proof.stats',
      'testimonials.cards',
      'testimonials.quotes',
    ],
    faq: ['faq.accordion'],
    cta: ['cta.banner', 'cta.split', 'cta.dark'],
    contact: ['contact.form'],
    footer: ['footer.minimal', 'footer.premium'],
    custom: ['content.block'],
  };
  return defaults[type] || ['content.block'];
}
