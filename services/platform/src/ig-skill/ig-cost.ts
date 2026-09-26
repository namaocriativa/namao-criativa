import { estimatePromptTokens } from '../llm/gemini-usage';

const PRICES: Record<string, { in: number; out: number }> = {
  'gemini-2.5-pro': { in: 1.25, out: 10 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-flash-lite': { in: 0.1, out: 0.4 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
};

const DEFAULT = { in: 0.3, out: 2.5 };

export function estimateIgSkillUsd(model: string): {
  model: string;
  usd: number;
  label: string;
} {
  const price = PRICES[model] || DEFAULT;
  const sample = 'instagram feed compacto com 40 captions e brief do lead';
  const inputTokens = estimatePromptTokens(sample, 40) + 2_000;
  const outputTokens = 4_000;
  const usd =
    (inputTokens / 1_000_000) * price.in +
    (outputTokens / 1_000_000) * price.out;
  return {
    model,
    usd: Number(usd.toFixed(2)),
    label: `~US$ ${usd.toFixed(2)} (análise do feed)`,
  };
}
