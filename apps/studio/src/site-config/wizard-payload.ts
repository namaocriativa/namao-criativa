import {
  defaultThemePayload,
  MAP_FEATURE_ID,
  normalizeThemeColors,
  parseColorIntensity,
  resolveMapSectionId,
  type ThemePayload,
} from "@namao/landing-kit";
import {
  defaultProps,
  listComponents,
  renderSpec,
  resolveProps,
} from "../ui-lib";
import type { ComponentProps } from "../ui-lib/types";
import {
  defaultSectionConfigs,
  type LandingSectionConfig,
} from "./section-catalog";

const PLAYGROUND_KEY = "uiLibState";

export type OverlayPayload = {
  component: string;
  props: ComponentProps;
  html: string;
  css: string;
  js: string;
};

export type FeaturePayload = {
  id: string;
  props?: Record<string, string | number | boolean>;
};

export type CopywriterPayload = {
  category?: string;
  description?: string;
  services?: string[];
  address?: string;
  notes?: string;
};

export type GeneratePayload = {
  sections: LandingSectionConfig[];
  components: OverlayPayload[];
  features: FeaturePayload[];
  copywriter?: CopywriterPayload;
  theme?: ThemePayload;
};

export type VariantLocks = Record<string, string | null>;

export type StockVideoFlags = Record<string, boolean>;

function playgroundProps(id: string): ComponentProps | undefined {
  try {
    const raw = localStorage.getItem(PLAYGROUND_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const entry = (parsed as Record<string, { props?: ComponentProps }>)[id];
    return entry?.props;
  } catch {
    return undefined;
  }
}

export function overlayPayloads(selectedIds: string[]): OverlayPayload[] {
  const picked = new Set(selectedIds);
  return listComponents()
    .filter((definition) => picked.has(definition.id))
    .map((definition) => {
      const props = resolveProps(
        definition,
        playgroundProps(definition.id) || defaultProps(definition),
      );
      const code = renderSpec({ component: definition.id, props });
      return {
        component: definition.id,
        props,
        html: code.html,
        css: code.css,
        js: code.js,
      };
    });
}

export function compactSectionMedia(
  media?: LandingSectionConfig["media"] | null,
): LandingSectionConfig["media"] | undefined {
  if (!media) return undefined;
  const images = [...new Set(media.images || [])].filter(Boolean);
  const next: NonNullable<LandingSectionConfig["media"]> = {};
  if (images.length) next.images = images;
  if (media.logo) next.logo = media.logo;
  if (media.video) next.video = media.video;
  if (media.portraitVideo) next.portraitVideo = media.portraitVideo;
  return Object.keys(next).length ? next : undefined;
}

export function compactCopywriter(input: CopywriterPayload): CopywriterPayload | undefined {
  const services = (input.services || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
  const next: CopywriterPayload = {};
  const category = input.category?.trim();
  const description = input.description?.trim();
  const address = input.address?.trim();
  const notes = input.notes?.trim();
  if (category) next.category = category;
  if (description) next.description = description;
  if (services.length) next.services = services;
  if (address) next.address = address;
  if (notes) next.notes = notes;
  return Object.keys(next).length ? next : undefined;
}

export function compactTheme(input: ThemePayload | null | undefined): ThemePayload {
  const colors = normalizeThemeColors(input?.colors) || defaultThemePayload().colors;
  return {
    colors,
    intensity: parseColorIntensity(input?.intensity),
  };
}

export function toGeneratePayload(
  sections: LandingSectionConfig[],
  locks: VariantLocks,
  overlayIds: string[],
  featureIds: string[] = [],
  stockVideoBySection: StockVideoFlags = {},
  copywriter: CopywriterPayload = {},
  theme: ThemePayload = defaultThemePayload(),
  mapSectionId?: string | null,
): GeneratePayload {
  const copy = compactCopywriter(copywriter);
  const resolvedMapSection = featureIds.includes(MAP_FEATURE_ID)
    ? resolveMapSectionId(sections, mapSectionId)
    : null;
  return {
    sections: sections.map((section) => {
      const locked = locks[section.id];
      const stockVideo =
        section.type === "hero" && Boolean(stockVideoBySection[section.id]);
      const media = compactSectionMedia(section.media);
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        description: section.description,
        ...(locked ? { component: locked } : {}),
        ...(stockVideo ? { stockVideo: true } : {}),
        ...(media ? { media } : {}),
      };
    }),
    components: overlayPayloads(overlayIds),
    features: featureIds.map((id) =>
      id === MAP_FEATURE_ID && resolvedMapSection
        ? { id, props: { sectionId: resolvedMapSection } }
        : { id },
    ),
    ...(copy ? { copywriter: copy } : {}),
    theme: compactTheme(theme),
  };
}

export function defaultGeneratePayload(): GeneratePayload {
  return toGeneratePayload(defaultSectionConfigs(), {}, [], []);
}

type WizardHydrateState = {
  sections: LandingSectionConfig[];
  locks: VariantLocks;
  overlays: string[];
  features: string[];
  mapSectionId: string | null;
  copywriter: CopywriterPayload;
  stockVideoBySection: StockVideoFlags;
  theme: ThemePayload | null;
};

function asSection(raw: unknown): LandingSectionConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = String(item.id || "").trim();
  const type = String(item.type || "").trim();
  const title = String(item.title || "").trim();
  if (!id || !type || !title) return null;
  const component = String(item.component || "").trim();
  const media = compactSectionMedia(
    item.media && typeof item.media === "object"
      ? (item.media as LandingSectionConfig["media"])
      : undefined,
  );
  return {
    id,
    type,
    title,
    description: String(item.description || title).trim() || title,
    ...(component ? { component } : {}),
    ...(type === "hero" && item.stockVideo ? { stockVideo: true } : {}),
    ...(media ? { media } : {}),
  };
}

export function wizardStateFromConfig(raw: unknown): WizardHydrateState | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const sections = Array.isArray(record.sections)
    ? record.sections.map(asSection).filter((item): item is LandingSectionConfig => Boolean(item))
    : [];
  if (!sections.length) return null;

  const locks: VariantLocks = {};
  const stockVideoBySection: StockVideoFlags = {};
  for (const section of sections) {
    if (section.component) locks[section.id] = section.component;
    if (section.stockVideo) stockVideoBySection[section.id] = true;
  }

  const overlays = Array.isArray(record.components)
    ? [
        ...new Set(
          record.components
            .map((item) =>
              item && typeof item === "object"
                ? String((item as { component?: unknown }).component || "").trim()
                : "",
            )
            .filter(Boolean),
        ),
      ]
    : [];

  const features: string[] = [];
  let mapSectionId: string | null = null;
  if (Array.isArray(record.features)) {
    for (const item of record.features) {
      if (!item || typeof item !== "object") continue;
      const id = String((item as { id?: unknown }).id || "").trim();
      if (!id || features.includes(id)) continue;
      features.push(id);
      if (id !== MAP_FEATURE_ID) continue;
      const props = (item as { props?: Record<string, unknown> }).props;
      const fromProps =
        props && typeof props === "object"
          ? String(props.sectionId || "").trim()
          : "";
      if (fromProps) mapSectionId = fromProps;
    }
  }

  const copy =
    record.copywriter && typeof record.copywriter === "object"
      ? compactCopywriter(record.copywriter as CopywriterPayload)
      : undefined;

  const colors = normalizeThemeColors(
    record.theme && typeof record.theme === "object"
      ? (record.theme as { colors?: unknown }).colors
      : null,
  );

  return {
    sections,
    locks,
    overlays,
    features,
    mapSectionId: resolveMapSectionId(sections, mapSectionId),
    copywriter: copy || {},
    stockVideoBySection,
    theme: colors
      ? compactTheme({
          colors,
          intensity: parseColorIntensity(
            record.theme && typeof record.theme === "object"
              ? (record.theme as { intensity?: unknown }).intensity
              : undefined,
          ),
        })
      : null,
  };
}
