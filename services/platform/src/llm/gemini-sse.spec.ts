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

  it('lê mensagem de erro da API', () => {
    expect(
      geminiHttpError(403, '{"error":{"message":"API key invalid"}}'),
    ).toBe('API key invalid');
  });
});
