import {
  extractGeminiVideoParts,
  geminiInteractionId,
  geminiVideoBlockReason,
  summarizeGeminiVideoParts,
} from './gemini-video.parser';

describe('gemini-video.parser', () => {
  it('extrai thoughts, texto e vídeo dos steps', () => {
    const data = {
      id: 'v1_abc',
      status: 'completed',
      steps: [
        { type: 'user_input', content: [{ type: 'text', text: 'prompt' }] },
        {
          type: 'thought',
          content: [{ type: 'thought', text: 'planejando o movimento' }],
        },
        {
          type: 'model_output',
          content: [
            { type: 'text', text: 'pronto' },
            {
              type: 'video',
              mime_type: 'video/mp4',
              data: Buffer.from('mp4').toString('base64'),
            },
          ],
        },
      ],
    };
    const parts = extractGeminiVideoParts(data);
    expect(parts).toEqual([
      { type: 'thought', text: 'planejando o movimento' },
      { type: 'text', text: 'pronto' },
      {
        type: 'video',
        mimeType: 'video/mp4',
        data: Buffer.from('mp4').toString('base64'),
      },
    ]);
    const summary = summarizeGeminiVideoParts(parts);
    expect(summary.text).toBe('pronto');
    expect(summary.thoughts).toBe('planejando o movimento');
    expect(summary.videos).toHaveLength(1);
    expect(summary.videos[0].buffer.toString()).toBe('mp4');
    expect(geminiInteractionId(data)).toBe('v1_abc');
  });

  it('aceita output_video camelCase como fallback', () => {
    const parts = extractGeminiVideoParts({
      outputVideo: {
        mimeType: 'video/mp4',
        data: Buffer.from('clip').toString('base64'),
      },
    });
    expect(parts[0]).toMatchObject({ type: 'video', mimeType: 'video/mp4' });
    expect(summarizeGeminiVideoParts(parts).videos[0].buffer.toString()).toBe(
      'clip',
    );
  });

  it('lê block reason e status incompleto', () => {
    expect(
      geminiVideoBlockReason({ error: { message: 'SAFETY' } }),
    ).toBe('SAFETY');
    expect(geminiVideoBlockReason({ status: 'failed' })).toBe('status failed');
    expect(geminiVideoBlockReason({ status: 'completed' })).toBeUndefined();
  });
});
