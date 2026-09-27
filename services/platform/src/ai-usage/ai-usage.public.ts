import { formatUsageChip, usdFromMicros } from './ai-usage.period';

export type AiUsageCost = {
  usdMicros: number;
  brlMicros: number;
  usd: number;
  brl: number;
  fxUsdToBrl: number;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
  totalTokens: number;
  imageCount: number;
  videoSeconds: number;
  calls: number;
  costLabel: string;
};

export function emptyUsageCost(fxUsdToBrl = 0): AiUsageCost {
  return {
    usdMicros: 0,
    brlMicros: 0,
    usd: 0,
    brl: 0,
    fxUsdToBrl,
    promptTokens: 0,
    candidatesTokens: 0,
    thoughtsTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
    imageCount: 0,
    videoSeconds: 0,
    calls: 0,
    costLabel: formatUsageChip(0, 0),
  };
}

export function sumUsageCost(
  events: Array<{
    usdMicros: bigint | number;
    brlMicros: bigint | number;
    fxUsdToBrl: number;
    promptTokens: number;
    candidatesTokens: number;
    thoughtsTokens: number;
    cachedTokens: number;
    totalTokens: number;
    imageCount: number;
    videoSeconds: number;
  }>,
): AiUsageCost {
  const acc = emptyUsageCost();
  for (const event of events) {
    acc.usdMicros += Number(event.usdMicros);
    acc.brlMicros += Number(event.brlMicros);
    acc.fxUsdToBrl = event.fxUsdToBrl || acc.fxUsdToBrl;
    acc.promptTokens += event.promptTokens;
    acc.candidatesTokens += event.candidatesTokens;
    acc.thoughtsTokens += event.thoughtsTokens;
    acc.cachedTokens += event.cachedTokens;
    acc.totalTokens += event.totalTokens;
    acc.imageCount += event.imageCount;
    acc.videoSeconds += event.videoSeconds;
    acc.calls += 1;
  }
  acc.usd = usdFromMicros(acc.usdMicros);
  acc.brl = usdFromMicros(acc.brlMicros);
  acc.costLabel = formatUsageChip(acc.usdMicros, acc.brlMicros);
  return acc;
}

export function publicUsageEvent(row: {
  id: string;
  tenantId: string | null;
  userId: string | null;
  leadId: string | null;
  customerId: string | null;
  feature: string;
  provider: string;
  model: string;
  kind: string;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
  totalTokens: number;
  imageCount: number;
  videoSeconds: number;
  usdMicros: bigint | number;
  fxUsdToBrl: number;
  brlMicros: bigint | number;
  status: string;
  jobId: string | null;
  periodKey: string;
  occurredAt: Date;
}) {
  const usdMicros = Number(row.usdMicros);
  const brlMicros = Number(row.brlMicros);
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    leadId: row.leadId,
    customerId: row.customerId,
    feature: row.feature,
    provider: row.provider,
    model: row.model,
    kind: row.kind,
    promptTokens: row.promptTokens,
    candidatesTokens: row.candidatesTokens,
    thoughtsTokens: row.thoughtsTokens,
    cachedTokens: row.cachedTokens,
    totalTokens: row.totalTokens,
    imageCount: row.imageCount,
    videoSeconds: row.videoSeconds,
    usdMicros,
    brlMicros,
    usd: usdFromMicros(usdMicros),
    brl: usdFromMicros(brlMicros),
    fxUsdToBrl: row.fxUsdToBrl,
    status: row.status,
    jobId: row.jobId,
    periodKey: row.periodKey,
    occurredAt: row.occurredAt.toISOString(),
    costLabel: formatUsageChip(usdMicros, brlMicros),
  };
}
