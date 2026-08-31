import {
  allowedComponentsForType,
  componentSupportsVideo,
  enableMotion,
  parsePageSpec,
  toLlmCatalog,
} from '@namao/landing-kit';

describe('premium registry', () => {
  it('normaliza alias camelCase para o id canônico', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'premium',
        paletteId: 'slate-teal',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'hero',
          type: 'hero',
          component: 'cinematicHero',
          props: { headline: 'Aurora', image: '/images/a.jpg' },
        },
      ],
    });
    expect(spec.sections[0].component).toBe('hero.cinematic');
    expect(spec.theme.animation).toBe('cinematic');
  });

  it('normaliza alias das variantes de marketing', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'premium',
        paletteId: 'slate-teal',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'hero',
          type: 'hero',
          component: 'marketingHero',
          props: { headline: 'Aurora' },
        },
      ],
    });
    expect(spec.sections[0].component).toBe('hero.marketing');
  });

  it('toLlmCatalog filtra runtime lite e inclui capabilities', () => {
    const lite = toLlmCatalog({ runtime: 'lite' });
    expect(lite.every((item) => item.runtime === 'lite' || item.id === 'hero.morphing')).toBe(
      true,
    );
    expect(lite.some((item) => item.id === 'navbar.minimal')).toBe(true);
    expect(lite.some((item) => item.id === 'hero.marketing')).toBe(true);
    expect(lite.some((item) => item.id === 'gallery.carousel')).toBe(true);
    expect(lite.some((item) => item.id === 'cta.dark')).toBe(true);
    expect(lite.some((item) => item.id === 'hero.cinematic')).toBe(false);

    const all = toLlmCatalog({ runtime: 'all' });
    const cinematic = all.find((item) => item.id === 'hero.cinematic');
    expect(cinematic?.runtime).toBe('premium');
    expect(cinematic?.aliases).toContain('cinematicHero');
    expect(cinematic?.capabilities).toContain('parallax');
  });

  it('gates de hero premium: cinematic só com large-photography; immersive com foto', () => {
    const lite = allowedComponentsForType('hero', {
      hasPhotos: true,
      hasServices: false,
      hasRating: false,
      hasDescription: false,
      hasContacts: true,
      hasLogo: false,
      runtime: 'lite',
    });
    expect(lite).not.toContain('hero.cinematic');
    expect(lite).not.toContain('hero.immersive');
    expect(lite).toContain('hero.marketing');

    const richBalanced = allowedComponentsForType('hero', {
      hasPhotos: true,
      hasServices: false,
      hasRating: false,
      hasDescription: false,
      hasContacts: true,
      hasLogo: false,
      runtime: 'premium',
      imageStrategy: 'balanced',
    });
    expect(richBalanced).toContain('hero.split');
    expect(richBalanced).toContain('hero.immersive');
    expect(richBalanced).not.toContain('hero.cinematic');

    const richPhoto = allowedComponentsForType('hero', {
      hasPhotos: true,
      hasServices: false,
      hasRating: false,
      hasDescription: false,
      hasContacts: true,
      hasLogo: false,
      runtime: 'premium',
      imageStrategy: 'large-photography',
    });
    expect(richPhoto).toContain('hero.cinematic');
  });

  it('hasVideo sem foto libera immersive no runtime premium', () => {
    const list = allowedComponentsForType('hero', {
      hasPhotos: false,
      hasServices: false,
      hasRating: false,
      hasDescription: false,
      hasContacts: true,
      hasLogo: false,
      hasVideo: true,
      runtime: 'premium',
    });
    expect(list).toContain('hero.immersive');
    expect(list).toContain('hero.split-video');
    expect(list).not.toContain('hero.cinematic');
  });

  it('não habilita motion quando reducedMotion ou animation none', () => {
    expect(enableMotion({ reducedMotion: true, animation: 'cinematic' })).toBe(
      false,
    );
    expect(enableMotion({ reducedMotion: false, animation: 'none' })).toBe(
      false,
    );
    expect(enableMotion({ reducedMotion: false, animation: 'cinematic' })).toBe(
      true,
    );
  });

  it('cinematic, immersive e split-video suportam vídeo', () => {
    expect(componentSupportsVideo('hero.cinematic')).toBe(true);
    expect(componentSupportsVideo('hero.immersive')).toBe(true);
    expect(componentSupportsVideo('hero.split-video')).toBe(true);
    expect(componentSupportsVideo('hero.gradient')).toBe(false);
  });
});
