export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
export const VIDEO_DURATIONS = ['4s', '5s', '8s', '10s'] as const;
export const VIDEO_VEO_DURATIONS = ['4s', '6s', '8s'] as const;
export const VIDEO_RESOLUTIONS = ['360p', '720p', '1080p', '4k'] as const;
export const VIDEO_THINKING_LEVELS = [
  'minimal',
  'low',
  'medium',
  'high',
] as const;

export const VIDEO_USD_BRL = 5.4;

export type VideoProviderId = 'gemini';
export type VideoGenerationApi = 'interactions' | 'predictLongRunning';
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
export type VideoThinkingLevel = (typeof VIDEO_THINKING_LEVELS)[number];

export type VideoModelCapabilities = {
  aspectRatios: readonly string[];
  durations: readonly string[];
  resolutions: readonly string[];
  thinkingLevels: readonly string[];
  maxFrames: number;
};

export type VideoModelPricing = {
  currency: 'USD';
  videoUsdPerSecond: Record<string, number>;
};

export type VideoModelDefinition = {
  id: string;
  label: string;
  description: string;
  provider: VideoProviderId;
  generationApi: VideoGenerationApi;
  default?: boolean;
  capabilities: VideoModelCapabilities;
  pricing: VideoModelPricing;
};

export type VideoProjectSettings = {
  model: string;
  aspectRatio: string;
  duration: string;
  resolution: string;
  thinkingLevel: string;
};

export type VideoCostEstimate = {
  usdPerSecond: number;
  usdTotal: number;
  seconds: number;
  resolution: string;
  thinkingMayAddTextTokens: boolean;
};

const OMNI_FLASH_PRICING: VideoModelPricing = {
  currency: 'USD',
  videoUsdPerSecond: {
    '360p': 0.03,
    '720p': 0.1,
    '1080p': 0.15,
    '4k': 0.3,
  },
};

const VEO_LITE_PRICING: VideoModelPricing = {
  currency: 'USD',
  videoUsdPerSecond: {
    '720p': 0.05,
    '1080p': 0.08,
  },
};

const VEO_FAST_PRICING: VideoModelPricing = {
  currency: 'USD',
  videoUsdPerSecond: {
    '720p': 0.1,
    '1080p': 0.12,
    '4k': 0.3,
  },
};

const VEO_STANDARD_PRICING: VideoModelPricing = {
  currency: 'USD',
  videoUsdPerSecond: {
    '720p': 0.4,
    '1080p': 0.4,
    '4k': 0.6,
  },
};

const VEO_SHARED_CAPABILITIES = {
  aspectRatios: VIDEO_ASPECT_RATIOS,
  durations: VIDEO_VEO_DURATIONS,
  thinkingLevels: [] as const,
  maxFrames: 2,
};

export const VIDEO_MODELS: VideoModelDefinition[] = [
  {
    id: 'gemini-omni-1.1-flash',
    label: 'Gemini Omni 1.1 Flash',
    description:
      'Padrão do studio: start/end frames, áudio nativo e 360p barato (~US$ 0,03/s).',
    provider: 'gemini',
    generationApi: 'interactions',
    default: true,
    capabilities: {
      aspectRatios: VIDEO_ASPECT_RATIOS,
      durations: VIDEO_DURATIONS,
      resolutions: VIDEO_RESOLUTIONS,
      thinkingLevels: VIDEO_THINKING_LEVELS,
      maxFrames: 2,
    },
    pricing: OMNI_FLASH_PRICING,
  },
  {
    id: 'veo-3.1-lite-generate-preview',
    label: 'Veo 3.1 Lite',
    description:
      'Veo mais barato, 720p/1080p, 4–8s, áudio nativo. ~US$ 0,05/s em 720p.',
    provider: 'gemini',
    generationApi: 'predictLongRunning',
    capabilities: {
      ...VEO_SHARED_CAPABILITIES,
      resolutions: ['720p', '1080p'],
    },
    pricing: VEO_LITE_PRICING,
  },
  {
    id: 'veo-3.1-fast-generate-preview',
    label: 'Veo 3.1 Fast',
    description:
      'Veo rápido com 720p a 4k. ~US$ 0,10/s em 720p; 4k só em 8s.',
    provider: 'gemini',
    generationApi: 'predictLongRunning',
    capabilities: {
      ...VEO_SHARED_CAPABILITIES,
      resolutions: ['720p', '1080p', '4k'],
    },
    pricing: VEO_FAST_PRICING,
  },
  {
    id: 'veo-3.1-generate-preview',
    label: 'Veo 3.1',
    description:
      'Veo de qualidade máxima. ~US$ 0,40/s em 720p/1080p; 4k ~US$ 0,60/s.',
    provider: 'gemini',
    generationApi: 'predictLongRunning',
    capabilities: {
      ...VEO_SHARED_CAPABILITIES,
      resolutions: ['720p', '1080p', '4k'],
    },
    pricing: VEO_STANDARD_PRICING,
  },
];

export function defaultVideoModel(): VideoModelDefinition {
  return VIDEO_MODELS.find((model) => model.default) || VIDEO_MODELS[0];
}

export function findVideoModel(id: string): VideoModelDefinition | undefined {
  const normalized = id.replace(/^models\//, '').trim();
  return VIDEO_MODELS.find((model) => model.id === normalized);
}

export function isVeoVideoModel(id: string): boolean {
  const model = findVideoModel(id);
  if (model) return model.generationApi === 'predictLongRunning';
  return id.replace(/^models\//, '').trim().startsWith('veo-');
}

export function defaultVideoProjectSettings(): VideoProjectSettings {
  const model = defaultVideoModel();
  return {
    model: model.id,
    aspectRatio: '16:9',
    duration: '8s',
    resolution: '360p',
    thinkingLevel: 'low',
  };
}

export function durationSeconds(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)s$/i.exec(duration.trim());
  if (!match) return 0;
  return Number(match[1]) || 0;
}

export function estimateVideoCost(
  settings: Pick<VideoProjectSettings, 'model' | 'duration' | 'resolution' | 'thinkingLevel'>,
): VideoCostEstimate {
  const model = findVideoModel(settings.model) || defaultVideoModel();
  const seconds = durationSeconds(settings.duration);
  const usdPerSecond =
    model.pricing.videoUsdPerSecond[settings.resolution] ??
    model.pricing.videoUsdPerSecond['720p'] ??
    model.pricing.videoUsdPerSecond['360p'] ??
    0;
  return {
    usdPerSecond,
    usdTotal: Math.round(usdPerSecond * seconds * 100) / 100,
    seconds,
    resolution: settings.resolution,
    thinkingMayAddTextTokens: settings.thinkingLevel === 'high',
  };
}

export function listVideoModelsPayload() {
  return {
    defaultModelId: defaultVideoModel().id,
    usdBrl: VIDEO_USD_BRL,
    models: VIDEO_MODELS,
  };
}

const SETTINGS_KEYS = [
  'model',
  'aspectRatio',
  'duration',
  'resolution',
  'thinkingLevel',
] as const;

export function definedVideoSettings(
  input?: Partial<VideoProjectSettings> | null,
): Partial<VideoProjectSettings> {
  const next: Partial<VideoProjectSettings> = {};
  if (!input) return next;
  for (const key of SETTINGS_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      next[key] = value.trim();
    }
  }
  return next;
}

/** Last layer wins. Empty fields fall through to studio defaults. */
export function mergeVideoProjectSettings(
  ...layers: Array<Partial<VideoProjectSettings> | null | undefined>
): VideoProjectSettings {
  return normalizeVideoProjectSettings({
    ...defaultVideoProjectSettings(),
    ...layers.reduce(
      (acc, layer) => ({ ...acc, ...definedVideoSettings(layer) }),
      {} as Partial<VideoProjectSettings>,
    ),
  });
}

export function normalizeVideoProjectSettings(
  raw: unknown,
  fallback: VideoProjectSettings = defaultVideoProjectSettings(),
): VideoProjectSettings {
  const input =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const requestedModel =
    typeof input.model === 'string' ? input.model.trim() : fallback.model;
  const model = findVideoModel(requestedModel) || findVideoModel(fallback.model);
  if (!model) {
    return fallback;
  }

  const duration = normalizeDuration(
    typeof input.duration === 'string' ? input.duration : fallback.duration,
    model.capabilities.durations,
    fallback.duration,
  );
  const resolution = pickAllowed(
    typeof input.resolution === 'string'
      ? input.resolution
      : fallback.resolution,
    model.capabilities.resolutions,
    fallback.resolution,
  );
  const clamped =
    model.generationApi === 'predictLongRunning'
      ? clampHighResDuration({ duration, resolution }, model.capabilities)
      : { duration, resolution };

  return {
    model: model.id,
    aspectRatio: pickAllowed(
      typeof input.aspectRatio === 'string'
        ? input.aspectRatio
        : fallback.aspectRatio,
      model.capabilities.aspectRatios,
      fallback.aspectRatio,
    ),
    duration: clamped.duration,
    resolution: clamped.resolution,
    thinkingLevel: pickAllowed(
      typeof input.thinkingLevel === 'string'
        ? input.thinkingLevel
        : fallback.thinkingLevel,
      model.capabilities.thinkingLevels,
      fallback.thinkingLevel,
    ),
  };
}

/** 1080p/4k no Veo só aceitam 8s. Se a duração for outra, cai para 720p. */
export function clampHighResDuration(
  settings: { duration: string; resolution: string },
  capabilities: Pick<VideoModelCapabilities, 'durations' | 'resolutions'>,
): { duration: string; resolution: string } {
  const highRes =
    settings.resolution === '1080p' || settings.resolution === '4k';
  if (!highRes || settings.duration === '8s') return settings;
  if (capabilities.resolutions.includes('720p')) {
    return { duration: settings.duration, resolution: '720p' };
  }
  if (capabilities.durations.includes('8s')) {
    return { duration: '8s', resolution: settings.resolution };
  }
  return settings;
}

function normalizeDuration(
  value: string,
  allowed: readonly string[],
  fallback: string,
): string {
  const trimmed = value.trim().toLowerCase();
  const withSuffix = /^\d+$/.test(trimmed) ? `${trimmed}s` : trimmed;
  return pickAllowed(withSuffix, allowed, fallback);
}

function pickAllowed(
  value: string,
  allowed: readonly string[],
  fallback: string,
): string {
  if (allowed.includes(value)) return value;
  if (allowed.includes(fallback)) return fallback;
  return allowed[0] || fallback;
}
