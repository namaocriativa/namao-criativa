import { defaultVideoProjectSettings } from './video-models';
import {
  buildVeoVideoRequest,
  extractVeoGeneratedVideo,
  veoOperationError,
} from './veo-video.provider';

describe('veo-video.provider', () => {
  const settings = {
    ...defaultVideoProjectSettings(),
    model: 'veo-3.1-lite-generate-preview',
    aspectRatio: '9:16',
    duration: '8s',
    resolution: '720p',
  };

  it('monta predictLongRunning com first/last frame', () => {
    const { model, body } = buildVeoVideoRequest({
      model: 'models/veo-3.1-lite-generate-preview',
      prompt: 'personagem mostra o produto',
      frames: [
        { mimeType: 'image/png', data: 'aaa' },
        { mimeType: 'image/jpeg', data: 'bbb' },
      ],
      settings,
    });

    expect(model).toBe('veo-3.1-lite-generate-preview');
    expect(body).toEqual({
      instances: [
        {
          prompt: 'personagem mostra o produto',
          image: { inlineData: { mimeType: 'image/png', data: 'aaa' } },
          lastFrame: { inlineData: { mimeType: 'image/jpeg', data: 'bbb' } },
        },
      ],
      parameters: {
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        personGeneration: 'allow_adult',
      },
    });
  });

  it('text-to-video sem frames usa allow_all', () => {
    const { body } = buildVeoVideoRequest({
      model: 'veo-3.1-fast-generate-preview',
      prompt: 'drone na praia',
      frames: [],
      settings: { ...settings, model: 'veo-3.1-fast-generate-preview' },
    });
    expect(body.instances).toEqual([{ prompt: 'drone na praia' }]);
    expect(body.parameters).toEqual(
      expect.objectContaining({
        personGeneration: 'allow_all',
        durationSeconds: 8,
      }),
    );
  });

  it('lê uri, bytes e erro da operação', () => {
    expect(
      extractVeoGeneratedVideo({
        done: true,
        response: {
          generateVideoResponse: {
            generatedSamples: [
              { video: { uri: 'https://example/video', mimeType: 'video/mp4' } },
            ],
          },
        },
      }),
    ).toEqual({
      uri: 'https://example/video',
      base64: undefined,
      mimeType: 'video/mp4',
    });
    expect(
      extractVeoGeneratedVideo({
        done: true,
        response: {
          generateVideoResponse: {
            generatedSamples: [
              { video: { bytesBase64Encoded: 'abcd', mimeType: 'video/webm' } },
            ],
          },
        },
      }),
    ).toEqual({
      uri: undefined,
      base64: 'abcd',
      mimeType: 'video/webm',
    });
    expect(
      veoOperationError({
        error: { message: 'quota exceeded' },
      }),
    ).toBe('quota exceeded');
    expect(
      veoOperationError({
        response: {
          generateVideoResponse: {
            raiMediaFilteredReasons: ['unsafe'],
          },
        },
      }),
    ).toBe('unsafe');
  });
});
