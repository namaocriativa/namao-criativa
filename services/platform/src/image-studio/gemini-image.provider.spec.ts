import { defaultImageProjectSettings } from './image-models';
import { buildGeminiImageRequest } from './gemini-image.provider';

describe('buildGeminiImageRequest', () => {
  const settings = {
    ...defaultImageProjectSettings(),
    systemInstruction: 'estilo editorial',
    googleSearch: true,
    aspectRatio: '16:9',
    imageSize: '2K',
  };

  it('monta modalities, imageConfig e tools', () => {
    const body = buildGeminiImageRequest({
      model: 'gemini-3-pro-image',
      prompt: 'uma foto na piscina',
      history: [
        { role: 'user', text: 'antes' },
        {
          role: 'model',
          text: 'ok',
          images: [{ mimeType: 'image/png', data: 'aaa' }],
        },
      ],
      referenceImages: [{ mimeType: 'image/jpeg', data: 'bbb' }],
      settings,
    });

    expect(body.generationConfig).toEqual(
      expect.objectContaining({
        temperature: 1,
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '2K',
        },
        thinkingConfig: { includeThoughts: true },
      }),
    );
    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'estilo editorial' }],
    });
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'antes' }] },
      {
        role: 'model',
        parts: [
          { text: 'ok' },
          { inline_data: { mime_type: 'image/png', data: 'aaa' } },
        ],
      },
      {
        role: 'user',
        parts: [
          { text: 'uma foto na piscina' },
          { inline_data: { mime_type: 'image/jpeg', data: 'bbb' } },
        ],
      },
    ]);
  });

  it('não envia grounding quando o modelo não suporta', () => {
    const body = buildGeminiImageRequest({
      model: 'gemini-3.1-flash-lite-image',
      prompt: 'ícone',
      history: [],
      referenceImages: [],
      settings: { ...settings, googleSearch: true },
    });
    expect(body.tools).toBeUndefined();
    expect(
      (body.generationConfig as { imageConfig: { imageSize: string } })
        .imageConfig.imageSize,
    ).toBe('1K');
  });

  it('envia thinking level e image search no Nano Banana 2', () => {
    const body = buildGeminiImageRequest({
      model: 'gemini-3.1-flash-image',
      prompt: 'pássaro',
      history: [],
      referenceImages: [],
      settings: {
        ...settings,
        googleSearch: true,
        imageSearch: true,
        thinkingLevel: 'high',
        includeThoughts: false,
        personGeneration: 'ALLOW_NONE',
      },
    });
    expect(body.generationConfig).toEqual(
      expect.objectContaining({
        thinkingConfig: { includeThoughts: false, thinkingLevel: 'high' },
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '2K',
        },
      }),
    );
    expect(
      (body.generationConfig as { imageConfig: Record<string, string> })
        .imageConfig.personGeneration,
    ).toBeUndefined();
    expect(body.tools).toEqual([
      {
        google_search: {
          searchTypes: { webSearch: {}, imageSearch: {} },
        },
      },
    ]);
  });
});
