export type SseEvent = {
  event: string;
  data: string;
};

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let dataLines: string[] = [];

  const flush = (): SseEvent | null => {
    if (!dataLines.length) {
      event = 'message';
      return null;
    }
    const payload: SseEvent = {
      event,
      data: dataLines.join('\n'),
    };
    event = 'message';
    dataLines = [];
    return payload;
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
          const item = flush();
          if (item) yield item;
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
      }
    }
    if (buffer) {
      if (buffer.startsWith('event:')) event = buffer.slice(6).trim();
      else if (buffer.startsWith('data:')) {
        dataLines.push(buffer.slice(5).replace(/^ /, ''));
      }
    }
    const last = flush();
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}
