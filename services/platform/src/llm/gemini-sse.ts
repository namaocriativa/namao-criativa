export async function* parseGeminiSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

  const flush = (): string | null => {
    if (!dataLines.length) return null;
    const raw = dataLines.join('\n').trim();
    dataLines = [];
    if (!raw || raw === '[DONE]') return null;
    try {
      return extractGeminiText(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line === '') {
          const text = flush();
          if (text) yield text;
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
      }
    }
    if (buffer.startsWith('data:')) {
      dataLines.push(buffer.slice(5).replace(/^ /, ''));
    }
    const last = flush();
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

export function extractGeminiText(data: unknown): string {
  const candidates = (
    data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }
  )?.candidates;
  const parts = candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text || '')
    .filter(Boolean)
    .join('');
}

export function geminiHttpError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string };
    };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // keep fallback
  }
  const trimmed = body.trim();
  if (trimmed) return trimmed.slice(0, 400);
  return `Gemini HTTP ${status}`;
}
