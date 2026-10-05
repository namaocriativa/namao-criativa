import {
  NO_CHARACTER_VOICE_INSTRUCTION,
  applyNoCharacterVoice,
  buildVideoLivreBreakPrompt,
  buildVideoLivreRefinePrompt,
  parseVideoLivreBreak,
  parseVideoLivreRefine,
} from './video-livre.planner';

describe('video-livre.planner', () => {
  it('monta prompt de refine com briefing e nota', () => {
    const prompt = buildVideoLivreRefinePrompt({
      brief: 'Dentista fala sobre clareamento',
      note: 'mais direto',
      videoHookTitle: 'Realista / cinematográfico',
    });
    expect(prompt).toContain('Dentista fala sobre clareamento');
    expect(prompt).toContain('mais direto');
    expect(prompt).toContain('Realista / cinematográfico');
    expect(prompt).toContain('productionPrompt');
  });

  it('parseia o refine', () => {
    expect(
      parseVideoLivreRefine({
        title: 'Clareamento',
        productionPrompt: 'Close-up do dentista explicando o clareamento.',
      }),
    ).toEqual({
      title: 'Clareamento',
      productionPrompt: 'Close-up do dentista explicando o clareamento.',
    });
  });

  it('recusa refine sem productionPrompt', () => {
    expect(() => parseVideoLivreRefine({ title: 'X' })).toThrow(/productionPrompt/);
  });

  it('monta prompt de break com continuidade e N takes', () => {
    const prompt = buildVideoLivreBreakPrompt({
      script: 'Dentista explica clareamento e fecha com CTA',
      takeCount: 3,
      videoHookTitle: 'Realista / cinematográfico',
    });
    expect(prompt).toContain('EXATAMENTE 3 takes');
    expect(prompt).toContain('CONTINUIDADE LINEAR');
    expect(prompt).toContain('mudanças bruscas');
    expect(prompt).toContain('Dentista explica clareamento');
    expect(prompt).toContain('Realista / cinematográfico');
  });

  it('parseia break com exatamente N takes', () => {
    const result = parseVideoLivreBreak(
      {
        takes: [
          {
            id: 'take-1',
            label: 'Take 1 · Hook',
            beat: 'abre',
            productionPrompt: 'Close-up do gancho.',
          },
          {
            id: 'take-2',
            label: 'Take 2',
            beat: 'meio',
            productionPrompt: 'Continua explicando.',
          },
          {
            id: 'take-3',
            label: 'Take 3 · CTA',
            beat: 'fecha',
            productionPrompt: 'Fecha com CTA.',
          },
        ],
      },
      3,
    );
    expect(result.takes).toHaveLength(3);
    expect(result.takes[0].productionPrompt).toContain('gancho');
    expect(result.takes[2].label).toContain('CTA');
  });

  it('recusa break sem prompts', () => {
    expect(() => parseVideoLivreBreak({ takes: [{ label: 'x' }] }, 3)).toThrow(
      /takes vazias/,
    );
  });

  it('aplica instrução sem voz do personagem', () => {
    expect(applyNoCharacterVoice('Ação na rua', true)).toContain(
      NO_CHARACTER_VOICE_INSTRUCTION,
    );
    expect(applyNoCharacterVoice('Ação na rua', false)).toBe('Ação na rua');
  });
});
