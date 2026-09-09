import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GEMINI_DEFAULTS,
  LLM_ROLES,
  LLM_SETTING_KEY,
  type LlmRole,
  type LlmSettings,
  type RoleConfig,
} from './llm.types';

@Injectable()
export class LlmSettingsService implements OnModuleInit {
  private readonly logger = new Logger(LlmSettingsService.name);
  private cache: LlmSettings | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.cache = await this.load();
  }

  get(): LlmSettings {
    return this.cache ?? this.defaults();
  }

  defaults(): LlmSettings {
    return {
      roles: {
        plan: { model: GEMINI_DEFAULTS.plan },
        code: { model: GEMINI_DEFAULTS.code },
        vision: { model: GEMINI_DEFAULTS.vision },
        chat: { model: GEMINI_DEFAULTS.chat },
      },
    };
  }

  defaultModel(role: LlmRole): string {
    return GEMINI_DEFAULTS[role];
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
      const raw = input?.roles?.[role] as
        | (RoleConfig & { provider?: string })
        | undefined;
      const model = (raw?.model || '').trim() || this.defaultModel(role);
      roles[role] = { model };
    }
    return { roles };
  }
}
