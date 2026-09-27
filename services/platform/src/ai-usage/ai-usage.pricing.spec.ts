import { quoteUsageUsd, type AiPriceRowLike } from './ai-usage.pricing';

const ROWS: AiPriceRowLike[] = [
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
  {
    model: 'default',
    unit: 'image',
    usdPerMillion: 0,
    usdPerUnit: 0.039,
    effectiveFrom: new Date('2026-01-01'),
  },
];

describe('ai-usage.pricing', () => {
  it('calcula 1k in + 500 out em micros estáveis', () => {
    const usd = quoteUsageUsd(ROWS, {
      model: 'gemini-2.5-flash',
      usage: {
        promptTokens: 1000,
        candidatesTokens: 500,
        thoughtsTokens: 0,
        cachedTokens: 0,
        totalTokens: 1500,
      },
    });
    expect(usd).toBeCloseTo(0.00155, 8);
  });

  it('cobra imagem por unidade', () => {
    const usd = quoteUsageUsd(ROWS, {
      model: 'gemini-2.5-flash-image',
      imageCount: 2,
    });
    expect(usd).toBeCloseTo(0.078, 8);
  });
});
