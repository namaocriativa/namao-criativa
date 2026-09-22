import type { ImageProjectSettings } from './image-models';

export type ImageInlineInput = {
  mimeType: string;
  data: string;
};

export type ImageHistoryTurn = {
  role: 'user' | 'model';
  text?: string;
  images?: ImageInlineInput[];
};

export type ImageGenerateRequest = {
  model: string;
  prompt: string;
  history: ImageHistoryTurn[];
  referenceImages: ImageInlineInput[];
  settings: ImageProjectSettings;
  signal?: AbortSignal;
};

export type GeneratedImageBytes = {
  mimeType: string;
  buffer: Buffer;
};

export type ImageGenerateResult = {
  text: string;
  thoughts: string;
  images: GeneratedImageBytes[];
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  } | null;
};

export interface ImageProvider {
  readonly id: string;
  generate(input: ImageGenerateRequest): Promise<ImageGenerateResult>;
}
