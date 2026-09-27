import { extractGeminiText, geminiHttpError, parseGeminiSseStream } from './gemini-sse';

describe('gemini-sse', () => {
  it('extrai texto do candidato', () => {
    expect(
      extractGeminiText({
        candidates: [{ content: { parts: [{ text: 'Olá' }, { text: ' mundo' }] } }],
      }),
    ).toBe('Olá mundo');
  });

  it('lê chunks SSE do Gemini', async () => {
    const payload = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Olá"}]}}]}',
      '',
      'data: {"candidates":[{"content":{"parts":[{"text":" mundo"}]}}]}',
      '',
    ].join('\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    });
    const chunks: string[] = [];
    for await (const delta of parseGeminiSseStream(stream)) {
      chunks.push(delta);
    }
    expect(chunks).toEqual(['Olá', ' mundo']);
  });

  it('entrega o último evento para ler usageMetadata', async () => {
    const payload = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Oi"}]}}]}',
      '',
      'data: {"candidates":[{"content":{"parts":[{"text":"!"}]}}],"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":2,"totalTokenCount":5}}',
      '',
    ].join('\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    });
    const events: unknown[] = [];
    for await (const _delta of parseGeminiSseStream(stream, (data) => {
      events.push(data);
    })) {
      void _delta;
    }
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        usageMetadata: expect.objectContaining({ totalTokenCount: 5 }),
      }),
    );
  });

  it('lê mensagem de erro da API', () => {
    expect(
      geminiHttpError(403, '{"error":{"message":"API key invalid"}}'),
    ).toBe('API key invalid');
  });
});
