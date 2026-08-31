import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import {
  type GenerateOptions,
  OllamaService,
} from '../landing/ollama.service';
import { GeminiService } from './gemini.service';
import { LlmSettingsService } from './llm-settings.service';
import {
  LLM_ROLES,
  LLM_STAGES,
  type LlmRole,
  type RoleConfig,
  type RoleStatus,
} from './llm.types';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settingsService: LlmSettingsService,
    private readonly ollama: OllamaService,
    private readonly gemini: GeminiService,
  ) {}

  resolve(role: LlmRole): RoleConfig {
    return this.settingsService.get().roles[role];
  }

  modelFor(role: LlmRole): string {
    return this.resolve(role).model;
  }

  providerFor(role: LlmRole) {
    return this.resolve(role).provider;
  }

  async generateJson<T>(
    prompt: string,
    validate: (value: unknown) => T,
    options: GenerateOptions & { expectedShape?: string } = {},
  ): Promise<T> {
    const role = options.role || 'code';
    const resolved = this.resolve(role);
    const model = options.model || resolved.model;
    this.logger.debug(`${role} via ${resolved.provider}:${model}`);
    if (resolved.provider === 'gemini') {
      return this.gemini.generateJson(prompt, validate, { ...options, model });
    }
    return this.ollama.generateJson(prompt, validate, { ...options, model });
  }

  async *generateStream(
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncGenerator<string> {
    const role = options.role || 'chat';
    const resolved = this.resolve(role);
    const model = options.model || resolved.model;
    this.logger.debug(`${role} stream via ${resolved.provider}:${model}`);
    if (resolved.provider === 'gemini') {
      yield* this.gemini.generateStream(prompt, { ...options, model });
      return;
    }
    yield* this.ollama.generateStream(prompt, { ...options, model });
  }

  async generateVisionJson<T>(
    prompt: string,
    imagePaths: string[],
    validate: (value: unknown) => T,
    options: GenerateOptions & { expectedShape?: string } = {},
  ): Promise<T> {
    const { images, mimeTypes } = await readVisionImages(imagePaths, this.logger);
    if (!images.length) {
      throw new Error('Nenhuma imagem legível para visão');
    }
    return this.generateJson(prompt, validate, {
      ...options,
      role: options.role || 'vision',
      model: options.model || this.modelFor('vision'),
      images,
      imageMimeTypes: mimeTypes,
      keepAlive: options.keepAlive ?? 0,
      formatJson: true,
    });
  }

  async unload(roleOrModel: LlmRole | string): Promise<void> {
    if (isLlmRole(roleOrModel)) {
      const resolved = this.resolve(roleOrModel);
      if (resolved.provider === 'ollama') {
        await this.ollama.unload(resolved.model);
      }
      return;
    }
    await this.ollama.unload(roleOrModel);
  }

  async status() {
    const settings = this.settingsService.get();
    const [gemini, ollama] = await Promise.all([
      this.gemini.status(),
      this.ollama.status(),
    ]);

    const roles = {} as Record<LlmRole, RoleStatus>;
    const errors: string[] = [];

    for (const role of LLM_ROLES) {
      const cfg = settings.roles[role];
      if (cfg.provider === 'gemini') {
        const ok = gemini.configured && gemini.ok;
        const error = ok
          ? undefined
          : !gemini.configured
            ? 'GEMINI_API_KEY não configurada no .env'
            : gemini.error || 'Gemini indisponível';
        roles[role] = { ...cfg, ok, error };
        if (!ok) errors.push(`${role}: ${error}`);
      } else {
        const available =
          ollama.ok &&
          ollama.models.some(
            (name: string) =>
              name === cfg.model || name.startsWith(`${cfg.model}:`),
          );
        const error = !ollama.ok
          ? `Ollama indisponível em ${ollama.url}. Suba com docker compose up -d ollama.`
          : available
            ? undefined
            : `modelo ausente: ${cfg.model} — docker exec -it ollama ollama pull ${cfg.model}`;
        roles[role] = { ...cfg, ok: available, error };
        if (!available) errors.push(`${role}: ${error}`);
      }
    }

    return {
      ready: errors.length === 0,
      error: errors.length ? errors.join(' · ') : undefined,
      roles,
      gemini,
      ollama,
    };
  }

  async configPayload() {
    const status = await this.status();
    return {
      ...status,
      settings: this.settingsService.get(),
      stages: LLM_STAGES,
      defaults: {
        ollama: this.ollama.roles(),
        gemini: {
          plan: this.settingsService.defaultModel('gemini', 'plan'),
          code: this.settingsService.defaultModel('gemini', 'code'),
          vision: this.settingsService.defaultModel('gemini', 'vision'),
          chat: this.settingsService.defaultModel('gemini', 'chat'),
        },
      },
    };
  }

  async saveSettings(input: { roles: Record<LlmRole, RoleConfig> }) {
    return this.settingsService.save(input);
  }

  geminiConfigured(): boolean {
    return this.gemini.configured;
  }
}

function isLlmRole(value: string): value is LlmRole {
  return LLM_ROLES.includes(value as LlmRole);
}

async function readVisionImages(
  imagePaths: string[],
  logger: Logger,
): Promise<{ images: string[]; mimeTypes: string[] }> {
  const images: string[] = [];
  const mimeTypes: string[] = [];
  for (const filePath of imagePaths.slice(0, 3)) {
    try {
      const buf = await readFile(filePath);
      if (buf.byteLength > 4 * 1024 * 1024) {
        logger.warn(`Skip vision image (too large): ${filePath}`);
        continue;
      }
      images.push(buf.toString('base64'));
      mimeTypes.push(mimeFromPath(filePath));
    } catch (error) {
      logger.warn(
        `Skip vision image ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return { images, mimeTypes };
}

function mimeFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}
