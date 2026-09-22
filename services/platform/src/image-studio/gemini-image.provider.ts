import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GeminiService } from '../llm/gemini.service';
import { geminiHttpError } from '../llm/gemini-sse';
import { findImageModel } from './image-models';
import type {
  ImageGenerateRequest,
  ImageGenerateResult,
  ImageHistoryTurn,
  ImageProvider,
} from './image-provider';
import { extractGeminiUsage } from '../llm/gemini-usage';
import {
  extractGeminiImageParts,
  geminiPromptBlockReason,
  keepFinalGeminiImage,
  summarizeGeminiImageParts,
} from './gemini-image.parser';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GENERATE_TIMEOUT_MS = 300_000;
const MAX_BODY_BYTES = 80 * 1024 * 1024;

type GeminiRequestPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export function buildGeminiImageRequest(
  input: ImageGenerateRequest,
): Record<string, unknown> {
  const contents = [
    ...historyContents(input.history),
    {
      role: 'user',
      parts: buildParts(input.prompt, input.referenceImages),
    },
  ];

  const generationConfig: Record<string, unknown> = {
    temperature: input.settings.temperature,
    responseModalities: ['TEXT', 'IMAGE'],
  };

  const model = findImageModel(input.model);
  const imageConfig: Record<string, string> = {};
  if (model?.capabilities.aspectRatios.length) {
    const aspectRatio = model.capabilities.aspectRatios.includes(
      input.settings.aspectRatio,
    )
      ? input.settings.aspectRatio
      : model.capabilities.aspectRatios[0];
    if (aspectRatio) imageConfig.aspectRatio = aspectRatio;
  }
  if (model?.capabilities.resolutions.length) {
    const imageSize = model.capabilities.resolutions.includes(
      input.settings.imageSize,
    )
      ? input.settings.imageSize
      : model.capabilities.resolutions[0];
    if (imageSize) imageConfig.imageSize = imageSize;
  }
  // Gemini Developer API (v1beta + API key) rejects personGeneration on
  // imageConfig with "Unknown name". Vertex accepts it; we only send it when
  // the model catalog exposes the capability.
  if (model?.capabilities.personGenerations.length) {
    const personGeneration = model.capabilities.personGenerations.includes(
      input.settings.personGeneration,
    )
      ? input.settings.personGeneration
      : 'ALLOW_ADULT';
    imageConfig.personGeneration = personGeneration;
  }
  if (Object.keys(imageConfig).length) {
    generationConfig.imageConfig = imageConfig;
  }

  if (model?.capabilities.thinking) {
    const thinkingConfig: Record<string, unknown> = {
      includeThoughts: Boolean(input.settings.includeThoughts),
    };
    if (model.capabilities.thinkingLevels.length) {
      const thinkingLevel = model.capabilities.thinkingLevels.includes(
        input.settings.thinkingLevel,
      )
        ? input.settings.thinkingLevel
        : model.capabilities.thinkingLevels[0];
      if (thinkingLevel) thinkingConfig.thinkingLevel = thinkingLevel;
    }
    generationConfig.thinkingConfig = thinkingConfig;
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (
    model?.capabilities.systemInstruction &&
    input.settings.systemInstruction.trim()
  ) {
    body.systemInstruction = {
      parts: [{ text: input.settings.systemInstruction.trim() }],
    };
  }

  const searchTool = buildGoogleSearchTool(input.settings, model);
  if (searchTool) body.tools = [searchTool];

  return body;
}

function buildGoogleSearchTool(
  settings: ImageGenerateRequest['settings'],
  model: ReturnType<typeof findImageModel>,
): Record<string, unknown> | undefined {
  const web = Boolean(model?.capabilities.googleSearch && settings.googleSearch);
  const images = Boolean(model?.capabilities.imageSearch && settings.imageSearch);
  if (!web && !images) return undefined;
  if (web && !images) return { google_search: {} };
  return {
    google_search: {
      searchTypes: {
        ...(web ? { webSearch: {} } : {}),
        ...(images ? { imageSearch: {} } : {}),
      },
    },
  };
}

function historyContents(history: ImageHistoryTurn[]) {
  return history
    .map((turn) => ({
      role: turn.role,
      parts: buildParts(turn.text || '', turn.images || []),
    }))
    .filter((turn) => turn.parts.length > 0);
}

function buildParts(
  text: string,
  images: Array<{ mimeType: string; data: string }>,
): GeminiRequestPart[] {
  const parts: GeminiRequestPart[] = [];
  if (text.trim()) parts.push({ text: text.trim() });
  for (const image of images) {
    if (!image.data) continue;
    parts.push({
      inline_data: {
        mime_type: image.mimeType || 'image/png',
        data: image.data,
      },
    });
  }
  return parts;
}

@Injectable()
export class GeminiImageProvider implements ImageProvider {
  readonly id = 'gemini';
  private readonly logger = new Logger(GeminiImageProvider.name);

  constructor(private readonly gemini: GeminiService) {}

  async generate(input: ImageGenerateRequest): Promise<ImageGenerateResult> {
    if (!this.gemini.configured) {
      throw new Error(
        'GEMINI_API_KEY não configurada. Defina no .env (Google AI Studio).',
      );
    }

    const model = this.gemini.normalizeModel(input.model);
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
    const body = buildGeminiImageRequest({ ...input, model });

    try {
      const res = await axios.post(url, body, {
        params: { key: this.gemini.apiKey },
        timeout: GENERATE_TIMEOUT_MS,
        maxContentLength: MAX_BODY_BYTES,
        maxBodyLength: MAX_BODY_BYTES,
        signal: input.signal,
      });
      const parts = extractGeminiImageParts(res.data);
      const summary = summarizeGeminiImageParts(parts);
      const images = keepFinalGeminiImage(summary.images);
      if (!images.length && !summary.text) {
        const block = geminiPromptBlockReason(res.data);
        throw new Error(
          block
            ? `Gemini bloqueou a resposta: ${block}`
            : 'Gemini retornou resposta vazia',
        );
      }
      return { ...summary, images, usage: extractGeminiUsage(res.data) };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 0;
        const raw =
          typeof error.response?.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response?.data || '');
        const message = geminiHttpError(status, raw) || error.message;
        this.logger.warn(`Gemini image failed: ${message}`);
        throw new Error(message);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
