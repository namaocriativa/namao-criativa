import { CONTENT_PLAN_VIDEO_HOOKS, applyVideoHookToPrompt, findVideoHook, listVideoHooks } from './video-hooks';

describe('content-plan video-hooks', () => {
  it('lista os três primeiros hooks de stunt viral', () => {
    const ids = listVideoHooks().map((item) => item.id);
    expect(ids).toEqual(['stunt-cinematic', 'stunt-pixar', 'stunt-gta']);
    expect(CONTENT_PLAN_VIDEO_HOOKS).toHaveLength(3);
    expect(
      CONTENT_PLAN_VIDEO_HOOKS.every((item) => item.group === 'Background estilo stunt viral'),
    ).toBe(true);
    expect(
      CONTENT_PLAN_VIDEO_HOOKS.every(
        (item) => item.example.length > 0 && item.prompt.includes('VISUAL LANGUAGE'),
      ),
    ).toBe(true);
  });

  it('encontra o hook pelo id e ignora inválido', () => {
    expect(findVideoHook('stunt-cinematic')?.title).toMatch(/cinematográfico/i);
    expect(findVideoHook('stunt-pixar')?.prompt).toContain('Pixar');
    expect(findVideoHook('stunt-gta')?.prompt).toContain('neon');
    expect(findVideoHook('nope')).toBeUndefined();
    expect(findVideoHook('')).toBeUndefined();
    expect(findVideoHook(undefined)).toBeUndefined();
  });

  it('anexa o prompt visual ao briefing sem travar o exemplo', () => {
    const hook = findVideoHook('stunt-cinematic');
    const attached = applyVideoHookToPrompt('Título: Reel', hook);
    expect(attached).toContain('cinematic FPV');
    expect(attached).toContain('Do NOT reproduce the famous office-chair');
    expect(attached).toContain('style language only');
    expect(applyVideoHookToPrompt('Título: Reel', undefined)).toBe('Título: Reel');
  });
});
