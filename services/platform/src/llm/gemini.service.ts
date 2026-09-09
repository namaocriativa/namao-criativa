import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { buildJsonRepairPrompt } from '../landing/pipeline-prompts';
import type { GenerateOptions } from './generate-options';
import {
  extractGeminiText,
  geminiHttpError,
  parseGeminiSseStream,
} from './gemini-sse';
import { parseJsonValue } from './json-parse';
import { GEMINI_DEFAULTS, GEMINI_SUGGESTED_MODELS } from './llm.types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GeminiPart = {
  text?: string;
  inline_data?: { mime_type: string; data: string };
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

  normalizeModel(model: string): string {
    return model.replace(/^models\//, '').trim();
  }

  async status() {
    const suggested = [...GEMINI_SUGGESTED_MODELS];
    if (!this.configured) {
      return {
        configured: false,
        ok: false,
        models: suggested,
        error: 'GEMINI_API_KEY não configurada no .env',
      };
    }
    try {
      const res = await axios.get(`${GEMINI_BASE}/models`, {
        params: { key: this.apiKey },
        timeout: 8000,
      });
      const listed = Array.isArray(res.data?.models)
        ? res.data.models
            .filter((m: { supportedGenerationMethods?: string[] }) =>
              (m.supportedGenerationMethods || []).includes('generateContent'),
            )
            .map((m: { name?: string }) => this.normalizeModel(m.name || ''))
            .filter(Boolean)
        : [];
      const models = [...new Set([...suggested, ...listed])];
      return { configured: true, ok: true, models };
    } catch (error) {
      const message = geminiErrorMessage(error);
      this.logger.warn(`Gemini status: ${message}`);
      return {
        configured: true,
        ok: false,
        models: suggested,
        error: message,
      };
    }
  }

  async generateJson<T>(
    prompt: string,
    validate: (value: unknown) => T,
    options: GenerateOptions & { expectedShape?: string } = {},
  ): Promise<T> {
    const raw = await this.generateRaw(prompt, {
      ...options,
      formatJson: true,
    });
    try {
      return validate(parseJsonValue(raw));
    } catch (firstError) {
      this.logger.warn(
        `JSON inválido (Gemini), tentando reparo: ${
          firstError instanceof Error ? firstError.message : String(firstError)
        }`,
      );
      const repaired = await this.generateRaw(
        buildJsonRepairPrompt(raw, options.expectedShape || 'objeto JSON'),
        {
          temperature: 0,
          formatJson: true,
          model: options.model,
        },
      );
      return validate(parseJsonValue(repaired));
    }
  }

  private async generateRaw(
    prompt: string,
    options: GenerateOptions,
  ): Promise<string> {
    if (!this.configured) {
      throw new Error(
        'GEMINI_API_KEY não configurada. Defina no .env (Google AI Studio).',
      );
    }
    const model = this.normalizeModel(options.model || GEMINI_DEFAULTS.code);
    const parts: GeminiPart[] = [{ text: prompt }];
    const images = options.images || [];
    images.forEach((data, index) => {
      parts.push({
        inline_data: {
          mime_type: options.imageMimeTypes?.[index] || 'image/jpeg',
          data,
        },
      });
    });

    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
    try {
      const res = await axios.post(
        url,
        {
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            ...(options.formatJson
              ? { responseMimeType: 'application/json' }
              : {}),
          },
        },
        {
          params: { key: this.apiKey },
          timeout: 180_000,
          signal: options.signal,
        },
      );
      const text = extractGeminiText(res.data);
      if (!text) {
        const block = res.data?.promptFeedback?.blockReason;
        throw new Error(
          block
            ? `Gemini bloqueou a resposta: ${block}`
            : 'Gemini retornou resposta vazia',
        );
      }
      options.onChunk?.(text, text);
      return text;
    } catch (error) {
      throw new Error(geminiErrorMessage(error));
    }
  }

  async *generateStream(
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncGenerator<string> {
    if (!this.configured) {
      throw new Error(
        'GEMINI_API_KEY não configurada. Defina no .env (Google AI Studio).',
      );
    }
    const model = this.normalizeModel(
      options.model || GEMINI_DEFAULTS.chat,
    );
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

function geminiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string; status?: string } }
      | undefined;
    const apiMessage = data?.error?.message;
    if (apiMessage) return apiMessage;
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
