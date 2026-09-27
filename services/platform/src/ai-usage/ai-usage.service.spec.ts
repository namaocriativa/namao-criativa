import { HttpException } from '@nestjs/common';
import { runWithAiUsage } from './ai-usage.context';
import { AI_FEATURES, AI_USAGE_KIND, AI_USAGE_STATUS } from './ai-usage.features';
import { periodKey } from './ai-usage.period';
import { AiUsageService } from './ai-usage.service';
import { runWithTenant } from '../tenant/tenant-context';

const PRICE_ROWS = [
  {
    model: 'gemini-2.5-flash',
    unit: 'input_token',
    usdPerMillion: 0.3,
    usdPerUnit: 0,
    effectiveFrom: new Date('2026-01-01'),
  },
  {
    model: 'gemini-2.5-flash',
    unit: 'output_token',
    usdPerMillion: 2.5,
    usdPerUnit: 0,
    effectiveFrom: new Date('2026-01-01'),
  },
];

function serviceWith(prisma: Record<string, unknown>) {
  return new AiUsageService(prisma as never);
}

describe('AiUsageService', () => {
  it('grava evento billed com contexto do lead', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = serviceWith({
      aiPriceRow: { findMany: jest.fn().mockResolvedValue(PRICE_ROWS) },
      aiPlatformSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: '5.5' }),
      },
      aiUsageEvent: { create },
    });
    await runWithTenant('t1', () =>
      runWithAiUsage(
        {
          feature: AI_FEATURES.igSkill,
          userId: 'u1',
          leadId: 'lead-1',
          jobId: 'job-1',
        },
        () =>
          service.recordCall({
            model: 'gemini-2.5-flash',
            kind: AI_USAGE_KIND.text,
            status: AI_USAGE_STATUS.billed,
            usage: {
              promptTokens: 1000,
              candidatesTokens: 500,
              thoughtsTokens: 0,
              cachedTokens: 0,
              totalTokens: 1500,
            },
          }),
      ),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          userId: 'u1',
          leadId: 'lead-1',
          feature: 'ig_skill',
          jobId: 'job-1',
          status: 'billed',
          periodKey: periodKey(),
        }),
      }),
    );
  });

  it('400 vira failed_unbilled com usd 0', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = serviceWith({
      aiPriceRow: { findMany: jest.fn().mockResolvedValue(PRICE_ROWS) },
      aiPlatformSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: '5.5' }),
      },
      aiUsageEvent: { create },
    });
    await runWithTenant('t1', () =>
      service.recordCall({
        model: 'gemini-2.5-flash',
        kind: AI_USAGE_KIND.text,
        status: AI_USAGE_STATUS.failedUnbilled,
        usage: {
          promptTokens: 10,
          candidatesTokens: 0,
          thoughtsTokens: 0,
          cachedTokens: 0,
          totalTokens: 10,
        },
      }),
    );
    expect(create.mock.calls[0][0].data.usdMicros).toBe(0n);
    expect(create.mock.calls[0][0].data.status).toBe('failed_unbilled');
  });

  it('bloqueia no 100% do teto da agência', async () => {
    const service = serviceWith({
      aiBudget: {
        findMany: jest.fn().mockResolvedValue([
          {
            scope: 'tenant',
            scopeId: '',
            monthlyLimitUsdMicros: 1_000_000n,
            warnPercent: 80,
          },
        ]),
      },
      aiUsageEvent: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { usdMicros: 1_000_000n },
        }),
      },
    });
    await expect(
      runWithTenant('t1', () =>
        runWithAiUsage({ feature: 'ig_skill', userId: 'u1' }, () =>
          service.assertWithinBudget(),
        ),
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('aviso em 80% não bloqueia', async () => {
    const service = serviceWith({
      aiBudget: {
        findMany: jest.fn().mockResolvedValue([
          {
            scope: 'tenant',
            scopeId: '',
            monthlyLimitUsdMicros: 1_000_000n,
            warnPercent: 80,
          },
        ]),
      },
      aiUsageEvent: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { usdMicros: 800_000n },
        }),
      },
    });
    await expect(
      runWithTenant('t1', () =>
        runWithAiUsage({ feature: 'ig_skill' }, () =>
          service.assertWithinBudget(),
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it('tenantUsage só lê o tenant pedido', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = serviceWith({
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          name: 'A',
          slug: 'a',
        }),
      },
      aiUsageEvent: { findMany },
      aiBudget: { findMany: jest.fn().mockResolvedValue([]) },
      aiPlatformSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: '5.5' }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      lead: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await service.tenantUsage('t1', '2026-09');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', periodKey: '2026-09' }),
      }),
    );
  });
});
