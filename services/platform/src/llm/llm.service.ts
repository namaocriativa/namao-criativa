import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { EnvStatusService } from './env-status.service';
import { GeminiService } from './gemini.service';
import type { GenerateOptions } from './generate-options';
import type {
  GeminiToolDeclaration,
  GeminiTurnContent,
  GeminiTurnResult,
} from './gemini-turn';
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
    private readonly gemini: GeminiService,
    private readonly envStatus: EnvStatusService,
  ) {}

  resolve(role: LlmRole): RoleConfig {
    return this.settingsService.get().roles[role];
  }

  modelFor(role: LlmRole): string {
    return this.resolve(role).model;
  }

  providerFor(_role: LlmRole) {
    return 'gemini' as const;
  }

  async generateJson<T>(
    prompt: string,
    validate: (value: unknown) => T,
    options: GenerateOptions & { expectedShape?: string } = {},
  ): Promise<T> {
    await this.settingsService.ensureLoaded();
    const role = options.role || 'code';
    const resolved = this.resolve(role);
    const model = options.model || resolved.model;
    this.logger.debug(`${role} via gemini:${model}`);
    return this.gemini.generateJson(prompt, validate, { ...options, model });
  }

  async generateTurn(input: {
    systemInstruction?: string;
    contents: GeminiTurnContent[];
    tools?: GeminiToolDeclaration[];
    temperature?: number;
    model?: string;
    signal?: AbortSignal;
  }): Promise<GeminiTurnResult> {
    await this.settingsService.ensureLoaded();
    const resolved = this.resolve('chat');
    const model = input.model || resolved.model;
    this.logger.debug(`chat turn via gemini:${model}`);
    return this.gemini.generateTurn({ ...input, model });
  }

  async *generateStream(
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncGenerator<string> {
    await this.settingsService.ensureLoaded();
    const role = options.role || 'chat';
    const resolved = this.resolve(role);
    const model = options.model || resolved.model;
    this.logger.debug(`${role} stream via gemini:${model}`);
    yield* this.gemini.generateStream(prompt, { ...options, model });
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
      formatJson: true,
    });
  }

  async unload(_roleOrModel?: LlmRole | string): Promise<void> {
    return;
  }

  async status() {
    await this.settingsService.ensureLoaded();
    const settings = this.settingsService.get();
    const gemini = await this.gemini.status();
    const roles = {} as Record<LlmRole, RoleStatus>;
    const errors: string[] = [];

    for (const role of LLM_ROLES) {
      const cfg = settings.roles[role];
      const ok = gemini.configured && gemini.ok;
      const error = ok
        ? undefined
        : !gemini.configured
          ? 'GEMINI_API_KEY não configurada no .env'
          : gemini.error || 'Gemini indisponível';
      roles[role] = { ...cfg, ok, error };
      if (!ok) errors.push(`${role}: ${error}`);
    }

    return {
      ready: errors.length === 0,
      error: errors.length ? errors.join(' · ') : undefined,
      roles,
      gemini,
    };
  }

  async configPayload() {
    const status = await this.status();
    return {
      ...status,
      env: this.envStatus.list(),
      settings: this.settingsService.get(),
      stages: LLM_STAGES,
      defaults: {
        gemini: {
          plan: this.settingsService.defaultModel('plan'),
          code: this.settingsService.defaultModel('code'),
          vision: this.settingsService.defaultModel('vision'),
          chat: this.settingsService.defaultModel('chat'),
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
