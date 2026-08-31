import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaService } from '../landing/ollama.service';
import {
  GEMINI_DEFAULTS,
  LLM_ROLES,
  LLM_SETTING_KEY,
  type LlmProvider,
  type LlmRole,
  type LlmSettings,
  type RoleConfig,
} from './llm.types';

@Injectable()
export class LlmSettingsService implements OnModuleInit {
  private readonly logger = new Logger(LlmSettingsService.name);
  private cache: LlmSettings | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaService,
  ) {}

  async onModuleInit() {
    this.cache = await this.load();
  }

  get(): LlmSettings {
    return this.cache ?? this.defaults();
  }

  defaults(): LlmSettings {
    return {
      roles: {
        plan: {
          provider: 'ollama',
          model: this.ollama.modelFor('plan'),
        },
        code: {
          provider: 'ollama',
          model: this.ollama.modelFor('code'),
        },
        vision: {
          provider: 'ollama',
          model: this.ollama.modelFor('vision'),
        },
        chat: {
          provider: 'ollama',
          model: this.ollama.modelFor('chat'),
        },
      },
    };
  }

  defaultModel(provider: LlmProvider, role: LlmRole): string {
    if (provider === 'gemini') return GEMINI_DEFAULTS[role];
    return this.ollama.modelFor(role);
  }

  async save(input: LlmSettings): Promise<LlmSettings> {
    const next = this.normalize(input);
    await this.prisma.appSetting.upsert({
      where: { key: LLM_SETTING_KEY },
      create: { key: LLM_SETTING_KEY, value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    });
    this.cache = next;
    return next;
  }

  private async load(): Promise<LlmSettings> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: LLM_SETTING_KEY },
      });
      if (!row?.value) return this.defaults();
      return this.normalize(JSON.parse(row.value) as Partial<LlmSettings>);
    } catch (error) {
      this.logger.warn(
        `Falha ao ler settings LLM: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.defaults();
    }
  }

  normalize(input: Partial<LlmSettings> | null | undefined): LlmSettings {
    const roles = {} as Record<LlmRole, RoleConfig>;
    for (const role of LLM_ROLES) {
      const raw = input?.roles?.[role];
      const provider: LlmProvider =
        raw?.provider === 'gemini' ? 'gemini' : 'ollama';
      const model = (raw?.model || '').trim() || this.defaultModel(provider, role);
      roles[role] = { provider, model };
    }
    return { roles };
  }
}
