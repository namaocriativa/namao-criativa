import type { GeminiUsage } from '../llm/gemini-usage';
import { microsFromUsd } from './ai-usage.period';

export const PRICE_UNITS = {
  inputToken: 'input_token',
  outputToken: 'output_token',
  thinkingToken: 'thinking_token',
  cachedToken: 'cached_token',
  image: 'image',
  videoSecond: 'video_second',
} as const;

export type AiPriceUnit = (typeof PRICE_UNITS)[keyof typeof PRICE_UNITS];

export type AiPriceRowLike = {
  model: string;
  unit: string;
  usdPerMillion: number;
  usdPerUnit: number;
  effectiveFrom: Date;
};

export function normalizePriceModel(model: string): string {
  return model.replace(/^models\//, '').trim().toLowerCase();
}

export function pickPrice(
  rows: AiPriceRowLike[],
  model: string,
  unit: string,
  at: Date = new Date(),
): AiPriceRowLike | null {
  const wanted = normalizePriceModel(model);
  const eligible = rows.filter(
    (row) =>
      row.unit === unit &&
      row.effectiveFrom.getTime() <= at.getTime() &&
      (normalizePriceModel(row.model) === wanted ||
        normalizePriceModel(row.model) === 'default'),
  );
  eligible.sort((a, b) => {
    const aDefault = normalizePriceModel(a.model) === 'default' ? 1 : 0;
    const bDefault = normalizePriceModel(b.model) === 'default' ? 1 : 0;
    if (aDefault !== bDefault) return aDefault - bDefault;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });
  return eligible[0] || null;
}

export function rateUsd(
  rows: AiPriceRowLike[],
  model: string,
  unit: string,
  at?: Date,
): { perMillion: number; perUnit: number } {
  const row = pickPrice(rows, model, unit, at);
  if (!row) {
    const fallback = pickPrice(rows, 'default', unit, at);
    return {
      perMillion: fallback?.usdPerMillion || 0,
      perUnit: fallback?.usdPerUnit || 0,
    };
  }
  return { perMillion: row.usdPerMillion, perUnit: row.usdPerUnit };
}

export function quoteUsageUsd(
  rows: AiPriceRowLike[],
  input: {
    model: string;
    usage?: GeminiUsage | null;
    imageCount?: number;
    videoSeconds?: number;
    at?: Date;
  },
): number {
  const at = input.at || new Date();
  const usage = input.usage;
  const prompt = usage?.promptTokens || 0;
  const cached = usage?.cachedTokens || 0;
  const output = usage?.candidatesTokens || 0;
  const thoughts = usage?.thoughtsTokens || 0;
  const billablePrompt = Math.max(0, prompt - cached);
  const inRate = rateUsd(rows, input.model, PRICE_UNITS.inputToken, at);
  const outRate = rateUsd(rows, input.model, PRICE_UNITS.outputToken, at);
  const thinkRate = rateUsd(rows, input.model, PRICE_UNITS.thinkingToken, at);
  const cacheRate = rateUsd(rows, input.model, PRICE_UNITS.cachedToken, at);
  const imageRate = rateUsd(rows, input.model, PRICE_UNITS.image, at);
  const videoRate = rateUsd(rows, input.model, PRICE_UNITS.videoSecond, at);
  const usd =
    (billablePrompt / 1_000_000) * inRate.perMillion +
    (cached / 1_000_000) * (cacheRate.perMillion || inRate.perMillion * 0.25) +
    (output / 1_000_000) * outRate.perMillion +
    (thoughts / 1_000_000) * (thinkRate.perMillion || outRate.perMillion) +
    (input.imageCount || 0) * imageRate.perUnit +
    (input.videoSeconds || 0) * videoRate.perUnit;
  return Number(usd.toFixed(8));
}

export function quoteUsageMicros(
  rows: AiPriceRowLike[],
  input: {
    model: string;
    usage?: GeminiUsage | null;
    imageCount?: number;
    videoSeconds?: number;
    at?: Date;
  },
): bigint {
  return microsFromUsd(quoteUsageUsd(rows, input));
}
