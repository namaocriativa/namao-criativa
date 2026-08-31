import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { buildJsonRepairPrompt } from './pipeline-prompts';

export type OllamaRole = 'plan' | 'code' | 'vision' | 'chat';

export type GenerateOptions = {
  temperature?: number;
  formatJson?: boolean;
  model?: string;
  images?: string[];
  /** MIME types parallel to `images` (used by Gemini; ignored by Ollama). */
  imageMimeTypes?: string[];
  /** Pipeline role — used by LlmService to pick the provider. */
  role?: OllamaRole;
  /** Ollama keep_alive; use 0 to unload after the request (saves RAM). */
  keepAlive?: number | string;
  onChunk?: (piece: string, full: string) => void;
  signal?: AbortSignal;
};

const DEFAULTS: Record<OllamaRole, string> = {
  plan: 'llama3.1:8b',
  code: 'qwen2.5-coder:7b',
  vision: 'llava:7b',
  chat: 'llama3.1:8b',
};

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  constructor(private readonly config: ConfigService) {}

  get baseUrl(): string {
    return (
      this.config.get<string>('OLLAMA_URL')?.replace(/\/$/, '') ||
      'http://localhost:11434'
    );
  }

  /** @deprecated prefer modelFor('code') — kept for status compatibility */
  get model(): string {
    return this.modelFor('code');
  }

  modelFor(role: OllamaRole): string {
    const envKey =
      role === 'plan'
        ? 'OLLAMA_MODEL_PLAN'
        : role === 'vision'
          ? 'OLLAMA_MODEL_VISION'
          : role === 'chat'
            ? 'OLLAMA_MODEL_CHAT'
            : 'OLLAMA_MODEL_CODE';
    const specific = this.config.get<string>(envKey)?.trim();
    if (specific) return specific;
    if (role === 'chat') return this.modelFor('plan');
    if (role === 'code') {
      return (
        this.config.get<string>('OLLAMA_MODEL')?.trim() || DEFAULTS.code
      );
    }
    return DEFAULTS[role];
  }

  roles(): Record<OllamaRole, string> {
    return {
      plan: this.modelFor('plan'),
      code: this.modelFor('code'),
      vision: this.modelFor('vision'),
      chat: this.modelFor('chat'),
    };
  }

  async status() {
    const roles = this.roles();
    try {
      const res = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      const models = Array.isArray(res.data?.models)
        ? res.data.models.map((m: { name?: string }) => m.name).filter(Boolean)
        : [];
      const available = (wanted: string) =>
        models.some(
          (name: string) => name === wanted || name.startsWith(`${wanted}:`),
        );
      const roleAvailability = {
        plan: available(roles.plan),
        code: available(roles.code),
        vision: available(roles.vision),
      };
      const modelAvailable =
        roleAvailability.plan &&
        roleAvailability.code &&
        roleAvailability.vision;
      const missing = (Object.keys(roles) as OllamaRole[])
        .filter((role) => !roleAvailability[role])
        .map((role) => roles[role]);

      return {
        ok: true,
        url: this.baseUrl,
        model: roles.code,
        models,
        modelAvailable,
        roles,
        roleAvailability,
        missing,
      };
    } catch (error) {
      this.logger.warn(
        `Ollama unreachable at ${this.baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        ok: false,
        url: this.baseUrl,
        model: roles.code,
        models: [] as string[],
        modelAvailable: false,
        roles,
        roleAvailability: { plan: false, code: false, vision: false },
        missing: Object.values(roles),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async generate(
    prompt: string,
    onChunkOrOptions?: ((piece: string, full: string) => void) | GenerateOptions,
  ): Promise<string> {
    const options: GenerateOptions =
      typeof onChunkOrOptions === 'function'
        ? { onChunk: onChunkOrOptions }
        : onChunkOrOptions || {};
    return this.generateRaw(prompt, options);
  }

  async generateJson<T>(
    prompt: string,
    validate: (value: unknown) => T,
    options: GenerateOptions & { expectedShape?: string } = {},
  ): Promise<T> {
    const raw = await this.generateRaw(prompt, {
      ...options,
      formatJson: true,
    });
    try {
      return validate(parseJsonValue(raw));
    } catch (firstError) {
      this.logger.warn(
        `JSON inválido, tentando reparo: ${
          firstError instanceof Error ? firstError.message : String(firstError)
        }`,
      );
      const repaired = await this.generateRaw(
        buildJsonRepairPrompt(raw, options.expectedShape || 'objeto JSON'),
        {
          temperature: 0,
          formatJson: true,
          model: options.model,
          keepAlive: options.keepAlive,
        },
      );
      return validate(parseJsonValue(repaired));
    }
  }

  /**
   * Vision generate (llava): prompt + local image file paths as base64.
   * Unloads the vision model afterwards when keepAlive is 0 (default).
   */
  async generateVisionJson<T>(
    prompt: string,
    imagePaths: string[],
    validate: (value: unknown) => T,
    options: GenerateOptions & { expectedShape?: string } = {},
  ): Promise<T> {
    const images: string[] = [];
    for (const filePath of imagePaths.slice(0, 3)) {
      try {
        const buf = await readFile(filePath);
        if (buf.byteLength > 4 * 1024 * 1024) {
          this.logger.warn(`Skip vision image (too large): ${filePath}`);
          continue;
        }
        images.push(buf.toString('base64'));
      } catch (error) {
        this.logger.warn(
          `Skip vision image ${filePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (!images.length) {
      throw new Error('Nenhuma imagem legível para visão');
    }

    return this.generateJson(prompt, validate, {
      ...options,
      model: options.model || this.modelFor('vision'),
      images,
      keepAlive: options.keepAlive ?? 0,
      formatJson: true,
    });
  }

  /** Force-unload a model from VRAM/RAM. */
  async unload(model: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/api/generate`,
        { model, keep_alive: 0, prompt: '' },
        { timeout: 30_000 },
      );
    } catch (error) {
      this.logger.debug(
        `Unload ${model}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async *generateStream(
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncGenerator<string> {
    const response = await this.startGenerate(prompt, options);
    let buffer = '';
    for await (const chunk of response.data as AsyncIterable<Buffer>) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as {
            response?: string;
            done?: boolean;
            error?: string;
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.response) yield parsed.response;
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
    }
  }

  private async generateRaw(
    prompt: string,
    options: GenerateOptions,
  ): Promise<string> {
    let full = '';
    for await (const piece of this.generateStream(prompt, options)) {
      full += piece;
      options.onChunk?.(piece, full);
    }
    return full;
  }

  private async startGenerate(prompt: string, options: GenerateOptions) {
    const model = options.model || this.modelFor('code');
    const body: Record<string, unknown> = {
      model,
      prompt,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.2,
        ...(options.role === 'chat' ? { num_predict: 800 } : {}),
      },
    };
    if (options.formatJson) {
      body.format = 'json';
    }
    if (options.images?.length) {
      body.images = options.images;
    }
    if (options.keepAlive !== undefined) {
      body.keep_alive = options.keepAlive;
    }

    return axios.post(`${this.baseUrl}/api/generate`, body, {
      responseType: 'stream',
      timeout: 0,
      signal: options.signal,
    });
  }
}

export function parseJsonValue(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenceMatch = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const m of [...fenceMatch].reverse()) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      // try next
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('Não foi possível extrair JSON da resposta do Ollama');
}
