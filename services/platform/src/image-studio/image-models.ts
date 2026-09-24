export const IMAGE_ASPECT_RATIOS = [
  '1:1',
  '3:2',
  '2:3',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

export const IMAGE_PERSON_GENERATIONS = [
  'ALLOW_ADULT',
  'ALLOW_ALL',
  'ALLOW_NONE',
] as const;

export const IMAGE_THINKING_LEVELS = ['minimal', 'high'] as const;

export type ImageProviderId = 'gemini';
export type ImagePersonGeneration = (typeof IMAGE_PERSON_GENERATIONS)[number];
export type ImageThinkingLevel = (typeof IMAGE_THINKING_LEVELS)[number];

export type ImageModelCapabilities = {
  aspectRatios: readonly string[];
  resolutions: readonly string[];
  personGenerations: readonly string[];
  thinkingLevels: readonly string[];
  googleSearch: boolean;
  imageSearch: boolean;
  systemInstruction: boolean;
  thinking: boolean;
  maxReferences: number;
};

export type ImageModelDefinition = {
  id: string;
  label: string;
  description: string;
  provider: ImageProviderId;
  default?: boolean;
  capabilities: ImageModelCapabilities;
};

export type ImageSkillRunPackage = {
  id: string;
  name: string;
  price?: number | null;
  promoPrice?: number | null;
  currency?: string | null;
};

export type ImageSkillRun = {
  leadId?: string;
  leadLabel?: string;
  packageIds?: string[];
  packages?: ImageSkillRunPackage[];
  notes?: string;
  prompt?: string;
  slideCount?: number;
  completedSlides?: number;
  error?: string;
  spec?: unknown;
};

export type ImageProjectSettings = {
  model: string;
  temperature: number;
  aspectRatio: string;
  imageSize: string;
  systemInstruction: string;
  googleSearch: boolean;
  imageSearch: boolean;
  personGeneration: string;
  thinkingLevel: string;
  includeThoughts: boolean;
  featureId?: string;
  skillRun?: ImageSkillRun;
};

const IMAGE_SETTING_KEYS = [
  'model',
  'temperature',
  'aspectRatio',
  'imageSize',
  'systemInstruction',
  'googleSearch',
  'imageSearch',
  'personGeneration',
  'thinkingLevel',
  'includeThoughts',
  'skillRun',
] as const;

export function imageSettingsPatch(source: object): Partial<ImageProjectSettings> {
  const input = source as Record<string, unknown>;
  const patch: Partial<ImageProjectSettings> = {};
  for (const key of IMAGE_SETTING_KEYS) {
    if (input[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = input[key];
    }
  }
  return patch;
}

const FLASH_ASPECT_RATIOS = IMAGE_ASPECT_RATIOS;
const FLASH_31_ASPECT_RATIOS = [
  ...IMAGE_ASPECT_RATIOS,
  '1:4',
  '4:1',
  '1:8',
  '8:1',
] as const;

export const IMAGE_MODELS: ImageModelDefinition[] = [
  {
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    description: 'State-of-the-art image generation and editing',
    provider: 'gemini',
    default: true,
    capabilities: {
      aspectRatios: FLASH_ASPECT_RATIOS,
      resolutions: ['1K', '2K', '4K'],
      personGenerations: [],
      thinkingLevels: [],
      googleSearch: true,
      imageSearch: false,
      systemInstruction: true,
      thinking: true,
      maxReferences: 14,
    },
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    description: 'Versatile 4K generation with speed and world knowledge',
    provider: 'gemini',
    capabilities: {
      aspectRatios: FLASH_31_ASPECT_RATIOS,
      resolutions: ['0.5K', '1K', '2K', '4K'],
      personGenerations: [],
      thinkingLevels: IMAGE_THINKING_LEVELS,
      googleSearch: true,
      imageSearch: true,
      systemInstruction: true,
      thinking: true,
      maxReferences: 14,
    },
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite',
    description: 'Fastest and cheapest Gemini image model',
    provider: 'gemini',
    capabilities: {
      aspectRatios: FLASH_ASPECT_RATIOS,
      resolutions: ['1K'],
      personGenerations: [],
      thinkingLevels: [],
      googleSearch: false,
      imageSearch: false,
      systemInstruction: true,
      thinking: true,
      maxReferences: 14,
    },
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    description: 'Legacy Gemini image model',
    provider: 'gemini',
    capabilities: {
      aspectRatios: FLASH_ASPECT_RATIOS,
      resolutions: ['1K'],
      personGenerations: [],
      thinkingLevels: [],
      googleSearch: false,
      imageSearch: false,
      systemInstruction: true,
      thinking: false,
      maxReferences: 3,
    },
  },
];

export function defaultImageModel(): ImageModelDefinition {
  return IMAGE_MODELS.find((model) => model.default) || IMAGE_MODELS[0];
}

export function findImageModel(id: string): ImageModelDefinition | undefined {
  const normalized = id.replace(/^models\//, '').trim();
  return IMAGE_MODELS.find((model) => model.id === normalized);
}

export function defaultImageProjectSettings(): ImageProjectSettings {
  const model = defaultImageModel();
  return {
    model: model.id,
    temperature: 1,
    aspectRatio: '1:1',
    imageSize: preferredResolution(model),
    systemInstruction: '',
    googleSearch: false,
    imageSearch: false,
    personGeneration: 'ALLOW_ADULT',
    thinkingLevel: preferredThinkingLevel(model),
    includeThoughts: model.capabilities.thinking,
  };
}

export function listImageModelsPayload() {
  return {
    defaultModelId: defaultImageModel().id,
    models: IMAGE_MODELS,
  };
}

export function normalizeImageProjectSettings(
  raw: unknown,
  fallback: ImageProjectSettings = defaultImageProjectSettings(),
): ImageProjectSettings {
  const input =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const requestedModel =
    typeof input.model === 'string' ? input.model.trim() : fallback.model;
  const model = findImageModel(requestedModel) || findImageModel(fallback.model);
  if (!model) {
    return fallback;
  }

  const temperature = clampTemperature(
    typeof input.temperature === 'number'
      ? input.temperature
      : Number(input.temperature),
    fallback.temperature,
  );
  const aspectRatio = pickAllowed(
    typeof input.aspectRatio === 'string' ? input.aspectRatio : fallback.aspectRatio,
    model.capabilities.aspectRatios,
    '1:1',
  );
  const imageSize = pickAllowed(
    typeof input.imageSize === 'string' ? input.imageSize : fallback.imageSize,
    model.capabilities.resolutions,
    preferredResolution(model),
  );
  const systemInstruction =
    typeof input.systemInstruction === 'string'
      ? input.systemInstruction
      : fallback.systemInstruction;
  const googleSearch = model.capabilities.googleSearch
    ? Boolean(
        input.googleSearch === undefined
          ? fallback.googleSearch
          : input.googleSearch,
      )
    : false;
  const imageSearch = model.capabilities.imageSearch
    ? Boolean(
        input.imageSearch === undefined
          ? fallback.imageSearch
          : input.imageSearch,
      )
    : false;
  const personGeneration = pickAllowed(
    typeof input.personGeneration === 'string'
      ? input.personGeneration
      : fallback.personGeneration,
    model.capabilities.personGenerations,
    'ALLOW_ADULT',
  );
  const thinkingLevel = model.capabilities.thinkingLevels.length
    ? pickAllowed(
        typeof input.thinkingLevel === 'string'
          ? input.thinkingLevel
          : fallback.thinkingLevel,
        model.capabilities.thinkingLevels,
        preferredThinkingLevel(model),
      )
    : '';
  const includeThoughts = model.capabilities.thinking
    ? Boolean(
        input.includeThoughts === undefined
          ? fallback.includeThoughts
          : input.includeThoughts,
      )
    : false;

  const featureId = pickFeatureId(input.featureId, fallback.featureId);
  const skillRun = pickSkillRun(input.skillRun, fallback.skillRun);

  return {
    model: model.id,
    temperature,
    aspectRatio,
    imageSize,
    systemInstruction,
    googleSearch,
    imageSearch,
    personGeneration,
    thinkingLevel,
    includeThoughts,
    ...(featureId ? { featureId } : {}),
    ...(skillRun ? { skillRun } : {}),
  };
}

function preferredResolution(model: ImageModelDefinition): string {
  if (model.capabilities.resolutions.includes('1K')) return '1K';
  return model.capabilities.resolutions[0] || '1K';
}

function preferredThinkingLevel(model: ImageModelDefinition): string {
  if (model.capabilities.thinkingLevels.includes('minimal')) return 'minimal';
  return model.capabilities.thinkingLevels[0] || '';
}

function clampTemperature(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(2, Math.max(0, value));
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

function pickFeatureId(value: unknown, fallback?: string): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 80);
  }
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim().slice(0, 80);
  }
  return undefined;
}

function pickSkillRun(
  value: unknown,
  fallback?: ImageSkillRun,
): ImageSkillRun | undefined {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : fallback && typeof fallback === 'object'
        ? (fallback as unknown as Record<string, unknown>)
        : null;
  if (!raw) return undefined;
  const spec =
    raw.spec && typeof raw.spec === 'object' && !Array.isArray(raw.spec)
      ? (raw.spec as Record<string, unknown>)
      : undefined;
  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 4000) : '';
  const prompt =
    typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, 4000) : '';
  const error =
    typeof raw.error === 'string' && raw.error.trim()
      ? raw.error.trim().slice(0, 500)
      : undefined;
  const slideCount =
    typeof raw.slideCount === 'number' && Number.isFinite(raw.slideCount)
      ? raw.slideCount
      : undefined;
  const completedSlides =
    typeof raw.completedSlides === 'number' && Number.isFinite(raw.completedSlides)
      ? raw.completedSlides
      : undefined;
  const leadId = typeof raw.leadId === 'string' ? raw.leadId.trim() : '';
  if (!leadId) {
    if (!spec && !prompt && !fallback) return undefined;
    if (!spec && !prompt) return fallback;
    return {
      notes,
      ...(prompt ? { prompt } : {}),
      ...(slideCount != null ? { slideCount } : {}),
      ...(completedSlides != null ? { completedSlides } : {}),
      ...(error ? { error } : {}),
      ...(spec ? { spec } : {}),
    };
  }
  const packageIds = Array.isArray(raw.packageIds)
    ? raw.packageIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const packages = Array.isArray(raw.packages)
    ? raw.packages.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const pkg = item as Record<string, unknown>;
        const id = typeof pkg.id === 'string' ? pkg.id.trim() : '';
        const name = typeof pkg.name === 'string' ? pkg.name.trim() : '';
        if (!id || !name) return [];
        return [
          {
            id,
            name,
            price: typeof pkg.price === 'number' ? pkg.price : null,
            promoPrice: typeof pkg.promoPrice === 'number' ? pkg.promoPrice : null,
            currency:
              typeof pkg.currency === 'string' ? pkg.currency : null,
          } satisfies ImageSkillRunPackage,
        ];
      })
    : [];
  return {
    leadId,
    leadLabel:
      typeof raw.leadLabel === 'string' && raw.leadLabel.trim()
        ? raw.leadLabel.trim().slice(0, 200)
        : leadId,
    packageIds,
    packages,
    notes,
    ...(spec ? { spec } : {}),
  };
}
