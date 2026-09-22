import type { VideoModelDefinition, VideoProjectSettings } from "./types";

export const VIDEO_RUN_SETTINGS_KEY = "videos-run-settings";
export const VIDEO_RUN_CHANGED = "videos-run-settings-change";
export const VIDEO_USD_BRL = 5.4;

export const DEFAULT_VIDEO_RUN_SETTINGS: VideoProjectSettings = {
  model: "gemini-omni-1.1-flash",
  aspectRatio: "16:9",
  duration: "8s",
  resolution: "360p",
  thinkingLevel: "low",
};

export type VideoRunCatalog = {
  defaultModelId: string;
  usdBrl?: number;
  models: VideoModelDefinition[];
};

export type VideoRunCost = {
  usdPerSecond: number;
  usdTotal: number;
  brlTotal: number;
  seconds: number;
  usdBrl: number;
  resolution: string;
  duration: string;
  thinkingMayAddTextTokens: boolean;
};

const SELECT_IDS = {
  model: "videos-model",
  aspectRatio: "videos-aspect",
  duration: "videos-duration",
  resolution: "videos-resolution",
  thinkingLevel: "videos-thinking",
} as const;

let catalog: VideoRunCatalog | null = null;

export function setVideoRunCatalog(next: VideoRunCatalog | null): void {
  catalog = next;
}

export function getVideoRunCatalog(): VideoRunCatalog | null {
  return catalog;
}

function selectValue(id: string): string {
  if (typeof document === "undefined") return "";
  const el = document.getElementById(id);
  return el instanceof HTMLSelectElement ? el.value.trim() : "";
}

export function loadStoredVideoRunSettings(): Partial<VideoProjectSettings> | null {
  try {
    const raw = localStorage.getItem(VIDEO_RUN_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VideoProjectSettings>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistVideoRunSettings(settings: VideoProjectSettings): void {
  try {
    localStorage.setItem(VIDEO_RUN_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

export function readVideoRunSettings(): VideoProjectSettings {
  const stored = loadStoredVideoRunSettings();
  return {
    model:
      selectValue(SELECT_IDS.model) ||
      stored?.model ||
      catalog?.defaultModelId ||
      DEFAULT_VIDEO_RUN_SETTINGS.model,
    aspectRatio:
      selectValue(SELECT_IDS.aspectRatio) ||
      stored?.aspectRatio ||
      DEFAULT_VIDEO_RUN_SETTINGS.aspectRatio,
    duration:
      selectValue(SELECT_IDS.duration) ||
      stored?.duration ||
      DEFAULT_VIDEO_RUN_SETTINGS.duration,
    resolution:
      selectValue(SELECT_IDS.resolution) ||
      stored?.resolution ||
      DEFAULT_VIDEO_RUN_SETTINGS.resolution,
    thinkingLevel:
      selectValue(SELECT_IDS.thinkingLevel) ||
      stored?.thinkingLevel ||
      DEFAULT_VIDEO_RUN_SETTINGS.thinkingLevel,
  };
}

export function videoRunSettingsPayload(
  settings: VideoProjectSettings = readVideoRunSettings(),
): VideoProjectSettings {
  return {
    model: settings.model,
    aspectRatio: settings.aspectRatio,
    duration: settings.duration,
    resolution: settings.resolution,
    thinkingLevel: settings.thinkingLevel,
  };
}

export function appendVideoRunSettings(
  body: FormData,
  settings: VideoProjectSettings = readVideoRunSettings(),
): void {
  const payload = videoRunSettingsPayload(settings);
  body.append("model", payload.model);
  body.append("aspectRatio", payload.aspectRatio);
  body.append("duration", payload.duration);
  body.append("resolution", payload.resolution);
  body.append("thinkingLevel", payload.thinkingLevel);
}

export function subscribeVideoRunSettings(listener: () => void): () => void {
  window.addEventListener(VIDEO_RUN_CHANGED, listener);
  return () => window.removeEventListener(VIDEO_RUN_CHANGED, listener);
}

export function notifyVideoRunSettings(): void {
  window.dispatchEvent(new Event(VIDEO_RUN_CHANGED));
}

export function durationSeconds(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)s$/i.exec(duration.trim());
  return match ? Number(match[1]) || 0 : 0;
}

export function estimateVideoRunCost(
  settings: VideoProjectSettings,
  source: VideoRunCatalog | null = catalog,
): VideoRunCost {
  const models = source?.models || [];
  const model =
    models.find((item) => item.id === settings.model) || models[0];
  const seconds = durationSeconds(settings.duration);
  const usdPerSecond =
    model?.pricing?.videoUsdPerSecond?.[settings.resolution] ??
    model?.pricing?.videoUsdPerSecond?.["720p"] ??
    model?.pricing?.videoUsdPerSecond?.["360p"] ??
    0;
  const usdBrl = source?.usdBrl || VIDEO_USD_BRL;
  const usdTotal = Math.round(usdPerSecond * seconds * 100) / 100;
  return {
    usdPerSecond,
    usdTotal,
    brlTotal: Math.round(usdTotal * usdBrl * 100) / 100,
    seconds,
    usdBrl,
    resolution: settings.resolution,
    duration: settings.duration,
    thinkingMayAddTextTokens: settings.thinkingLevel === "high",
  };
}

function money(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function formatVideoCost(cost: VideoRunCost): string {
  return `${cost.resolution} · ~US$ ${money(cost.usdPerSecond)}/s · ${cost.duration} ≈ US$ ${money(cost.usdTotal)} (~R$ ${money(cost.brlTotal)})`;
}

export function videoCostNote(cost: VideoRunCost): string {
  return cost.thinkingMayAddTextTokens
    ? "Estimativa do vídeo. Thinking high pode somar tokens de texto."
    : "Estimativa do vídeo gerado. Sem taxa de retry.";
}
