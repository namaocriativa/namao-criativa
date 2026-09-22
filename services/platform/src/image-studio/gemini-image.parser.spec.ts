import {
  extractGeminiImageParts,
  geminiPromptBlockReason,
  keepFinalGeminiImage,
  summarizeGeminiImageParts,
} from './gemini-image.parser';

describe('gemini-image.parser', () => {
  it('extrai texto, thoughts e inline_data', () => {
    const parts = extractGeminiImageParts({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'planejando a cena' },
              { text: 'pronto' },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: Buffer.from('png').toString('base64'),
                },
              },
            ],
          },
        },
      ],
    });
    expect(parts).toEqual([
      { type: 'thought', text: 'planejando a cena' },
      { type: 'text', text: 'pronto' },
      expect.objectContaining({ type: 'image', mimeType: 'image/png' }),
    ]);
    const summary = summarizeGeminiImageParts(parts);
    expect(summary.text).toBe('pronto');
    expect(summary.thoughts).toBe('planejando a cena');
    expect(summary.images).toHaveLength(1);
    expect(summary.images[0].buffer.toString()).toBe('png');
  });

  it('aceita inlineData em camelCase', () => {
    const parts = extractGeminiImageParts({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: Buffer.from('jpg').toString('base64'),
                },
              },
            ],
          },
        },
      ],
    });
    expect(parts[0]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' });
  });

  it('lê block reason', () => {
    expect(
      geminiPromptBlockReason({ promptFeedback: { blockReason: 'SAFETY' } }),
    ).toBe('SAFETY');
  });

  it('ignora imagens de thought e fica com a última imagem final', () => {
    const draft = Buffer.from('draft').toString('base64');
    const finalImage = Buffer.from('final').toString('base64');
    const parts = extractGeminiImageParts({
      candidates: [
        {
          content: {
            parts: [
              {
                thought: true,
                inline_data: { mime_type: 'image/png', data: draft },
              },
              {
                inline_data: { mime_type: 'image/png', data: draft },
              },
              {
                inline_data: { mime_type: 'image/jpeg', data: finalImage },
              },
            ],
          },
        },
      ],
    });
    expect(parts.filter((part) => part.type === 'image')).toHaveLength(2);
    const summary = summarizeGeminiImageParts(parts);
    const images = keepFinalGeminiImage(summary.images);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe('image/jpeg');
    expect(images[0].buffer.toString()).toBe('final');
  });
});
