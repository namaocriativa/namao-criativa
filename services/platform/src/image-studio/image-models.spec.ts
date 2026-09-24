import {
  defaultImageModel,
  defaultImageProjectSettings,
  findImageModel,
  IMAGE_MODELS,
  normalizeImageProjectSettings,
} from './image-models';

describe('image-models', () => {
  it('usa Nano Banana Pro como padrão', () => {
    expect(defaultImageModel().id).toBe('gemini-3-pro-image');
    expect(defaultImageModel().label).toBe('Nano Banana Pro');
    expect(defaultImageProjectSettings().model).toBe('gemini-3-pro-image');
  });

  it('expõe catálogo com providers e capabilities', () => {
    expect(IMAGE_MODELS.length).toBeGreaterThanOrEqual(4);
    expect(IMAGE_MODELS.every((model) => model.provider === 'gemini')).toBe(
      true,
    );
    const lite = findImageModel('gemini-3.1-flash-lite-image');
    expect(lite?.capabilities.googleSearch).toBe(false);
    expect(lite?.capabilities.imageSearch).toBe(false);
    expect(lite?.capabilities.resolutions).toEqual(['1K']);
    const flash = findImageModel('gemini-3.1-flash-image');
    expect(flash?.capabilities.aspectRatios).toEqual(
      expect.arrayContaining(['1:1', '16:9', '1:4', '8:1']),
    );
    expect(flash?.capabilities.resolutions).toEqual(['0.5K', '1K', '2K', '4K']);
    expect(flash?.capabilities.imageSearch).toBe(true);
    expect(flash?.capabilities.thinkingLevels).toEqual(['minimal', 'high']);
    const pro = findImageModel('gemini-3-pro-image');
    expect(pro?.capabilities.googleSearch).toBe(true);
    expect(pro?.capabilities.resolutions).toContain('4K');
    expect(pro?.capabilities.thinkingLevels).toEqual([]);
    expect(
      IMAGE_MODELS.every((model) => model.capabilities.personGenerations.length === 0),
    ).toBe(true);
    expect(defaultImageProjectSettings().personGeneration).toBe('ALLOW_ADULT');
    expect(defaultImageProjectSettings().includeThoughts).toBe(true);
  });

  it('normaliza settings inválidas para o modelo escolhido', () => {
    const settings = normalizeImageProjectSettings({
      model: 'gemini-3.1-flash-lite-image',
      temperature: 9,
      aspectRatio: '99:1',
      imageSize: '4K',
      googleSearch: true,
    });
    expect(settings.model).toBe('gemini-3.1-flash-lite-image');
    expect(settings.temperature).toBe(2);
    expect(settings.aspectRatio).toBe('1:1');
    expect(settings.imageSize).toBe('1K');
    expect(settings.googleSearch).toBe(false);
    expect(settings.imageSearch).toBe(false);
    expect(settings.thinkingLevel).toBe('');
    expect(settings.includeThoughts).toBe(true);
  });

  it('preserva featureId ao normalizar o restante das settings', () => {
    const settings = normalizeImageProjectSettings(
      {
        model: 'gemini-3-pro-image',
        temperature: 0.4,
      },
      {
        ...defaultImageProjectSettings(),
        featureId: 'flyer-venda-landing',
      },
    );
    expect(settings.featureId).toBe('flyer-venda-landing');
    expect(settings.temperature).toBe(0.4);
  });

  it('preserva skillRun ao normalizar o restante das settings', () => {
    const skillRun = {
      leadId: 'lead-1',
      leadLabel: 'Clínica Norte',
      packageIds: ['pkg-1'],
      packages: [{ id: 'pkg-1', name: 'Site Estratégico', price: 1200 }],
      notes: 'Enfatizar WhatsApp',
      spec: { headline: 'Presença digital' },
    };
    const settings = normalizeImageProjectSettings(
      {
        model: 'gemini-3-pro-image',
        temperature: 0.4,
      },
      {
        ...defaultImageProjectSettings(),
        featureId: 'flyer-venda-landing',
        skillRun,
      },
    );
    expect(settings.featureId).toBe('flyer-venda-landing');
    expect(settings.skillRun).toMatchObject({
      leadId: 'lead-1',
      leadLabel: 'Clínica Norte',
      notes: 'Enfatizar WhatsApp',
      spec: { headline: 'Presença digital' },
    });
  });

  it('preserva skillRun de carrossel sem leadId', () => {
    const settings = normalizeImageProjectSettings(
      {
        model: 'gemini-3-pro-image',
        temperature: 0.4,
      },
      {
        ...defaultImageProjectSettings(),
        featureId: 'carousel-instagram',
        skillRun: {
          prompt: 'Hábitos de hidratação',
          slideCount: 5,
          spec: { caption: 'Salve o post' },
        },
      },
    );
    expect(settings.skillRun).toMatchObject({
      prompt: 'Hábitos de hidratação',
      slideCount: 5,
      spec: { caption: 'Salve o post' },
    });
  });
});
