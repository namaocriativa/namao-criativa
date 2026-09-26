export type LeadLike = {
  id?: string | null;
  name?: string | null;
  landingSlug?: string | null;
  category?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  services?: unknown;
  rating?: number | null;
  reviewCount?: number | null;
  images?: Array<{
    filename?: string | null;
    localPath?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
  }>;
};

export function slugifyLeadName(name: unknown): string {
  return (
    String(name || 'lead')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lead'
  );
}

/** Slug estável: reutiliza landingSlug salvo ou `{nome}-{ultimos8DoLeadId}`. */
export function stableLandingSlug(lead: {
  id?: string | null;
  name?: string | null;
  landingSlug?: string | null;
}): string {
  const saved = String(lead.landingSlug || '').trim();
  if (saved) return saved;
  const base = slugifyLeadName(lead.name).slice(0, 50);
  const id = String(lead.id || '');
  const suffix = id.slice(-8) || 'unknown';
  return `${base}-${suffix}`;
}
