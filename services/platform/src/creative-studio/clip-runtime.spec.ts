import { CLIP_GENERATING_LOCK_MS, isGeneratingLocked } from './clip-runtime';

describe('isGeneratingLocked', () => {
  const now = Date.parse('2026-09-18T15:00:00Z');

  it('libera clipes que não estão gerando', () => {
    expect(isGeneratingLocked('ready', new Date(now), now)).toBe(false);
    expect(isGeneratingLocked('failed', new Date(now), now)).toBe(false);
  });

  it('trava geração recente', () => {
    expect(
      isGeneratingLocked('generating', new Date(now - 60_000), now),
    ).toBe(true);
  });

  it('libera geração travada depois do timeout', () => {
    expect(
      isGeneratingLocked(
        'generating',
        new Date(now - CLIP_GENERATING_LOCK_MS - 1),
        now,
      ),
    ).toBe(false);
  });
});
