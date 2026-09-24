import {
  buildCarouselPlannerPrompt,
  buildCarouselSlidePrompt,
  clampSlideCount,
  parseCarouselSpec,
  roleForIndex,
} from './carousel-instagram.planner';

const context = {
  prompt: 'Hábitos de hidratação para quem treina de manhã.',
  notes: 'Tom direto. CTA para salvar o post.',
  slideCount: 5,
};

describe('carousel-instagram.planner', () => {
  it('limita a quantidade de slides entre 3 e 7', () => {
    expect(clampSlideCount(1)).toBe(3);
    expect(clampSlideCount(5)).toBe(5);
    expect(clampSlideCount(12)).toBe(7);
    expect(clampSlideCount('nope')).toBe(5);
  });

  it('define capa no primeiro e CTA no último', () => {
    expect(roleForIndex(0, 5)).toBe('cover');
    expect(roleForIndex(4, 5)).toBe('cta');
    expect(roleForIndex(1, 5)).toBe('tip');
  });

  it('monta o prompt do planner com briefing, notas e quantidade', () => {
    const prompt = buildCarouselPlannerPrompt(context);
    expect(prompt).toContain('carousel-instagram');
    expect(prompt).toContain('Exatamente 5 slides');
    expect(prompt).toContain(context.prompt);
    expect(prompt).toContain(context.notes);
  });

  it('completa slides faltantes e trava o count pedido', () => {
    const spec = parseCarouselSpec(
      {
        caption: 'Beba água. Salve este post.',
        artDirection: 'Alto contraste, tipo grande',
        palette: 'preto e lima',
        slides: [{ role: 'cover', headline: 'Água agora', body: '', visual: 'garrafa' }],
      },
      context,
    );
    expect(spec.slides).toHaveLength(5);
    expect(spec.slides[0].headline).toBe('Água agora');
    expect(spec.slides[4].role).toBe('cta');
    expect(spec.caption).toContain('Salve este post');
  });

  it('monta o prompt de cada slide com o texto travado e continuidade', () => {
    const spec = parseCarouselSpec(
      {
        caption: 'Legenda',
        slides: [
          { role: 'cover', headline: 'Comece hidratado', visual: 'pessoa correndo' },
          { role: 'tip', headline: '500 ml antes', visual: 'garrafa' },
          { role: 'cta', headline: 'Salve e beba', visual: 'close da garrafa' },
        ],
      },
      { ...context, slideCount: 3 },
    );
    const first = buildCarouselSlidePrompt(spec, spec.slides[0], 3);
    const second = buildCarouselSlidePrompt(spec, spec.slides[1], 3);
    expect(first).toContain('slide 1 of 3');
    expect(first).toContain('Comece hidratado');
    expect(first).toContain('This is the cover');
    expect(second).toContain('previous slide');
    expect(second).toContain('500 ml antes');
    expect(second).not.toContain('Comece hidratado');
  });
});
