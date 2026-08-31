import {
  coerceFeatureId,
  normalizeThemeColors,
  parseColorIntensity,
  resolveComponentId,
  type ThemePayload,
} from '@namao/landing-kit';
import type {
  CopywriterBriefOverride,
  LandingFeature,
  LandingGenerateConfig,
  LandingSectionConfig,
  SelectedUiComponent,
} from './pipeline.types';
import {
  CUSTOM_SECTION_TYPE,
  defaultSectionConfigs,
  getPresetSection,
  slugifySectionId,
  uniqueSectionId,
} from './section-catalog';

const MAX_TEXT = 500;
const MAX_COPY = 4000;
const MAX_MEDIA_PATH = 200;

function asMediaPath(value: unknown, prefix: '/images/' | '/videos/'): string | undefined {
  const text = String(value || '').trim().slice(0, MAX_MEDIA_PATH);
  if (!text.startsWith(prefix)) return undefined;
  if (text.includes('..') || text.includes('\\')) return undefined;
  return text;
}

export function normalizeSectionMedia(
  raw?: LandingSectionConfig['media'] | null,
): LandingSectionConfig['media'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const images = Array.isArray(raw.images)
    ? [...new Set(raw.images.map((item) => asMediaPath(item, '/images/')).filter(Boolean))]
        .slice(0, 20) as string[]
    : [];
  const logo = asMediaPath(raw.logo, '/images/');
  const video = asMediaPath(raw.video, '/videos/');
  const portraitVideo = asMediaPath(raw.portraitVideo, '/videos/');
  const next: NonNullable<LandingSectionConfig['media']> = {};
  if (images.length) next.images = images;
  if (logo) next.logo = logo;
  if (video) next.video = video;
  if (portraitVideo) next.portraitVideo = portraitVideo;
  return Object.keys(next).length ? next : undefined;
}

function asText(value: unknown, fallback = ''): string {
  return String(value || fallback).trim().slice(0, MAX_TEXT);
}

export function normalizeSectionConfigs(
  raw?: Array<Partial<LandingSectionConfig>> | null,
): LandingSectionConfig[] {
  if (!raw?.length) return defaultSectionConfigs();

  const used = new Set<string>();
  const sections: LandingSectionConfig[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const type = asText(item.type, CUSTOM_SECTION_TYPE) || CUSTOM_SECTION_TYPE;
    const preset = getPresetSection(type);
    const title =
      asText(item.title) || preset?.title || 'Seção';
    const description =
      asText(item.description) || preset?.description || title;
    const preferred =
      preset && type === preset.type
        ? type
        : slugifySectionId(asText(item.id) || title, CUSTOM_SECTION_TYPE);
    const id = uniqueSectionId(preferred, used);
    const resolved = resolveComponentId(asText(item.component));
    const stockVideo = type === 'hero' && Boolean(item.stockVideo);
    const media = normalizeSectionMedia(item.media);
    sections.push({
      id,
      type,
      title,
      description,
      ...(resolved ? { component: resolved } : {}),
      ...(stockVideo ? { stockVideo: true } : {}),
      ...(media ? { media } : {}),
    });
  }

  return sections.length ? sections : defaultSectionConfigs();
}

export function normalizeUiComponents(
  raw?: SelectedUiComponent[] | null,
): SelectedUiComponent[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const components: SelectedUiComponent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const component = asText(item.component, '').slice(0, 80);
    if (!component || seen.has(component)) continue;
    seen.add(component);
    components.push({
      component,
      props:
        item.props && typeof item.props === 'object' ? item.props : undefined,
      html: String(item.html || ''),
      css: String(item.css || ''),
      js: String(item.js || ''),
    });
  }
  return components;
}

export function normalizeFeatures(
  raw?: Array<{ id?: string; props?: Record<string, string | number | boolean> }> | null,
): LandingFeature[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const features: LandingFeature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = coerceFeatureId(asText(item.id));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    features.push({
      id,
      props:
        item.props && typeof item.props === 'object' ? item.props : undefined,
    });
  }
  return features;
}

export function normalizeCopywriterOverride(
  raw?: CopywriterBriefOverride | null,
): CopywriterBriefOverride | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const category = asText(raw.category).slice(0, 120);
  const description = String(raw.description || '').trim().slice(0, MAX_COPY);
  const address = asText(raw.address).slice(0, 240);
  const notes = String(raw.notes || '').trim().slice(0, MAX_COPY);
  const services = Array.isArray(raw.services)
    ? raw.services
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 30)
        .map((item) => item.slice(0, 80))
    : String(raw.services || '')
        .split(/[|,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30)
        .map((item) => item.slice(0, 80));
  const next: CopywriterBriefOverride = {};
  if (category) next.category = category;
  if (description) next.description = description;
  if (services.length) next.services = services;
  if (address) next.address = address;
  if (notes) next.notes = notes;
  return Object.keys(next).length ? next : undefined;
}

export function normalizeThemeOverride(raw?: ThemePayload | null): ThemePayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const colors = normalizeThemeColors(raw.colors);
  if (!colors) return undefined;
  return {
    colors,
    intensity: parseColorIntensity(raw.intensity),
  };
}

export function normalizeGenerateConfig(raw?: {
  sections?: Array<Partial<LandingSectionConfig>> | null;
  components?: SelectedUiComponent[] | null;
  features?: Array<{ id?: string; props?: Record<string, string | number | boolean> }> | null;
  copywriter?: CopywriterBriefOverride | null;
  theme?: ThemePayload | null;
} | null): LandingGenerateConfig {
  const copywriter = normalizeCopywriterOverride(raw?.copywriter);
  const theme = normalizeThemeOverride(raw?.theme);
  return {
    sections: normalizeSectionConfigs(raw?.sections),
    components: normalizeUiComponents(raw?.components),
    features: normalizeFeatures(raw?.features),
    ...(copywriter ? { copywriter } : {}),
    ...(theme ? { theme } : {}),
  };
}
