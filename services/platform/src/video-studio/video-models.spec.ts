import {
  clampHighResDuration,
  defaultVideoModel,
  defaultVideoProjectSettings,
  estimateVideoCost,
  findVideoModel,
  isVeoVideoModel,
  listVideoModelsPayload,
  mergeVideoProjectSettings,
  normalizeVideoProjectSettings,
  VIDEO_MODELS,
} from './video-models';

describe('video-models', () => {
  it('usa Gemini Omni 1.1 Flash em 360p como padrão', () => {
    expect(defaultVideoModel().id).toBe('gemini-omni-1.1-flash');
    expect(defaultVideoModel().label).toBe('Gemini Omni 1.1 Flash');
    expect(defaultVideoProjectSettings()).toEqual({
      model: 'gemini-omni-1.1-flash',
      aspectRatio: '16:9',
      duration: '8s',
      resolution: '360p',
      thinkingLevel: 'low',
    });
  });

  it('expõe Omni e a família Veo 3.1 no catálogo', () => {
    expect(VIDEO_MODELS.map((model) => model.id)).toEqual([
      'gemini-omni-1.1-flash',
      'veo-3.1-lite-generate-preview',
      'veo-3.1-fast-generate-preview',
      'veo-3.1-generate-preview',
    ]);
    const omni = findVideoModel('models/gemini-omni-1.1-flash');
    expect(omni?.generationApi).toBe('interactions');
    expect(omni?.capabilities.aspectRatios).toEqual(['16:9', '9:16']);
    expect(omni?.capabilities.durations).toContain('10s');
    expect(omni?.capabilities.resolutions).toContain('1080p');
    expect(omni?.capabilities.maxFrames).toBe(2);
    expect(omni?.pricing.videoUsdPerSecond).toEqual({
      '360p': 0.03,
      '720p': 0.1,
      '1080p': 0.15,
      '4k': 0.3,
    });
    const lite = findVideoModel('veo-3.1-lite-generate-preview');
    expect(lite?.generationApi).toBe('predictLongRunning');
    expect(lite?.capabilities.durations).toEqual(['4s', '6s', '8s']);
    expect(lite?.capabilities.resolutions).toEqual(['720p', '1080p']);
    expect(lite?.capabilities.thinkingLevels).toEqual([]);
    expect(lite?.pricing.videoUsdPerSecond).toEqual({
      '720p': 0.05,
      '1080p': 0.08,
    });
    expect(isVeoVideoModel('veo-3.1-generate-preview')).toBe(true);
    expect(isVeoVideoModel('gemini-omni-1.1-flash')).toBe(false);
    expect(listVideoModelsPayload().usdBrl).toBe(5.4);
  });

  it('estima o custo de 8s em 360p', () => {
    expect(
      estimateVideoCost({
        model: 'gemini-omni-1.1-flash',
        duration: '8s',
        resolution: '360p',
        thinkingLevel: 'low',
      }),
    ).toEqual({
      usdPerSecond: 0.03,
      usdTotal: 0.24,
      seconds: 8,
      resolution: '360p',
      thinkingMayAddTextTokens: false,
    });
  });

  it('estima 720p e avisa thinking high', () => {
    expect(
      estimateVideoCost({
        model: 'gemini-omni-1.1-flash',
        duration: '8s',
        resolution: '720p',
        thinkingLevel: 'high',
      }),
    ).toEqual({
      usdPerSecond: 0.1,
      usdTotal: 0.8,
      seconds: 8,
      resolution: '720p',
      thinkingMayAddTextTokens: true,
    });
  });

  it('normaliza settings inválidas e duração sem sufixo', () => {
    const settings = normalizeVideoProjectSettings({
      model: 'unknown-model',
      aspectRatio: '1:1',
      duration: '5',
      resolution: '8k',
      thinkingLevel: 'ultra',
    });
    expect(settings.model).toBe('gemini-omni-1.1-flash');
    expect(settings.aspectRatio).toBe('16:9');
    expect(settings.duration).toBe('5s');
    expect(settings.resolution).toBe('360p');
    expect(settings.thinkingLevel).toBe('low');
  });

  it('merge usa o request por cima do clipe e do default', () => {
    const settings = mergeVideoProjectSettings(
      { aspectRatio: '9:16', duration: '8s', resolution: '720p' },
      { resolution: '360p', thinkingLevel: 'low', model: 'gemini-omni-1.1-flash' },
    );
    expect(settings).toEqual({
      model: 'gemini-omni-1.1-flash',
      aspectRatio: '9:16',
      duration: '8s',
      resolution: '360p',
      thinkingLevel: 'low',
    });
  });

  it('normaliza Veo Lite: sem 360p/10s, 1080p+4s cai para 720p', () => {
    expect(
      normalizeVideoProjectSettings({
        model: 'veo-3.1-lite-generate-preview',
        aspectRatio: '9:16',
        duration: '10s',
        resolution: '360p',
        thinkingLevel: 'high',
      }),
    ).toEqual({
      model: 'veo-3.1-lite-generate-preview',
      aspectRatio: '9:16',
      duration: '8s',
      resolution: '720p',
      thinkingLevel: 'low',
    });
    expect(
      clampHighResDuration(
        { duration: '4s', resolution: '1080p' },
        { durations: ['4s', '6s', '8s'], resolutions: ['720p', '1080p'] },
      ),
    ).toEqual({ duration: '4s', resolution: '720p' });
    expect(
      estimateVideoCost({
        model: 'veo-3.1-lite-generate-preview',
        duration: '8s',
        resolution: '720p',
        thinkingLevel: 'low',
      }),
    ).toEqual({
      usdPerSecond: 0.05,
      usdTotal: 0.4,
      seconds: 8,
      resolution: '720p',
      thinkingMayAddTextTokens: false,
    });
  });
});
