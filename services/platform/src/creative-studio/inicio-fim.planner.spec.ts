import { INICIO_FIM_ID } from './creative-features';
import { inicioFimPrompt } from './inicio-fim.planner';

describe('inicio-fim.planner', () => {
  it('trava início, fim, duração e o texto do movimento', () => {
    const prompt = inicioFimPrompt({
      prompt: 'a câmera avança e a luz esquenta',
      duration: '8s',
    });
    expect(prompt).toContain('8s');
    expect(prompt).toContain('a câmera avança e a luz esquenta');
    expect(prompt).toContain('quadro de abertura');
    expect(prompt).toContain('quadro de encerramento');
    expect(prompt).toContain(INICIO_FIM_ID);
  });

  it('usa transição suave quando o texto vem vazio', () => {
    const prompt = inicioFimPrompt({ prompt: '   ', duration: '5s' });
    expect(prompt).toContain('5s');
    expect(prompt).toContain('transição cinematográfica suave');
    expect(prompt).not.toMatch(/Movimento:\s*\./);
  });
});
