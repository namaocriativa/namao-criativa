import type { LeadLike } from './prompt.builder';
import { stableLandingSlug } from './prompt.builder';
import type {
  AllowedContacts,
  BriefImage,
  CopywriterBriefOverride,
  LeadBrief,
  SectionId,
} from './pipeline.types';

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function servicesList(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value.map(String).map((s) => s.trim()).filter(Boolean);
    return items.length ? items : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const items = text
    .split(/[|,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : [text];
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildLeadBrief(lead: LeadLike): LeadBrief {
  const slug = stableLandingSlug(lead);
  const images = (lead.images || [])
    .map((img, index): BriefImage | null => {
      const filename =
        textOrNull(img.filename) ||
        `image-${String(index + 1).padStart(2, '0')}.jpg`;
      const kind = /logo/i.test(`${img.filename || ''} ${img.sourceUrl || ''}`)
        ? 'logo'
        : 'photo';
      return {
        filename,
        publicPath: `/images/${filename}`,
        kind,
        source: textOrNull(img.source),
      };
    })
    .filter((img): img is BriefImage => Boolean(img));

  const phone = textOrNull(lead.phone);
  const whatsapp = textOrNull(lead.whatsapp);
  const email = textOrNull(lead.email);
  const website = textOrNull(lead.website);
  const instagram = textOrNull(lead.instagram);
  const facebook = textOrNull(lead.facebook);
  const linkedin = textOrNull(lead.linkedin);
  const address = textOrNull(lead.address);
  const hasCoords = lead.latitude != null && lead.longitude != null;

  const contacts: AllowedContacts = {};
  if (phone) contacts.phone = phone;
  if (whatsapp) {
    contacts.whatsapp = whatsapp;
    const digits = digitsOnly(whatsapp);
    if (digits) contacts.whatsappUrl = `https://wa.me/${digits}`;
  } else if (phone) {
    const digits = digitsOnly(phone);
    if (digits) contacts.whatsappUrl = `https://wa.me/${digits}`;
  }
  if (email) contacts.email = email;
  if (website) contacts.website = website;
  if (instagram) contacts.instagram = instagram;
  if (facebook) contacts.facebook = facebook;
  if (linkedin) contacts.linkedin = linkedin;
  if (hasCoords) {
    contacts.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`;
  } else if (address) {
    contacts.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  return refreshBriefPresence({
    leadId: String(lead.id || ''),
    name: textOrNull(lead.name) || slug,
    slug,
    outputDir: `leads/${slug}`,
    category: textOrNull(lead.category),
    description: textOrNull(lead.description),
    services: servicesList(lead.services),
    address,
    city: textOrNull(lead.city),
    state: textOrNull(lead.state),
    country: textOrNull(lead.country),
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    omitted: [],
    present: [],
    images,
    videos: [],
    contacts,
  });
}

function refreshBriefPresence(brief: LeadBrief): LeadBrief {
  const omitted: string[] = [];
  const present: string[] = ['name'];
  const maybe = (key: string, value: unknown) => {
    if (value == null || (Array.isArray(value) && !value.length)) {
      omitted.push(key);
    } else {
      present.push(key);
    }
  };
  maybe('category', brief.category);
  maybe('description', brief.description);
  maybe('services', brief.services);
  maybe('phone', brief.contacts.phone);
  maybe('whatsapp', brief.contacts.whatsapp);
  maybe('email', brief.contacts.email);
  maybe('website', brief.contacts.website);
  maybe('address', brief.address);
  maybe('city', brief.city);
  maybe('state', brief.state);
  maybe('instagram', brief.contacts.instagram);
  maybe('facebook', brief.contacts.facebook);
  maybe('linkedin', brief.contacts.linkedin);
  maybe('rating', brief.rating);
  maybe('reviewCount', brief.reviewCount);
  maybe('images', brief.images.length ? brief.images : null);
  return { ...brief, omitted, present };
}

/** Completa o brief com fatos digitados no wizard. Campos vazios não apagam o enrichment. */
export function applyCopywriterOverride(
  brief: LeadBrief,
  override?: CopywriterBriefOverride | null,
): LeadBrief {
  if (!override) return brief;

  const category = textOrNull(override.category) ?? brief.category;
  const address = textOrNull(override.address) ?? brief.address;
  const services = servicesList(override.services) ?? brief.services;
  const typedDescription = textOrNull(override.description);
  const notes = textOrNull(override.notes);
  const descriptionParts = [typedDescription ?? brief.description, notes].filter(
    Boolean,
  ) as string[];
  const description = descriptionParts.length
    ? [...new Set(descriptionParts)].join('\n\n')
    : null;

  let contacts = brief.contacts;
  if (address && !contacts.mapsUrl) {
    contacts = {
      ...contacts,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    };
  }

  return refreshBriefPresence({
    ...brief,
    category,
    description,
    services,
    address,
    contacts,
  });
}

export function allowedSectionIds(brief: LeadBrief): Set<SectionId> {
  const ids = new Set<SectionId>(['header', 'hero', 'footer']);
  if (brief.services?.length) ids.add('services');
  if (brief.description || brief.rating != null) ids.add('about');
  if (brief.images.some((img) => img.kind === 'photo')) ids.add('gallery');
  if (brief.rating != null) ids.add('testimonials');
  if (brief.description) ids.add('faq');
  const hasContact =
    Boolean(brief.contacts.phone) ||
    Boolean(brief.contacts.whatsapp) ||
    Boolean(brief.contacts.email) ||
    Boolean(brief.contacts.website) ||
    Boolean(brief.contacts.instagram) ||
    Boolean(brief.contacts.facebook) ||
    Boolean(brief.contacts.linkedin) ||
    Boolean(brief.address) ||
    Boolean(brief.contacts.mapsUrl);
  if (hasContact) {
    ids.add('contact');
    ids.add('cta');
  }
  return ids;
}
