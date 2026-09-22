import { parseGeminiTurnResponse } from './gemini-turn';
import { extractGeminiUsage, mergeGeminiUsage } from './gemini-usage';

describe('gemini usage e turn', () => {
  it('lê usageMetadata', () => {
    expect(
      extractGeminiUsage({
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 4,
          totalTokenCount: 14,
        },
      }),
    ).toEqual({
      promptTokens: 10,
      candidatesTokens: 4,
      totalTokens: 14,
    });
  });

  it('soma usages', () => {
    expect(
      mergeGeminiUsage(
        { promptTokens: 2, candidatesTokens: 1, totalTokens: 3 },
        { promptTokens: 5, candidatesTokens: 5, totalTokens: 10 },
      ),
    ).toEqual({ promptTokens: 7, candidatesTokens: 6, totalTokens: 13 });
  });

  it('extrai functionCall e texto', () => {
    const parsed = parseGeminiTurnResponse({
      candidates: [
        {
          content: {
            parts: [
              { text: 'vou buscar' },
              {
                functionCall: {
                  name: 'search_leads',
                  args: { query: 'barbearia' },
                },
              },
            ],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 8, totalTokenCount: 8 },
    });
    expect(parsed.text).toBe('vou buscar');
    expect(parsed.functionCalls).toEqual([
      { name: 'search_leads', args: { query: 'barbearia' } },
    ]);
    expect(parsed.usage?.promptTokens).toBe(8);
  });
});
