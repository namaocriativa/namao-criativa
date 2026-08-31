import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { geminiHttpError, parseGeminiSseStream } from './gemini-sse';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export type GeminiStreamOptions = {
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  get apiKey(): string {
    return this.config.get<string>('GEMINI_API_KEY')?.trim() || '';
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  get model(): string {
    return this.normalizeModel(
      this.config.get<string>('GEMINI_CHAT_MODEL')?.trim() || DEFAULT_MODEL,
    );
  }

  normalizeModel(model: string): string {
    return model.replace(/^models\//, '').trim();
  }

  async *generateStream(
    prompt: string,
    options: GeminiStreamOptions = {},
  ): AsyncGenerator<string> {
    if (!this.configured) {
      throw new Error(
        'GEMINI_API_KEY não configurada. Defina no .env (Google AI Studio).',
      );
    }
    const model = this.normalizeModel(options.model || this.model);
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.4,
        },
      }),
      signal: options.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const message = geminiHttpError(res.status, body);
      this.logger.warn(`Gemini stream failed: ${message}`);
      throw new Error(message);
    }
    if (!res.body) {
      throw new Error('Gemini retornou resposta vazia');
    }
    let yielded = false;
    for await (const delta of parseGeminiSseStream(res.body)) {
      if (!delta) continue;
      yielded = true;
      yield delta;
    }
    if (!yielded) {
      throw new Error('Gemini retornou resposta vazia');
    }
  }
}
