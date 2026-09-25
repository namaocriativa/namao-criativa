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
  websiteProjectId?: string | null;
  websiteDeployType?: "cloudflare" | "vercel" | string | null;
  websiteRepo?: string | null;
  websiteFramework?: string | null;
  websiteDomain?: string | null;
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
  promoPrice?: number | null;
  currency?: string;
  benefits?: string[] | null;
  status?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  images?: PackageImage[];
  _count?: { images?: number };
}

export interface ImageModelCapabilities {
  aspectRatios: string[];
  resolutions: string[];
  personGenerations?: string[];
  thinkingLevels?: string[];
  googleSearch: boolean;
  imageSearch?: boolean;
  systemInstruction: boolean;
  thinking: boolean;
  maxReferences: number;
}

export interface ImageModelDefinition {
  id: string;
  label: string;
  description: string;
  provider: string;
  default?: boolean;
  capabilities: ImageModelCapabilities;
}

export interface ImageSkillRunPackage {
  id: string;
  name: string;
  price?: number | null;
  promoPrice?: number | null;
  currency?: string | null;
}

export interface ImageSkillRun {
  leadId?: string;
  leadLabel?: string;
  packageIds?: string[];
  packages?: ImageSkillRunPackage[];
  notes?: string;
  prompt?: string;
  slideCount?: number;
  completedSlides?: number;
  error?: string;
  spec?: Record<string, unknown> | null;
}

export interface ImageProjectSettings {
  model: string;
  temperature: number;
  aspectRatio: string;
  imageSize: string;
  systemInstruction: string;
  googleSearch: boolean;
  imageSearch?: boolean;
  personGeneration?: string;
  thinkingLevel?: string;
  includeThoughts?: boolean;
  featureId?: string;
  skillRun?: ImageSkillRun;
}

export interface CreativeCharacterAsset {
  id: string;
  characterId?: string;
  kind: "upload" | "sheet" | "photo" | "video" | string;
  localPath: string;
  filename?: string;
  mimeType?: string | null;
  createdAt?: string;
}

export interface CreativeCharacter {
  id: string;
  name: string;
  appearance: string;
  personality?: string;
  identityPrompt?: string;
  createdAt?: string;
  updatedAt?: string;
  assets?: CreativeCharacterAsset[];
}

export type CreativeMovieShotStatus = "draft" | "generating" | "ready" | "failed" | string;

export interface CreativeMovieShotCast {
  shotId?: string;
  characterId: string;
  assetId?: string | null;
  sortOrder?: number;
  character?: CreativeCharacter;
}

export interface CreativeMovieShot {
  id: string;
  movieId?: string;
  characterId: string;
  sortOrder: number;
  scene: string;
  action: string;
  dialogue?: string;
  framing?: string;
  camera?: string;
  status: CreativeMovieShotStatus;
  error?: string;
  localPath?: string;
  filename?: string;
  mimeType?: string | null;
  createdAt?: string;
  updatedAt?: string;
  character?: CreativeCharacter;
  cast?: CreativeMovieShotCast[];
}

export interface CreativeMovie {
  id: string;
  title: string;
  aspectRatio: string;
  duration: string;
  createdAt?: string;
  updatedAt?: string;
  shots?: CreativeMovieShot[];
}

export type CreativeStartEndStatus =
  | "draft"
  | "generating"
  | "ready"
  | "failed"
  | string;

export interface CreativeStartEndClip {
  id: string;
  prompt?: string;
  duration: string;
  aspectRatio: string;
  resolution?: string;
  status: CreativeStartEndStatus;
  error?: string;
  firstFramePath?: string;
  firstFrameName?: string;
  firstFrameMime?: string | null;
  lastFramePath?: string;
  lastFrameName?: string;
  lastFrameMime?: string | null;
  localPath?: string;
  filename?: string;
  mimeType?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreativeUgcClip {
  id: string;
  characterId: string;
  prompt?: string;
  duration: string;
  aspectRatio: string;
  resolution?: string;
  status: CreativeStartEndStatus;
  error?: string;
  firstFramePath?: string;
  firstFrameName?: string;
  firstFrameMime?: string | null;
  productPath?: string;
  productName?: string;
  productMime?: string | null;
  localPath?: string;
  filename?: string;
  mimeType?: string | null;
  createdAt?: string;
  updatedAt?: string;
  character?: CreativeCharacter;
}

export interface ImageAsset {
  id: string;
  projectId?: string;
  messageId?: string | null;
  kind: "generated" | "reference" | string;
  localPath: string;
  filename?: string;
  mimeType?: string | null;
  createdAt?: string;
}

export interface TokenUsage {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
}

export interface ImageMessage {
  id: string;
  projectId?: string;
  role: "user" | "model" | "assistant" | "tool" | string;
  kind?: "chat" | "tool" | "proposal" | "generation" | string;
  status?: "pending" | "confirmed" | "cancelled" | string | null;
  text?: string | null;
  thoughts?: string | null;
  model?: string | null;
  settings?: (ImageProjectSettings & Record<string, unknown>) | null;
  usage?: TokenUsage | null;
  toolName?: string | null;
  createdAt?: string;
  assets?: ImageAsset[];
}

export interface ImageProject {
  id: string;
  name: string;
  settings?: ImageProjectSettings;
  createdAt?: string;
  updatedAt?: string;
  messages?: ImageMessage[];
  assets?: ImageAsset[];
  _count?: { messages?: number; assets?: number };
}

export interface ImageLibraryAsset {
  id: string;
  filename: string;
  localPath: string;
  mimeType?: string | null;
  createdAt?: string;
}

export interface ImageLibraryProject {
  id: string;
  name: string;
  updatedAt?: string;
  assets: ImageLibraryAsset[];
}

export interface VideoModelCapabilities {
  aspectRatios: string[];
  durations: string[];
  resolutions: string[];
  thinkingLevels: string[];
  maxFrames: number;
}

export interface VideoModelPricing {
  currency?: string;
  videoUsdPerSecond?: Record<string, number>;
}

export interface VideoModelDefinition {
  id: string;
  label: string;
  description: string;
  provider: string;
  generationApi?: "interactions" | "predictLongRunning";
  default?: boolean;
  capabilities: VideoModelCapabilities;
  pricing?: VideoModelPricing;
}

export interface VideoProjectSettings {
  model: string;
  aspectRatio: string;
  duration: string;
  resolution: string;
  thinkingLevel: string;
}

export interface VideoAsset {
  id: string;
  projectId?: string;
  messageId?: string | null;
  kind: "generated" | "first-frame" | "last-frame" | "reference" | string;
  localPath: string;
  filename?: string;
  mimeType?: string | null;
  createdAt?: string;
}

export interface VideoLibraryAsset {
  id: string;
  filename: string;
  localPath: string;
  mimeType?: string | null;
  createdAt?: string;
}

export interface VideoLibraryProject {
  id: string;
  name: string;
  updatedAt?: string;
  assets: VideoLibraryAsset[];
}

export interface VideoMessage {
  id: string;
  projectId?: string;
  role: "user" | "model" | "assistant" | "tool" | string;
  kind?: "chat" | "tool" | "proposal" | "generation" | string;
  status?: "pending" | "confirmed" | "cancelled" | string | null;
  text?: string | null;
  thoughts?: string | null;
  model?: string | null;
  settings?: (VideoProjectSettings & Record<string, unknown>) | null;
  usage?: TokenUsage | null;
  toolName?: string | null;
  providerInteractionId?: string | null;
  createdAt?: string;
  assets?: VideoAsset[];
}

export interface VideoProject {
  id: string;
  name: string;
  settings?: VideoProjectSettings;
  createdAt?: string;
  updatedAt?: string;
  messages?: VideoMessage[];
  assets?: VideoAsset[];
  _count?: { messages?: number; assets?: number };
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

export type CalendarPlatform = "instagram" | "youtube" | "tiktok";

export type CalendarPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partial"
  | "failed"
  | string;

export type CalendarTargetStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "ready_manual"
  | "needs_connection"
  | string;

export interface CalendarTarget {
  id: string;
  platform: CalendarPlatform | string;
  status: CalendarTargetStatus;
  error?: string;
  externalId?: string;
  permalink?: string;
  publishedAt?: string | null;
}

export interface CalendarAsset {
  id: string;
  kind: "image" | "video" | string;
  localPath: string;
  filename: string;
  mimeType?: string | null;
  source?: string;
}

export interface CalendarPost {
  id: string;
  title: string;
  caption?: string;
  scheduledAt: string;
  status: CalendarPostStatus;
  leadId?: string | null;
  customerId?: string | null;
  lead?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  targets?: CalendarTarget[];
  assets?: CalendarAsset[];
}

export interface CalendarAutomation {
  instagram: {
    graphConfigured: boolean;
    autoPublish: boolean;
    needsPublicApi: boolean;
  };
  youtube: { oauthConfigured: boolean; autoPublish: boolean };
  tiktok: { oauthConfigured: boolean; autoPublish: boolean };
  publicMediaOrigin: string;
}
