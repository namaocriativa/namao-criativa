import {
  buildRepurposePlannerPrompt,
  parseRepurposeSpec,
} from './repurpose.planner';

const context = {
  prompt: 'Dor de quem treina de manhã e esquece de beber água.',
  notes: 'Tom direto. Comenta ÁGUA.',
};

describe('repurpose.planner', () => {
  it('monta o prompt com briefing e notas', () => {
    const prompt = buildRepurposePlannerPrompt(context);
    expect(prompt).toContain(context.prompt);
    expect(prompt).toContain(context.notes);
    expect(prompt).toContain('capa = dor');
  });

  it('completa reel, carrossel e estático com limites', () => {
    const spec = parseRepurposeSpec(
      {
        reel: {
          hook: 'Esqueceu a água de novo uma duas três quatro cinco seis',
          story: 'Mostre o copo na mesa',
          cta: 'Comenta ÁGUA',
        },
        static: { headline: 'Beba agora', caption: 'Só o gancho.' },
      },
      context,
    );
    expect(spec.reel.hook.split(/\s+/).length).toBeLessThanOrEqual(10);
    expect(spec.reel.cta).toMatch(/coment/i);
    expect(spec.carousel.prompt).toContain('água');
    expect(spec.static.headline).toBe('Beba agora');
    expect(spec.static.caption).toMatch(/salv|coment/i);
  });
});
