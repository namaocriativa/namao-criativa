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
  });

  it('lista o elenco quando há mais de um personagem', () => {
    const prompt = movieShotPrompt({
      characters: [
        { name: 'Eduarda', appearance: 'cabelo preto' },
        { name: 'Luma', appearance: 'cabelo ruivo' },
      ],
      scene: 'sala',
      action: 'conversam',
    });
    expect(prompt).toContain('elenco: Eduarda, Luma');
    expect(prompt).toContain('Eduarda');
    expect(prompt).toContain('Luma');
    expect(prompt).toContain('retratos do elenco');
  });
});
