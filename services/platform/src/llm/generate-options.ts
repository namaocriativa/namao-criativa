import type { LlmRole } from './llm.types';

export type GenerateOptions = {
  temperature?: number;
  formatJson?: boolean;
  model?: string;
  images?: string[];
  imageMimeTypes?: string[];
  role?: LlmRole;
  keepAlive?: number | string;
  onChunk?: (piece: string, full: string) => void;
  signal?: AbortSignal;
};
