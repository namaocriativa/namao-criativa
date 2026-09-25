import { movieShotPrompt } from './movies.planner';

describe('movies.planner', () => {
  it('trava identidade, cenário, ação e fala', () => {
    const prompt = movieShotPrompt({
      characters: [
        {
          name: 'Luma',
          appearance: 'cabelo ruivo',
          personality: 'calma',
        },
      ],
      scene: 'rooftop ao entardecer',
      action: 'acena e sorri',
      dialogue: 'Vamos nessa.',
    });
    expect(prompt).toContain('Luma');
    expect(prompt).toContain('rooftop ao entardecer');
    expect(prompt).toContain('acena e sorri');
    expect(prompt).toContain('Vamos nessa.');
    expect(prompt).toContain('movies');
    expect(prompt).toContain('Não troque o elenco');
    expect(prompt).toContain('um único protagonista');
    expect(prompt).toContain('plano médio');
    expect(prompt).toContain('fixa em tripé');
    expect(prompt).toContain('Continuidade de identidade');
    expect(prompt).not.toContain('Câmera cinematográfica, movimento natural');
  });

  it('usa o enquadramento e a câmera do take', () => {
    const prompt = movieShotPrompt({
      characters: [{ name: 'Luma', appearance: 'cabelo ruivo' }],
      scene: 'sala',
      action: 'olha pela janela',
      framing: 'close',
      camera: 'dolly_in',
    });
    expect(prompt).toContain('rosto preenchendo o quadro');
    expect(prompt).toContain('dolly in lento');
  });

  it('lista o elenco quando há mais de um personagem', () => {
    const prompt = movieShotPrompt({
      characters: [
        { name: 'Eduarda', appearance: 'cabelo preto' },
        { name: 'Luma', appearance: 'cabelo ruivo' },
      ],
      scene: 'sala',
      action: 'conversam',
      framing: 'plano_geral',
      camera: 'orbit',
    });
    expect(prompt).toContain('elenco: Eduarda, Luma');
    expect(prompt).toContain('Eduarda');
    expect(prompt).toContain('Luma');
    expect(prompt).toContain('retratos do elenco');
    expect(prompt).toContain('plano geral');
    expect(prompt).toContain('orbit, circunda');
  });
});
