import { normalizeGenerateConfig } from './generate-config';

describe('generate-config', () => {
  it('usa as seções padrão quando o payload vem vazio', () => {
    const config = normalizeGenerateConfig({});
    expect(config.sections.map((item) => item.id)).toEqual([
      'header',
      'hero',
      'services',
      'about',
      'gallery',
      'contact',
      'footer',
    ]);
    expect(config.components).toEqual([]);
    expect(config.features).toEqual([]);
  });

  it('gera id único para seção custom a partir do título', () => {
    const config = normalizeGenerateConfig({
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          description: 'Abertura',
        },
        {
          id: '',
          type: 'custom',
          title: 'Horário de atendimento',
          description: 'Só fatos do brief',
        },
      ],
    });
    expect(config.sections[1].id).toBe('horario-de-atendimento');
    expect(config.sections[1].type).toBe('custom');
  });

  it('persiste variante canônica e descarta alias inválido', () => {
    const config = normalizeGenerateConfig({
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          component: 'cinematicHero',
        },
        {
          id: 'footer',
          type: 'footer',
          title: 'Footer',
          component: 'nao-existe',
        },
      ],
    });
    expect(config.sections[0].component).toBe('hero.cinematic');
    expect(config.sections[1].component).toBeUndefined();
  });

  it('aceita só features ready e descarta ids inventados ou planned', () => {
    const config = normalizeGenerateConfig({
      features: [
        { id: 'features.ai-chat' },
        { id: 'features.quiz' },
        { id: 'features.invented' },
      ],
    });
    expect(config.features).toEqual([{ id: 'features.ai-chat' }]);
  });

  it('aceita AI Concierge ready e ainda descarta planned', () => {
    const config = normalizeGenerateConfig({
      features: [
        { id: 'features.ai-concierge' },
        { id: 'features.quiz' },
      ],
    });
    expect(config.features).toEqual([{ id: 'features.ai-concierge' }]);
  });

  it('aceita features.map ready com sectionId', () => {
    const config = normalizeGenerateConfig({
      features: [
        { id: 'features.map', props: { sectionId: 'contact' } },
        { id: 'features.quiz' },
      ],
    });
    expect(config.features).toEqual([
      { id: 'features.map', props: { sectionId: 'contact' } },
    ]);
  });

  it('persiste stockVideo só no hero', () => {
    const config = normalizeGenerateConfig({
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          description: 'Abertura',
          stockVideo: true,
        },
        {
          id: 'gallery',
          type: 'gallery',
          title: 'Galeria',
          description: 'Fotos',
          stockVideo: true,
        },
      ],
    });
    expect(config.sections[0].stockVideo).toBe(true);
    expect(config.sections[1].stockVideo).toBeUndefined();
  });

  it('normaliza fatos do copywriter e descarta vazios', () => {
    const config = normalizeGenerateConfig({
      copywriter: {
        category: '  Estética  ',
        description: 'Clínica em Leme.',
        services: ['Limpeza', ' ', 'Botox'],
        notes: '',
      },
    });
    expect(config.copywriter).toEqual({
      category: 'Estética',
      description: 'Clínica em Leme.',
      services: ['Limpeza', 'Botox'],
    });
  });

  it('normaliza paleta custom e intensidade', () => {
    const config = normalizeGenerateConfig({
      theme: {
        colors: {
          paper: '#95F9E3',
          surface: '69ebd0',
          accent: '#49d49d',
          ink: '#564946',
          muted: '#558564',
        },
        intensity: 'HIGH' as never,
      },
    });
    expect(config.theme).toEqual({
      colors: {
        paper: '#95f9e3',
        surface: '#69ebd0',
        accent: '#49d49d',
        ink: '#564946',
        muted: '#558564',
      },
      intensity: 'high',
    });
  });

  it('descarta theme com hex inválido', () => {
    const config = normalizeGenerateConfig({
      theme: {
        colors: {
          paper: 'green',
          surface: '#ffffff',
          accent: '#000000',
          ink: '#111111',
          muted: '#888888',
        },
        intensity: 'leve',
      },
    });
    expect(config.theme).toBeUndefined();
  });

  it('persiste mídias com path público e descarta path inválido', () => {
    const config = normalizeGenerateConfig({
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          description: 'Abertura',
          media: {
            images: ['/images/foto.jpg', '../secret.png', '/videos/nope.mp4'],
            video: '/videos/hero-background.mp4',
            portraitVideo: '/videos/hero-portrait.mp4',
          },
        },
        {
          id: 'gallery',
          type: 'gallery',
          title: 'Galeria',
          description: 'Fotos',
          media: { images: ['/images/a.jpg', '/images/a.jpg', '/images/b.jpg'] },
        },
      ],
    });
    expect(config.sections[0].media).toEqual({
      images: ['/images/foto.jpg'],
      video: '/videos/hero-background.mp4',
      portraitVideo: '/videos/hero-portrait.mp4',
    });
    expect(config.sections[1].media?.images).toEqual([
      '/images/a.jpg',
      '/images/b.jpg',
    ]);
  });

  it('round-trip do payload do wizard preserva locks, mídia e copywriter', () => {
    const config = normalizeGenerateConfig({
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          description: 'Abertura',
          component: 'hero.split-video',
          stockVideo: true,
          media: { video: '/videos/hero-background.mp4' },
        },
      ],
      components: [
        {
          component: 'scroll-progress',
          html: '<div></div>',
          css: '',
          js: '',
        },
      ],
      features: [{ id: 'features.ai-chat' }],
      copywriter: { category: 'Estética', notes: 'Atende em Leme' },
      theme: {
        colors: {
          paper: '#eef2f4',
          surface: '#ffffff',
          accent: '#1f6b5c',
          ink: '#142033',
          muted: '#5b6b7c',
        },
        intensity: 'leve',
      },
    });
    const again = normalizeGenerateConfig(config);
    expect(again).toEqual(config);
  });
});
