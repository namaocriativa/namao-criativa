import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { GeminiUsage } from '../llm/gemini-usage';
import { PrismaService } from '../prisma/prisma.service';
import { optionalTenantId } from '../tenant/tenant-context';
import { AiBudgetExceededException } from './ai-budget.exception';
import {
  getAiUsageContext,
  setAiUsageBudgetWarning,
} from './ai-usage.context';
import { AI_USAGE_STATUS } from './ai-usage.features';
import {
  DEFAULT_USD_TO_BRL,
  formatUsageChip,
  microsFromUsd,
  periodKey,
  usdFromMicros,
} from './ai-usage.period';
import { quoteUsageMicros, type AiPriceRowLike } from './ai-usage.pricing';
import {
  publicUsageEvent,
  sumUsageCost,
  type AiUsageCost,
} from './ai-usage.public';

export type RecordAiCallInput = {
  model: string;
  kind: 'text' | 'image' | 'video';
  status: (typeof AI_USAGE_STATUS)[keyof typeof AI_USAGE_STATUS];
  usage?: GeminiUsage | null;
  imageCount?: number;
  videoSeconds?: number;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
};

const SPEND_STATUSES = [AI_USAGE_STATUS.billed, AI_USAGE_STATUS.estimated];

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);
  private priceCache: AiPriceRowLike[] | null = null;
  private fxCache: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async assertWithinBudget() {
    const checks = await this.budgetChecks();
    for (const check of checks) {
      if (check.blocked) {
        throw new AiBudgetExceededException(check.scope, check.remainingUsd);
      }
      if (check.warning) {
        setAiUsageBudgetWarning({
          scope: check.scope,
          percent: check.percent,
        });
      }
    }
  }

  async recordCall(input: RecordAiCallInput) {
    try {
      const ctx = getAiUsageContext();
      const tenantId =
        ctx?.tenantId || optionalTenantId() || null;
      const prices = await this.listPriceRows();
      const fx = await this.getFx();
      const billed = input.status !== AI_USAGE_STATUS.failedUnbilled;
      const usdMicros = billed
        ? quoteUsageMicros(prices, {
            model: input.model,
            usage: input.usage,
            imageCount: input.imageCount,
            videoSeconds: input.videoSeconds,
          })
        : 0n;
      const brlMicros = microsFromUsd(usdFromMicros(usdMicros) * fx);
      const usage = input.usage;
      await this.prisma.aiUsageEvent.create({
        data: {
          tenantId,
          userId: ctx?.userId || null,
          leadId: ctx?.leadId || null,
          customerId: ctx?.customerId || null,
          feature: ctx?.feature || 'unattributed',
          provider: 'gemini',
          model: input.model,
          kind: input.kind,
          promptTokens: usage?.promptTokens || 0,
          candidatesTokens: usage?.candidatesTokens || 0,
          thoughtsTokens: usage?.thoughtsTokens || 0,
          cachedTokens: usage?.cachedTokens || 0,
          totalTokens: usage?.totalTokens || 0,
          imageCount: input.imageCount || 0,
          videoSeconds: input.videoSeconds || 0,
          usdMicros,
          fxUsdToBrl: fx,
          brlMicros,
          status: input.status,
          jobId: ctx?.jobId || null,
          periodKey: periodKey(),
          ...(input.metadata
            ? { metadata: input.metadata as Prisma.InputJsonValue }
            : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar usage: ${error instanceof Error ? error.message : 'erro'}`,
      );
    }
  }

  async getFx(): Promise<number> {
    if (this.fxCache != null) return this.fxCache;
    const row = await this.prisma.aiPlatformSetting.findUnique({
      where: { key: 'usdToBrl' },
    });
    const parsed = Number(row?.value);
    this.fxCache =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_BRL;
    return this.fxCache;
  }

  async saveFx(usdToBrl: number) {
    if (!Number.isFinite(usdToBrl) || usdToBrl <= 0) {
      throw new Error('Câmbio inválido');
    }
    await this.prisma.aiPlatformSetting.upsert({
      where: { key: 'usdToBrl' },
      create: { key: 'usdToBrl', value: String(usdToBrl) },
      update: { value: String(usdToBrl) },
    });
    this.fxCache = usdToBrl;
    return { usdToBrl };
  }

  async listPriceRows(): Promise<AiPriceRowLike[]> {
    if (this.priceCache) return this.priceCache;
    const rows = await this.prisma.aiPriceRow.findMany({
      orderBy: [{ model: 'asc' }, { unit: 'asc' }, { effectiveFrom: 'desc' }],
    });
    this.priceCache = rows;
    return rows;
  }

  async savePriceRows(
    rows: Array<{
      model: string;
      unit: string;
      usdPerMillion?: number;
      usdPerUnit?: number;
    }>,
  ) {
    const at = new Date();
    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.aiPriceRow.create({
          data: {
            model: row.model.trim(),
            unit: row.unit.trim(),
            usdPerMillion: row.usdPerMillion || 0,
            usdPerUnit: row.usdPerUnit || 0,
            effectiveFrom: at,
          },
        }),
      ),
    );
    this.priceCache = null;
    return this.pricingPayload();
  }

  async pricingPayload() {
    const [rows, usdToBrl] = await Promise.all([
      this.listPriceRows(),
      this.getFx(),
    ]);
    return {
      usdToBrl,
      rows: rows.map((row) => ({
        model: row.model,
        unit: row.unit,
        usdPerMillion: row.usdPerMillion,
        usdPerUnit: row.usdPerUnit,
        effectiveFrom: row.effectiveFrom.toISOString(),
      })),
    };
  }

  async costForJob(jobId: string): Promise<AiUsageCost | null> {
    if (!jobId) return null;
    const events = await this.prisma.aiUsageEvent.findMany({
      where: { jobId, status: { in: SPEND_STATUSES } },
    });
    if (!events.length) return null;
    return sumUsageCost(events);
  }

  async costForJobs(jobIds: string[]): Promise<Map<string, AiUsageCost>> {
    const map = new Map<string, AiUsageCost>();
    const ids = [...new Set(jobIds.filter(Boolean))];
    if (!ids.length) return map;
    const events = await this.prisma.aiUsageEvent.findMany({
      where: { jobId: { in: ids }, status: { in: SPEND_STATUSES } },
    });
    const grouped = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.jobId) continue;
      const list = grouped.get(event.jobId) || [];
      list.push(event);
      grouped.set(event.jobId, list);
    }
    for (const [jobId, list] of grouped) {
      map.set(jobId, sumUsageCost(list));
    }
    return map;
  }

  async costForOwner(input: {
    leadId?: string | null;
    customerId?: string | null;
    feature?: string;
    from?: Date;
    to?: Date;
  }): Promise<AiUsageCost> {
    const ownerIds = [input.leadId, input.customerId].filter(
      (value): value is string => Boolean(value),
    );
    if (!ownerIds.length) return sumUsageCost([]);
    const events = await this.prisma.aiUsageEvent.findMany({
      where: {
        status: { in: SPEND_STATUSES },
        ...(input.feature ? { feature: input.feature } : {}),
        ...(input.from || input.to
          ? {
              occurredAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
        OR: [
          { leadId: { in: ownerIds } },
          { customerId: { in: ownerIds } },
        ],
      },
    });
    return sumUsageCost(events);
  }

  async monthTotalForUser(userId: string, period = periodKey()) {
    const events = await this.prisma.aiUsageEvent.findMany({
      where: {
        userId,
        periodKey: period,
        status: { in: SPEND_STATUSES },
      },
    });
    return sumUsageCost(events);
  }

  async attachCostsToUserActivity<
    T extends { id: string; kind: string; at: string; costLabel?: string },
  >(userId: string, items: T[]) {
    const month = await this.monthTotalForUser(userId);
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const events = await this.prisma.aiUsageEvent.findMany({
      where: {
        userId,
        status: { in: SPEND_STATUSES },
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: 'asc' },
    });
    const used = new Set<string>();
    const next = items.map((item) => {
      const at = Date.parse(item.at);
      const near = events.filter((event) => {
        if (used.has(event.id)) return false;
        return Math.abs(event.occurredAt.getTime() - at) <= 5 * 60 * 1000;
      });
      if (!near.length) return item;
      for (const event of near) used.add(event.id);
      const cost = sumUsageCost(near);
      return { ...item, costLabel: cost.costLabel };
    });
    return { items: next, month };
  }

  async attachCostsToHistory<
    T extends {
      id: string;
      kind: string;
      at: string;
      payload: Record<string, unknown> | null;
    },
  >(
    items: T[],
    owner: { leadId?: string | null; customerId?: string | null },
  ): Promise<T[]> {
    const ownerIds = [owner.leadId, owner.customerId].filter(
      (value): value is string => Boolean(value),
    );
    const jobIds = items
      .map((item) => {
        const payload = item.payload;
        if (!payload) return '';
        if (typeof payload.jobId === 'string') return payload.jobId;
        if (typeof payload.planId === 'string') return payload.planId;
        return '';
      })
      .filter(Boolean);
    const [byJob, ownerEvents] = await Promise.all([
      this.costForJobs(jobIds),
      ownerIds.length
        ? this.prisma.aiUsageEvent.findMany({
            where: {
              status: { in: SPEND_STATUSES },
              OR: [
                { leadId: { in: ownerIds } },
                { customerId: { in: ownerIds } },
              ],
            },
          })
        : Promise.resolve([]),
    ]);
    return items.map((item) => {
      const payload = item.payload || {};
      const jobId =
        (typeof payload.jobId === 'string' && payload.jobId) ||
        (typeof payload.planId === 'string' && payload.planId) ||
        '';
      let cost = jobId ? byJob.get(jobId) : undefined;
      if (!cost) {
        const at = Date.parse(item.at);
        const near = ownerEvents.filter(
          (event) =>
            Math.abs(event.occurredAt.getTime() - at) <= 30 * 60 * 1000 &&
            (!jobId || event.jobId === jobId),
        );
        if (near.length && this.historyLooksLikeAi(item.kind)) {
          cost = sumUsageCost(near);
        }
      }
      if (!cost) return item;
      return {
        ...item,
        payload: { ...payload, ...cost },
      };
    });
  }

  async tenantUsage(tenantId: string, period = periodKey()) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new NotFoundException('Conta não encontrada');
    const [events, budgets, fx] = await Promise.all([
      this.prisma.aiUsageEvent.findMany({
        where: { tenantId, periodKey: period, status: { in: SPEND_STATUSES } },
        orderBy: { occurredAt: 'desc' },
        take: 300,
      }),
      this.prisma.aiBudget.findMany({ where: { tenantId } }),
      this.getFx(),
    ]);
    const allPeriod = await this.prisma.aiUsageEvent.findMany({
      where: { tenantId, periodKey: period, status: { in: SPEND_STATUSES } },
    });
    const total = sumUsageCost(allPeriod);
    const byUser = this.groupBy(allPeriod, (row) => row.userId || 'none');
    const byLead = this.groupBy(
      allPeriod,
      (row) => row.leadId || row.customerId || 'none',
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: Object.keys(byUser).filter((id) => id !== 'none') } },
      select: { id: true, name: true, email: true },
    });
    const leadIds = Object.keys(byLead).filter((id) => id !== 'none');
    const [leads, customers] = await Promise.all([
      this.prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, name: true },
      }),
      this.prisma.customer.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, name: true },
      }),
    ]);
    const names = new Map<string, string>();
    for (const row of [...leads, ...customers]) names.set(row.id, row.name);
    const tenantBudget = budgets.find((row) => row.scope === 'tenant');
    const limitUsd = tenantBudget
      ? usdFromMicros(tenantBudget.monthlyLimitUsdMicros)
      : null;
    return {
      tenant,
      period,
      fxUsdToBrl: fx,
      total,
      limitUsd,
      limitLabel: limitUsd != null ? formatUsageChip(
        tenantBudget!.monthlyLimitUsdMicros,
        microsFromUsd(limitUsd * fx),
      ) : null,
      percent:
        limitUsd && limitUsd > 0 ? (total.usd / limitUsd) * 100 : null,
      byUser: Object.entries(byUser).map(([id, cost]) => {
        const user = users.find((row) => row.id === id);
        return {
          userId: id === 'none' ? null : id,
          name: user?.name || user?.email || 'Sem funcionário',
          email: user?.email || null,
          ...cost,
        };
      }),
      byLead: Object.entries(byLead).map(([id, cost]) => ({
        ownerId: id === 'none' ? null : id,
        name: names.get(id) || (id === 'none' ? 'Uso interno' : id),
        ...cost,
      })),
      events: events.map(publicUsageEvent),
      budgets: budgets.map((row) => ({
        id: row.id,
        scope: row.scope,
        scopeId: row.scopeId,
        monthlyLimitUsd: usdFromMicros(row.monthlyLimitUsdMicros),
        warnPercent: row.warnPercent,
      })),
    };
  }

  async listBudgets(tenantId: string) {
    await this.requireTenant(tenantId);
    const rows = await this.prisma.aiBudget.findMany({ where: { tenantId } });
    return {
      items: rows.map((row) => ({
        id: row.id,
        scope: row.scope,
        scopeId: row.scopeId,
        monthlyLimitUsd: usdFromMicros(row.monthlyLimitUsdMicros),
        warnPercent: row.warnPercent,
      })),
    };
  }

  async saveBudgets(
    tenantId: string,
    items: Array<{
      scope: 'tenant' | 'user' | 'lead';
      scopeId?: string;
      monthlyLimitUsd: number;
      warnPercent?: number;
    }>,
  ) {
    await this.requireTenant(tenantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.aiBudget.deleteMany({ where: { tenantId } });
      for (const item of items) {
        if (!Number.isFinite(item.monthlyLimitUsd) || item.monthlyLimitUsd <= 0) {
          continue;
        }
        await tx.aiBudget.create({
          data: {
            tenantId,
            scope: item.scope,
            scopeId: item.scopeId?.trim() || '',
            monthlyLimitUsdMicros: microsFromUsd(item.monthlyLimitUsd),
            warnPercent: item.warnPercent || 80,
          },
        });
      }
    });
    return this.listBudgets(tenantId);
  }

  private historyLooksLikeAi(kind: string): boolean {
    return /skill|content-plan|content_plan|calendar|chat|image|video|creative|flyer|carousel|repurpose/i.test(
      kind,
    );
  }

  private groupBy(
    events: Array<{
      userId: string | null;
      leadId: string | null;
      customerId: string | null;
      usdMicros: bigint;
      brlMicros: bigint;
      fxUsdToBrl: number;
      promptTokens: number;
      candidatesTokens: number;
      thoughtsTokens: number;
      cachedTokens: number;
      totalTokens: number;
      imageCount: number;
      videoSeconds: number;
    }>,
    keyOf: (row: { userId: string | null; leadId: string | null; customerId: string | null }) => string,
  ): Record<string, AiUsageCost> {
    const grouped = new Map<string, typeof events>();
    for (const event of events) {
      const key = keyOf(event);
      const list = grouped.get(key) || [];
      list.push(event);
      grouped.set(key, list);
    }
    const out: Record<string, AiUsageCost> = {};
    for (const [key, list] of grouped) {
      out[key] = sumUsageCost(list);
    }
    return out;
  }

  private async requireTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Conta não encontrada');
    return tenant;
  }

  private async budgetChecks(): Promise<
    Array<{
      scope: 'tenant' | 'user' | 'lead';
      blocked: boolean;
      warning: boolean;
      percent: number;
      remainingUsd: number;
    }>
  > {
    const ctx = getAiUsageContext();
    const tenantId = ctx?.tenantId || optionalTenantId();
    if (!tenantId) return [];
    const period = periodKey();
    const budgets = await this.prisma.aiBudget.findMany({
      where: { tenantId },
    });
    if (!budgets.length) return [];
    const results: Array<{
      scope: 'tenant' | 'user' | 'lead';
      blocked: boolean;
      warning: boolean;
      percent: number;
      remainingUsd: number;
    }> = [];
    for (const budget of budgets) {
      const where =
        budget.scope === 'tenant'
          ? { tenantId, periodKey: period, status: { in: SPEND_STATUSES } }
          : budget.scope === 'user'
            ? ctx?.userId && (budget.scopeId === ctx.userId || !budget.scopeId)
              ? {
                  tenantId,
                  userId: ctx.userId,
                  periodKey: period,
                  status: { in: SPEND_STATUSES },
                }
              : null
            : this.ownerBudgetWhere(tenantId, period, ctx, budget.scopeId);
      if (!where) continue;
      const spent = await this.prisma.aiUsageEvent.aggregate({
        where,
        _sum: { usdMicros: true },
      });
      const used = usdFromMicros(spent._sum.usdMicros || 0n);
      const limit = usdFromMicros(budget.monthlyLimitUsdMicros);
      if (limit <= 0) continue;
      const percent = (used / limit) * 100;
      const remainingUsd = Math.max(0, Number((limit - used).toFixed(6)));
      results.push({
        scope: budget.scope as 'tenant' | 'user' | 'lead',
        blocked: percent >= 100,
        warning: percent >= (budget.warnPercent || 80) && percent < 100,
        percent,
        remainingUsd,
      });
    }
    return results;
  }

  private ownerBudgetWhere(
    tenantId: string,
    period: string,
    ctx: ReturnType<typeof getAiUsageContext>,
    scopeId: string,
  ) {
    const ownerId = ctx?.leadId || ctx?.customerId;
    if (!ownerId) return null;
    if (scopeId && scopeId !== ownerId) return null;
    return {
      tenantId,
      periodKey: period,
      status: { in: SPEND_STATUSES },
      OR: [{ leadId: ownerId }, { customerId: ownerId }],
    };
  }
}
