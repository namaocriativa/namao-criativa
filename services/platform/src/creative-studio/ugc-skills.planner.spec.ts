import { UGC_SKILLS_ID } from './creative-features';
import { ugcSkillsPrompt } from './ugc-skills.planner';

describe('ugc-skills.planner', () => {
  it('trava criador, produto, duração e o pedido do operador', () => {
    const prompt = ugcSkillsPrompt({
      name: 'Luma',
      appearance: 'cabelo ruivo',
      personality: 'energia de vendedora',
      prompt: 'hook de 2s e CTA de compre agora',
      duration: '8s',
    });
    expect(prompt).toContain('8s');
    expect(prompt).toContain('Luma');
    expect(prompt).toContain('cabelo ruivo');
    expect(prompt).toContain('hook de 2s e CTA de compre agora');
    expect(prompt).toContain('foto do produto');
    expect(prompt).toContain('Não transforme a pessoa no produto');
    expect(prompt).toContain(UGC_SKILLS_ID);
  });

  it('usa o CTA padrão quando o texto vem vazio', () => {
    const prompt = ugcSkillsPrompt({
      name: 'Luma',
      appearance: 'cabelo ruivo',
      prompt: '   ',
      duration: '5s',
    });
    expect(prompt).toContain('5s');
    expect(prompt).toContain('mostra o produto e convida a comprar');
    expect(prompt).not.toMatch(/Pedido do operador:\s*\./);
  });
});
