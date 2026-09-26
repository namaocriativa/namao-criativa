import { formatReelPrompt, overlayRule, parseReelPrompt } from './reel-script';

describe('reel-script', () => {
  it('monta e lê beats rotulados', () => {
    const prompt = formatReelPrompt({
      hook: 'Sua terça está vazia?',
      story: 'Mostre a agenda lotando em 7 dias',
      cta: 'Comenta AGENDA',
      overlayText: 'Salve este Reel',
    });
    const parsed = parseReelPrompt(prompt);
    expect(parsed.hook).toBe('Sua terça está vazia?');
    expect(parsed.story).toContain('agenda');
    expect(parsed.cta).toBe('Comenta AGENDA');
    expect(parsed.overlayText).toBe('Salve este Reel');
  });

  it('trava overlay a uma linha e mantém o ban sem texto', () => {
    expect(overlayRule()).toBe('Sem texto na tela.');
    expect(overlayRule('Já são 40 clientes')).toContain('Já são 40 clientes');
    expect(overlayRule('Já são 40 clientes')).toContain('canto inferior');
  });
});
