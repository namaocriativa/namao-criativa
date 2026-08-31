import type {
  AllowedContacts,
  BriefImage,
  LeadBrief,
  SitePlan,
  VisionAnalysis,
} from './pipeline.types';

const PLAN_DESCRIPTION_MAX = 400;
const SECTION_DESCRIPTION_MAX = 280;

export type SlimImage = { kind: BriefImage['kind']; publicPath: string };

export type PlanBriefSlice = {
  name: string;
  category: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  services: string[] | null;
  rating: number | null;
  reviewCount: number | null;
  present: string[];
  omitted: string[];
  contactKeys: string[];
  contacts: AllowedContacts;
  images: SlimImage[];
};

export function sliceBriefForPlan(brief: LeadBrief): PlanBriefSlice {
  return {
    name: brief.name,
    category: brief.category,
    description: truncate(brief.description, PLAN_DESCRIPTION_MAX),
    city: brief.city,
    state: brief.state,
    address: brief.address,
    services: brief.services,
    rating: brief.rating,
    reviewCount: brief.reviewCount,
    present: brief.present,
    omitted: brief.omitted,
    contactKeys: contactKeys(brief),
    contacts: brief.contacts,
    images: slimImages(brief.images),
  };
}

export function sliceBriefForReview(brief: LeadBrief) {
  return {
    name: brief.name,
    omitted: brief.omitted,
    present: brief.present,
    contacts: brief.contacts,
    services: brief.services,
    images: brief.images.map((img) => img.publicPath),
  };
}

export function sliceBriefForSection(
  brief: LeadBrief,
  type: string,
  plan: SitePlan,
): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return {
        name: brief.name,
        city: brief.city,
        state: brief.state,
        category: brief.category,
        description: truncate(brief.description, SECTION_DESCRIPTION_MAX),
        photos: slimImages(brief.images, 'photo', 2),
        videos: (brief.videos || []).map((item) => item.publicPath),
        primaryCta: plan.primaryCta,
        omitted: pickOmitted(brief, [
          'description',
          'city',
          'category',
          'phone',
          'whatsapp',
          'email',
        ]),
      };
    case 'services':
      return {
        name: brief.name,
        services: brief.services,
      };
    case 'gallery':
      return {
        photos: slimImages(brief.images, 'photo'),
      };
    case 'about':
    case 'faq':
      return {
        name: brief.name,
        category: brief.category,
        city: brief.city,
        description: truncate(brief.description, SECTION_DESCRIPTION_MAX),
        rating: brief.rating,
        reviewCount: brief.reviewCount,
        omitted: pickOmitted(brief, [
          'description',
          'rating',
          'reviewCount',
          'category',
        ]),
      };
    case 'contact':
    case 'cta':
    case 'header':
    case 'footer':
      return {
        name: brief.name,
        city: brief.city,
        contacts: brief.contacts,
        logo: slimImages(brief.images, 'logo', 1)[0] || null,
        anchors: plan.sectionConfigs
          .filter((item) => item.type !== 'header' && item.type !== 'footer')
          .map((item) => ({ id: item.id, title: item.title })),
        primaryCta: plan.primaryCta,
        omitted: pickOmitted(brief, [
          'phone',
          'whatsapp',
          'email',
          'website',
          'address',
          'instagram',
          'facebook',
          'linkedin',
        ]),
      };
    default:
      return {
        name: brief.name,
        present: brief.present,
        omitted: brief.omitted,
        description: truncate(brief.description, SECTION_DESCRIPTION_MAX),
        services: brief.services,
        contacts: brief.contacts,
        city: brief.city,
        address: brief.address,
        images: slimImages(brief.images),
      };
  }
}

export function sliceVisionForSection(
  vision: VisionAnalysis | null | undefined,
  type: string,
): Record<string, unknown> | null {
  if (!vision) return null;
  if (type === 'hero') {
    return {
      heroSuggestion: vision.heroSuggestion,
      photoNotes: vision.photoNotes,
    };
  }
  if (type === 'header') {
    return { logoNotes: vision.logoNotes };
  }
  if (type === 'gallery') {
    return { photoNotes: vision.photoNotes };
  }
  return null;
}

export function sliceVisionForDesign(
  vision: VisionAnalysis | null | undefined,
): Pick<VisionAnalysis, 'atmosphere' | 'colorHints' | 'avoid'> | null {
  if (!vision) return null;
  return {
    atmosphere: vision.atmosphere,
    colorHints: vision.colorHints,
    avoid: vision.avoid,
  };
}

function slimImages(
  images: BriefImage[],
  kind?: BriefImage['kind'],
  limit?: number,
): SlimImage[] {
  let list = kind ? images.filter((img) => img.kind === kind) : images;
  if (limit != null) list = list.slice(0, limit);
  return list.map((img) => ({ kind: img.kind, publicPath: img.publicPath }));
}

function contactKeys(brief: LeadBrief): string[] {
  return (Object.keys(brief.contacts) as Array<keyof AllowedContacts>).filter(
    (key) => Boolean(brief.contacts[key]),
  );
}

function pickOmitted(brief: LeadBrief, keys: string[]): string[] {
  return keys.filter((key) => brief.omitted.includes(key));
}

function truncate(text: string | null, max: number): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
