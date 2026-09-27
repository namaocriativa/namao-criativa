import { AsyncLocalStorage } from 'async_hooks';

export type AiUsageContext = {
  feature: string;
  tenantId?: string | null;
  userId?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  jobId?: string | null;
  budgetWarning?: { scope: string; percent: number } | null;
};

const storage = new AsyncLocalStorage<AiUsageContext>();

export function runWithAiUsage<T>(
  ctx: AiUsageContext,
  fn: () => T,
): T {
  const parent = storage.getStore();
  if (parent) {
    return storage.run(
      {
        ...parent,
        tenantId: parent.tenantId ?? ctx.tenantId,
        userId: parent.userId ?? ctx.userId,
        leadId: parent.leadId ?? ctx.leadId,
        customerId: parent.customerId ?? ctx.customerId,
        jobId: parent.jobId ?? ctx.jobId,
      },
      fn,
    );
  }
  return storage.run({ ...ctx, budgetWarning: null }, fn);
}

export function getAiUsageContext(): AiUsageContext | undefined {
  return storage.getStore();
}

export function setAiUsageBudgetWarning(warning: {
  scope: string;
  percent: number;
}) {
  const store = storage.getStore();
  if (store) store.budgetWarning = warning;
}
