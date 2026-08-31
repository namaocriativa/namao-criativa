import {
  type Architecture,
  type ComponentId,
  type Cta,
  type GrammarBrief,
  type NavItem,
  type PageSpec,
  type SectionSpec,
  type UserSectionType,
  USER_TYPE_TO_FAMILY,
  allowedComponentsForType,
  defaultComponentForType,
  familyOf,
  getComponentMeta,
  isComponentId,
  parseComponentProps,
  resolveComponentId,
} from '@namao/landing-kit';
import { isAllowedHref } from './pipeline-assembler';
import type { LandingSectionConfig, LeadBrief, SectionMedia } from './pipeline.types';

export function grammarBriefFromLead(
  brief: LeadBrief,
  lockedTypes?: string[],
): GrammarBrief {
  return {
    hasPhotos: brief.images.some((img) => img.kind === 'photo'),
    hasServices: Boolean(brief.services?.length),
    hasRating: brief.rating != null,
    hasDescription: Boolean(brief.description),
    hasContacts: Boolean(
      brief.contacts.phone ||
        brief.contacts.whatsappUrl ||
        brief.contacts.email ||
        brief.contacts.website ||
        brief.contacts.mapsUrl ||
        brief.address,
    ),
    hasLogo: brief.images.some((img) => img.kind === 'logo'),
    hasVideo: Boolean(brief.videos?.length),
    lockedTypes,
  };
}

export function photoPaths(brief: LeadBrief): string[] {
  return brief.images
    .filter((img) => img.kind === 'photo')
    .map((img) => img.publicPath);
}

export function logoPath(brief: LeadBrief): string | undefined {
  return brief.images.find((img) => img.kind === 'logo')?.publicPath;
}

export function locationLine(brief: LeadBrief): string {
  return [brief.city, brief.state].filter(Boolean).join(', ');
}

function statsFromBrief(brief: LeadBrief): Array<{ value: string; label: string }> {
  const items: Array<{ value: string; label: string }> = [];
  if (brief.rating != null) {
    items.push({ value: Number(brief.rating).toFixed(1), label: 'Avaliação' });
  }
  if (brief.reviewCount != null) {
    items.push({ value: String(brief.reviewCount), label: 'Avaliações' });
  }
  if (brief.city) {
    items.push({ value: brief.city, label: 'Cidade' });
  }
  return items;
}

export function navFromSections(
  sections: Array<{ id: string; type: string; title?: string }>,
): NavItem[] {
  return sections
    .filter((item) => item.type !== 'header' && item.type !== 'footer')
    .map((item) => ({
      label: item.title || item.id,
      href: `#${item.id}`,
    }));
}

export function primaryCtaFromBrief(brief: LeadBrief): Cta | null {
  if (brief.contacts.whatsappUrl) {
    return { label: 'WhatsApp', href: brief.contacts.whatsappUrl };
  }
  if (brief.contacts.phone) {
    return {
      label: 'Ligar',
      href: `tel:${brief.contacts.phone.replace(/\s/g, '')}`,
    };
  }
  if (brief.contacts.email) {
    return { label: 'E-mail', href: `mailto:${brief.contacts.email}` };
  }
  return null;
}

export function contactLinks(
  brief: LeadBrief,
): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  const { contacts } = brief;
  if (contacts.phone) {
    links.push({
      label: contacts.phone,
      href: `tel:${contacts.phone.replace(/\s/g, '')}`,
    });
  }
  if (contacts.whatsappUrl) {
    links.push({ label: 'WhatsApp', href: contacts.whatsappUrl });
  }
  if (contacts.email) {
    links.push({ label: contacts.email, href: `mailto:${contacts.email}` });
  }
  if (contacts.mapsUrl) {
    links.push({ label: 'Ver no mapa', href: contacts.mapsUrl });
  }
  if (contacts.instagram) {
    links.push({ label: 'Instagram', href: contacts.instagram });
  }
  if (contacts.facebook) {
    links.push({ label: 'Facebook', href: contacts.facebook });
  }
  if (contacts.linkedin) {
    links.push({ label: 'LinkedIn', href: contacts.linkedin });
  }
  return links;
}

export function fillDeterministicProps(
  component: ComponentId,
  brief: LeadBrief,
  ctx: { nav: NavItem[]; primaryCta: Cta | null; title?: string },
): Record<string, unknown> | null {
  const meta = getComponentMeta(component);
  if (!meta?.deterministic) return null;

  switch (familyOf(component)) {
    case 'navbar':
      return {
        brand: brief.name,
        logo: logoPath(brief),
        nav: ctx.nav,
        cta: ctx.primaryCta,
      };
    case 'features':
      return {
        title: ctx.title || 'Serviços',
        items: brief.services ? [...brief.services] : [],
      };
    case 'gallery':
      return {
        title: ctx.title || 'Galeria',
        images: photoPaths(brief),
      };
    case 'social-proof':
      if (component === 'social-proof.numbers') {
        return {
          title: 'Avaliações',
          rating: brief.rating ?? undefined,
          reviewCount: brief.reviewCount ?? undefined,
        };
      }
      if (component === 'social-proof.stats') {
        return {
          title: ctx.title || 'Números',
          items: statsFromBrief(brief),
        };
      }
      return { title: '', logos: [] };
    case 'testimonials':
      return {
        title: ctx.title || 'Avaliações',
        rating: brief.rating ?? undefined,
        reviewCount: brief.reviewCount ?? undefined,
        quotes: [],
      };
    case 'footer':
      return {
        brand: brief.name,
        location: locationLine(brief),
        nav: ctx.nav,
        links: contactLinks(brief),
      };
    default:
      return {};
  }
}

export function sanitizeProps(
  component: ComponentId,
  raw: Record<string, unknown>,
  brief: LeadBrief,
): Record<string, unknown> {
  const allowedImages = new Set(brief.images.map((img) => img.publicPath));
  const allowedVideos = new Set(
    (brief.videos || []).map((item) => item.publicPath),
  );
  const walk = (value: unknown): unknown => {
    if (value === null) return undefined;
    if (typeof value === 'string') {
      if (value.startsWith('/images/') && !allowedImages.has(value)) {
        return undefined;
      }
      if (value.startsWith('/videos/') && !allowedVideos.has(value)) {
        return undefined;
      }
      if (
        /^(https?:|mailto:|tel:)/i.test(value) &&
        !value.startsWith('#') &&
        !isAllowedHref(value, brief)
      ) {
        return undefined;
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(walk).filter((item) => item !== undefined);
    }
    if (value && typeof value === 'object') {
      const next: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value)) {
        const cleaned = walk(nested);
        if (cleaned !== undefined) next[key] = cleaned;
      }
      return next;
    }
    return value;
  };

  const cleaned = walk(raw) as Record<string, unknown>;
  if (familyOf(component) === 'features' && brief.services?.length) {
    cleaned.items = [...brief.services];
  }
  if (familyOf(component) === 'contact') {
    cleaned.links = contactLinks(brief);
    if (brief.address) cleaned.address = brief.address;
    if (!cleaned.cta) cleaned.cta = primaryCtaFromBrief(brief);
  }
  if (familyOf(component) === 'hero') {
    if (!cleaned.headline) cleaned.headline = brief.name;
    if (component === 'hero.marketing') {
      delete cleaned.image;
      if (!cleaned.footnote && brief.city) {
        cleaned.footnote = `Atendimento em ${brief.city}.`;
      }
    } else if (!cleaned.image) {
      const photo = photoPaths(brief)[0];
      if (photo) cleaned.image = photo;
    }
    if (!cleaned.cta) cleaned.cta = primaryCtaFromBrief(brief);
    if (component === 'hero.morphing') {
      const words = Array.isArray(cleaned.words)
        ? (cleaned.words as unknown[]).map(String).filter(Boolean)
        : [];
      if (!words.length) {
        cleaned.words = brief.services?.length
          ? brief.services.slice(0, 4)
          : [brief.name];
      }
    }
    if (component === 'hero.product' && !cleaned.screenshot && cleaned.image) {
      cleaned.screenshot = cleaned.image;
    }
    const stock = brief.videos?.[0];
    if (
      stock &&
      (component === 'hero.cinematic' ||
        component === 'hero.immersive' ||
        component === 'hero.split-video')
    ) {
      if (component === 'hero.split-video') {
        const background =
          (brief.videos || []).find((item) =>
            /background/i.test(item.filename),
          ) || brief.videos?.[0];
        const portrait =
          (brief.videos || []).find((item) => /portrait/i.test(item.filename)) ||
          brief.videos?.[1] ||
          background;
        if (!cleaned.video && background) cleaned.video = background.publicPath;
        if (!cleaned.portraitVideo && portrait) {
          cleaned.portraitVideo = portrait.publicPath;
        }
      } else if (!cleaned.video) {
        cleaned.video = stock.publicPath;
        if (component === 'hero.immersive') cleaned.mode = 'video';
      } else if (component === 'hero.immersive' && cleaned.video) {
        cleaned.mode = 'video';
      }
      if (!cleaned.footnote && stock.photographer) {
        cleaned.footnote = `Video by ${stock.photographer || 'Pexels'} on Pexels`;
      }
    }
    if (component === 'hero.split-video') {
      const highlights = Array.isArray(cleaned.highlights)
        ? (cleaned.highlights as unknown[])
        : [];
      if (!highlights.length && brief.services?.length) {
        cleaned.highlights = brief.services.slice(0, 4).map((label) => ({ label }));
      }
    }
  }
  if (familyOf(component) === 'cta') {
    if (!cleaned.title) cleaned.title = 'Fale conosco';
    if (!cleaned.cta) cleaned.cta = primaryCtaFromBrief(brief);
    if (component === 'cta.dark' && !cleaned.footnote && brief.city) {
      cleaned.footnote = `Atendimento em ${brief.city}.`;
    }
  }
  if (
    familyOf(component) === 'testimonials' ||
    component === 'social-proof.numbers'
  ) {
    cleaned.quotes = [];
    if (brief.rating != null) cleaned.rating = brief.rating;
    if (brief.reviewCount != null) cleaned.reviewCount = brief.reviewCount;
  }
  if (component === 'social-proof.stats') {
    cleaned.items = statsFromBrief(brief);
  }
  return parseComponentProps(component, cleaned) as Record<string, unknown>;
}

export function applyAssignedMedia(
  component: ComponentId,
  props: Record<string, unknown>,
  media?: SectionMedia | null,
): Record<string, unknown> {
  if (!media) return props;
  const next = { ...props };
  const family = familyOf(component);
  const images = (media.images || []).filter(Boolean);
  const first = images[0];
  if (family === 'navbar') {
    if (media.logo) next.logo = media.logo;
    else if (first) next.logo = first;
  }
  if (family === 'hero') {
    if (first) {
      next.image = first;
      next.screenshot = first;
    }
    if (images[1]) next.portraitImage = images[1];
    if (media.video) next.video = media.video;
    if (media.portraitVideo) next.portraitVideo = media.portraitVideo;
  }
  if (family === 'about' && first) next.image = first;
  if (family === 'gallery' && images.length) next.images = images;
  if (family === 'cta' && first) next.image = first;
  if ((family === 'layout' || family === 'effects') && first) {
    next.image = first;
  }
  return next;
}

export function componentFitsSectionType(id: ComponentId, type: string): boolean {
  const family = familyOf(id);
  const expected = USER_TYPE_TO_FAMILY[type as UserSectionType];
  if (expected && family === expected) return true;
  if (type === 'testimonials' && family === 'social-proof') return true;
  if (type === 'custom' && (family === 'content' || family === 'layout' || family === 'effects')) {
    return true;
  }
  return false;
}

export function coerceComponentId(
  value: unknown,
  type: string,
  brief: GrammarBrief,
): ComponentId {
  const raw = String(value || '').trim();
  const resolved = resolveComponentId(raw);
  const allowed = allowedComponentsForType(type, brief);
  if (resolved && allowed.includes(resolved)) return resolved;
  if (isComponentId(raw) && allowed.includes(raw)) return raw;
  return allowed[0] || defaultComponentForType(type, brief);
}

export function resolveArchitecture(
  value: unknown,
  locked: LandingSectionConfig[],
  grammar: GrammarBrief,
): Architecture {
  const byId = new Map<string, { component?: string; purpose?: string }>();
  if (value && typeof value === 'object') {
    const sections = (value as { sections?: unknown }).sections;
    if (Array.isArray(sections)) {
      for (const row of sections) {
        if (!row || typeof row !== 'object') continue;
        const item = row as {
          id?: unknown;
          component?: unknown;
          purpose?: unknown;
        };
        const id = String(item.id || '').trim();
        if (!id) continue;
        byId.set(id, {
          component: String(item.component || ''),
          purpose: String(item.purpose || ''),
        });
      }
    }
  }
  return {
    sections: locked.map((section) => {
      const picked = byId.get(section.id);
      const userLock = resolveComponentId(section.component || '');
      const component =
        userLock && componentFitsSectionType(userLock, section.type)
          ? userLock
          : coerceComponentId(
              picked?.component,
              section.type,
              grammar,
            );
      return {
        id: section.id,
        type: section.type,
        component,
        purpose: picked?.purpose || section.description,
      };
    }),
  };
}

export function validatePageSpecAgainstBrief(
  spec: PageSpec,
  brief: LeadBrief,
): string[] {
  const issues: string[] = [];
  const blob = JSON.stringify(spec);
  const allowedImages = new Set(brief.images.map((img) => img.publicPath));
  const imageRefs = blob.match(/\/images\/[^"\\\s]+/g) || [];
  for (const ref of imageRefs) {
    if (!allowedImages.has(ref)) issues.push(`Imagem não permitida: ${ref}`);
  }
  const allowedVideos = new Set(
    (brief.videos || []).map((item) => item.publicPath),
  );
  const videoRefs = blob.match(/\/videos\/[^"\\\s]+/g) || [];
  for (const ref of videoRefs) {
    if (!allowedVideos.has(ref)) issues.push(`Vídeo não permitido: ${ref}`);
  }
  for (const section of spec.sections) {
    const hrefs = collectHrefs(section.props);
    for (const href of hrefs) {
      if (!isAllowedHref(href, brief)) {
        issues.push(`href inventado ou fora do brief: ${href}`);
      }
    }
    if (familyOf(section.component) === 'features' && brief.services?.length) {
      const items = Array.isArray(section.props.items)
        ? (section.props.items as string[])
        : [];
      if (JSON.stringify(items) !== JSON.stringify(brief.services)) {
        issues.push(
          'services: items devem ser exatamente iguais ao brief.services',
        );
      }
    }
    if (
      (familyOf(section.component) === 'testimonials' ||
        section.component === 'social-proof.numbers' ||
        section.component === 'social-proof.stats') &&
      Array.isArray(section.props.quotes) &&
      (section.props.quotes as unknown[]).length
    ) {
      issues.push('testimonials: não invente citações');
    }
  }
  return issues;
}

function collectHrefs(value: unknown): string[] {
  const hrefs: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.href === 'string') hrefs.push(record.href);
    Object.values(record).forEach(visit);
  };
  visit(value);
  return hrefs;
}

export function applySwap(
  spec: PageSpec,
  sectionId: string,
  component: ComponentId,
  brief: GrammarBrief,
): PageSpec {
  return {
    ...spec,
    sections: spec.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const next = coerceComponentId(component, section.type, brief);
      return { ...section, component: next };
    }),
  };
}

export function applyPropPatch(
  spec: PageSpec,
  sectionId: string,
  patch: Record<string, unknown>,
  brief: LeadBrief,
): PageSpec {
  return {
    ...spec,
    sections: spec.sections.map((section): SectionSpec => {
      if (section.id !== sectionId) return section;
      const merged = sanitizeProps(
        section.component,
        { ...section.props, ...patch },
        brief,
      );
      return { ...section, props: merged };
    }),
  };
}
