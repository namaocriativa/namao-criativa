import type { VideoProjectSettings } from './video-models';

export type VideoInlineImage = {
  mimeType: string;
  data: string;
};

export type VideoGenerateRequest = {
  model: string;
  prompt: string;
  frames: VideoInlineImage[];
  previousInteractionId?: string;
  settings: VideoProjectSettings;
  signal?: AbortSignal;
};

export type GeneratedVideoBytes = {
  mimeType: string;
  buffer: Buffer;
};

export type VideoGenerateResult = {
  interactionId?: string;
  text: string;
  thoughts: string;
  videos: GeneratedVideoBytes[];
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  } | null;
};

export interface VideoProvider {
  readonly id: string;
  generate(input: VideoGenerateRequest): Promise<VideoGenerateResult>;
}
