export const AI_USAGE_TIMEZONE = 'America/Sao_Paulo';
export const DEFAULT_USD_TO_BRL = 5.5;

export function periodKey(at: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: AI_USAGE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(at);
  return formatted.slice(0, 7);
}

export function parseDurationSeconds(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  const text = String(raw || '').trim();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Math.max(0, Number(match[1])) : 0;
}

export function microsFromUsd(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) return 0n;
  return BigInt(Math.round(usd * 1_000_000));
}

export function usdFromMicros(micros: bigint | number): number {
  return Number(micros) / 1_000_000;
}

export function formatUsageChip(
  usdMicros: bigint | number,
  brlMicros: bigint | number,
): string {
  const usd = usdFromMicros(usdMicros);
  const brl = usdFromMicros(brlMicros);
  return `R$ ${brl.toFixed(2)} · US$ ${usd.toFixed(2)}`;
}
