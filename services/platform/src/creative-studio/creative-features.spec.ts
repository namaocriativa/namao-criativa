import {
  CAROUSEL_INSTAGRAM_ID,
  CREATIVE_FEATURES,
  FLYER_VENDA_LANDING_ID,
  INICIO_FIM_ID,
  MOVIES_ID,
  PERSONAGENS_ID,
  UGC_SKILLS_ID,
  creativeFeaturesByKind,
  findCreativeFeature,
} from './creative-features';

describe('creative-features', () => {
  it('registra flyer, personagens, filmes, início e fim, UGC Skills, imagem livre e vídeo livre', () => {
    expect(findCreativeFeature(FLYER_VENDA_LANDING_ID)?.status).toBe('ready');
    expect(findCreativeFeature(CAROUSEL_INSTAGRAM_ID)?.status).toBe('ready');
    expect(findCreativeFeature(CAROUSEL_INSTAGRAM_ID)?.kind).toBe('image');
    expect(findCreativeFeature(CAROUSEL_INSTAGRAM_ID)?.defaults?.aspectRatio).toBe(
      '4:5',
    );
    expect(findCreativeFeature(PERSONAGENS_ID)?.status).toBe('ready');
    expect(findCreativeFeature(MOVIES_ID)?.status).toBe('ready');
    expect(findCreativeFeature(MOVIES_ID)?.kind).toBe('video');
    expect(findCreativeFeature(INICIO_FIM_ID)?.status).toBe('ready');
    expect(findCreativeFeature(INICIO_FIM_ID)?.kind).toBe('video');
    expect(findCreativeFeature(INICIO_FIM_ID)?.defaults?.duration).toBe('5s');
    expect(findCreativeFeature(UGC_SKILLS_ID)?.status).toBe('ready');
    expect(findCreativeFeature(UGC_SKILLS_ID)?.kind).toBe('video');
    expect(findCreativeFeature(UGC_SKILLS_ID)?.title).toBe('UGC Skills');
    expect(findCreativeFeature(UGC_SKILLS_ID)?.defaults?.aspectRatio).toBe(
      '9:16',
    );
    expect(findCreativeFeature(UGC_SKILLS_ID)?.defaults?.duration).toBe('8s');
    expect(creativeFeaturesByKind('image').map((item) => item.id)).toEqual([
      'playground-imagem',
      FLYER_VENDA_LANDING_ID,
      CAROUSEL_INSTAGRAM_ID,
      PERSONAGENS_ID,
    ]);
    expect(creativeFeaturesByKind('video').map((item) => item.id)).toEqual([
      'playground-video',
      MOVIES_ID,
      INICIO_FIM_ID,
      UGC_SKILLS_ID,
    ]);
    expect(CREATIVE_FEATURES.some((item) => item.id === 'playground-video')).toBe(
      true,
    );
  });
});
