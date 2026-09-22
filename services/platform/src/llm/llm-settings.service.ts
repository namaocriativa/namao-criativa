import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { requireTenantId } from '../tenant/tenant.util';
import {
  GEMINI_DEFAULTS,
  LLM_ROLES,
  LLM_SETTING_KEY,
  type LlmRole,
  type LlmSettings,
  type RoleConfig,
} from './llm.types';

@Injectable()
export class LlmSettingsService {
  private readonly logger = new Logger(LlmSettingsService.name);
  private readonly cache = new Map<string, LlmSettings>();

  constructor(private readonly prisma: PrismaService) {}

  get(): LlmSettings {
    const tenantId = requireTenantId();
    return this.cache.get(tenantId) ?? this.defaults();
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

  async ensureLoaded(tenantId = requireTenantId()): Promise<LlmSettings> {
    const cached = this.cache.get(tenantId);
    if (cached) return cached;
    const loaded = await this.load(tenantId);
    this.cache.set(tenantId, loaded);
    return loaded;
  }

  async save(input: LlmSettings): Promise<LlmSettings> {
    const tenantId = requireTenantId();
    const next = this.normalize(input);
    await this.prisma.appSetting.upsert({
      where: { tenantId_key: { tenantId, key: LLM_SETTING_KEY } },
      create: {
        tenantId,
        key: LLM_SETTING_KEY,
        value: JSON.stringify(next),
      },
      update: { value: JSON.stringify(next) },
    });
    this.cache.set(tenantId, next);
    return next;
  }

  private async load(tenantId: string): Promise<LlmSettings> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { tenantId_key: { tenantId, key: LLM_SETTING_KEY } },
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
