import {
  AI_CONCIERGE_FEATURE_ID,
  MAP_FEATURE_ID,
  coerceFeatureId,
  fillMapFeatureProps,
  googleMapsEmbedSrc,
  isChatRuntimeFeature,
  resolveMapSectionId,
  toLlmFeatureCatalog,
} from '@namao/landing-kit';

describe('feature catalog concierge', () => {
  it('libera concierge no allow-list e no runtime de chat', () => {
    expect(coerceFeatureId(AI_CONCIERGE_FEATURE_ID)).toBe(
      AI_CONCIERGE_FEATURE_ID,
    );
    expect(isChatRuntimeFeature(AI_CONCIERGE_FEATURE_ID)).toBe(true);
    expect(isChatRuntimeFeature('features.quiz')).toBe(false);
    expect(
      toLlmFeatureCatalog().some((item) => item.id === AI_CONCIERGE_FEATURE_ID),
    ).toBe(true);
  });
});

describe('feature catalog map', () => {
  const sections = [
    { id: 'header', title: 'Header', type: 'header' },
    { id: 'hero', title: 'Hero', type: 'hero' },
    { id: 'contact', title: 'Contato', type: 'contact' },
    { id: 'footer', title: 'Footer', type: 'footer' },
  ];

  it('libera features.map no allow-list', () => {
    expect(coerceFeatureId(MAP_FEATURE_ID)).toBe(MAP_FEATURE_ID);
    expect(toLlmFeatureCatalog().some((item) => item.id === MAP_FEATURE_ID)).toBe(
      true,
    );
  });

  it('seleciona seção Maps pelo título e cai em contact', () => {
    expect(
      resolveMapSectionId(
        [...sections, { id: 'maps', title: 'Maps', type: 'custom' }],
        null,
      ),
    ).toBe('maps');
    expect(
      resolveMapSectionId(
        [...sections, { id: 'local', title: 'Mapa', type: 'custom' }],
        null,
      ),
    ).toBe('local');
    expect(resolveMapSectionId(sections, null)).toBe('contact');
  });

  it('mantém a escolha manual enquanto a seção existir', () => {
    expect(resolveMapSectionId(sections, 'hero')).toBe('hero');
    expect(resolveMapSectionId(sections, 'sumiu')).toBe('contact');
  });

  it('preenche query com coordenadas e omite o mapa sem endereço', () => {
    const selected = [{ id: MAP_FEATURE_ID, props: { sectionId: 'contact' } }];
    expect(
      fillMapFeatureProps(
        selected,
        { latitude: -22.78, longitude: -47.3, address: 'Leme SP' },
        sections,
      ),
    ).toEqual([
      {
        id: MAP_FEATURE_ID,
        props: {
          sectionId: 'contact',
          query: '-22.78,-47.3',
          address: 'Leme SP',
        },
      },
    ]);
    expect(fillMapFeatureProps(selected, {}, sections)).toEqual([]);
    expect(googleMapsEmbedSrc('Leme SP')).toContain('output=embed');
  });
});
