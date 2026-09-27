import { getAiUsageContext, runWithAiUsage } from './ai-usage.context';

describe('ai-usage.context', () => {
  it('filho herda feature e preenche lead', () => {
    const seen = runWithAiUsage(
      { feature: 'carousel', userId: 'u1', leadId: 'lead-1' },
      () =>
        runWithAiUsage({ feature: 'image_generate', userId: 'u1' }, () =>
          getAiUsageContext(),
        ),
    );
    expect(seen?.feature).toBe('carousel');
    expect(seen?.leadId).toBe('lead-1');
  });

  it('sem pai usa a feature da ação', () => {
    const seen = runWithAiUsage(
      { feature: 'image_generate', userId: 'u1' },
      () => getAiUsageContext(),
    );
    expect(seen?.feature).toBe('image_generate');
    expect(seen?.leadId).toBeUndefined();
  });
});
