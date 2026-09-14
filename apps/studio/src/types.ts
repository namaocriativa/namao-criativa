export interface LeadImage {
  id?: string;
  source?: string;
  sourceUrl?: string;
  localPath: string;
  filename?: string;
  mimeType?: string | null;
}

export interface LeadSource {
  provider?: string;
}

export interface Lead {
  id?: string;
  _entityKind?: "lead" | "customer";
  name?: string;
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
  services?: string | string[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
  images?: LeadImage[];
  sources?: LeadSource[];
  users?: Array<{ id?: string; email?: string; name?: string }>;
  invites?: Array<{
    id?: string;
    status?: string;
    phone?: string | null;
    expiresAt?: string;
  }>;
  instagramConnections?: Array<{
    id?: string;
    username?: string | null;
    igUserId?: string;
  }>;
  _count?: { images?: number; sources?: number };
  landingSlug?: string | null;
  landingStatus?: string | null;
  landingBuiltAt?: string | null;
  activeLandingJobId?: string | null;
  publishedOrigin?: string | null;
  vercelProjectId?: string | null;
  fromPublicSignup?: boolean;
  createdBy?: { id: string; name: string; email: string } | null;
  sharedWithMe?: boolean;
  canManageShares?: boolean;
  source?: string;
  discoverySources?: string[];
  generateConfig?: {
    sections?: Array<{
      id?: string;
      type?: string;
      title?: string;
      description?: string;
      component?: string;
      stockVideo?: boolean;
      media?: {
        images?: string[];
        logo?: string;
        video?: string;
        portraitVideo?: string;
      };
    }>;
    components?: Array<{ component?: string }>;
    features?: Array<{ id?: string }>;
    copywriter?: {
      category?: string;
      description?: string;
      services?: string[];
      address?: string;
      notes?: string;
    };
  } | null;
}

export interface PackageImage {
  id: string;
  packageId?: string;
  sourceUrl?: string;
  localPath: string;
  filename?: string;
  mimeType?: string | null;
  sortOrder?: number;
  createdAt?: string;
}

export interface AgencyPackage {
  id: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string;
  benefits?: string[] | null;
  whatsappMessage?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  status?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  images?: PackageImage[];
  _count?: { images?: number };
}

export interface CitySuggestion {
  id?: string;
  name: string;
  state: string;
  label: string;
}

export interface NeighborhoodSuggestion {
  name: string;
  city: string;
  state: string;
  label: string;
}
