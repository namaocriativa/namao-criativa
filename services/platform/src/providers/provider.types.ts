export interface LeadFields {
  name?: string | null;
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
  services?: string[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProviderImage {
  url: string;
  kind?: 'logo' | 'photo';
}

export interface ProviderResult {
  provider: string;
  data: Partial<LeadFields>;
  sourceUrl?: string;
  externalId?: string;
  images?: ProviderImage[];
  raw?: unknown;
}

export interface DiscoveryQuery {
  city: string;
  state: string;
  category?: string;
  limit?: number;
  neighborhood?: string;
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
  /** Overpass bbox: south,west,north,east */
  bbox?: string;
}

export interface DiscoveryResult {
  name: string;
  address?: string | null;
  website?: string | null;
  instagram?: string | null;
  phone?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  externalId?: string | null;
  source?: string;
  sources?: string[];
}

export interface EnrichmentInput extends LeadFields {
  name: string;
}
