import { Injectable, Logger, Optional } from '@nestjs/common';
import axios from 'axios';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { AI_USAGE_KIND, AI_USAGE_STATUS } from '../ai-usage/ai-usage.features';
import { parseDurationSeconds } from '../ai-usage/ai-usage.period';
import { GeminiService } from '../llm/gemini.service';
import { geminiHttpError } from '../llm/gemini-sse';
import { findVideoModel, isVeoVideoModel } from './video-models';
import { generateVeoVideo } from './veo-video.provider';
import type {
  VideoGenerateRequest,
  VideoGenerateResult,
  VideoProvider,
} from './video-provider';
import { extractGeminiUsage } from '../llm/gemini-usage';
import {
  extractGeminiVideoParts,
  geminiInteractionId,
  geminiVideoBlockReason,
  summarizeGeminiVideoParts,
} from './gemini-video.parser';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GENERATE_TIMEOUT_MS = 600_000;
const MAX_BODY_BYTES = 80 * 1024 * 1024;

export function buildGeminiVideoRequest(
  input: VideoGenerateRequest,
): Record<string, unknown> {
  const model = findVideoModel(input.model);
  const contents: Array<Record<string, unknown>> = [];
  for (const frame of input.frames) {
    if (!frame.data) continue;
    contents.push({
      type: 'image',
      mime_type: frame.mimeType || 'image/png',
      data: frame.data,
    });
  }
  if (input.prompt.trim()) {
    contents.push({ type: 'text', text: input.prompt.trim() });
  }

  const aspectRatio = pick(
    input.settings.aspectRatio,
    model?.capabilities.aspectRatios,
    '16:9',
  );
  const resolution = pick(
    input.settings.resolution,
    model?.capabilities.resolutions,
    '360p',
  );
  const duration = pick(
    input.settings.duration,
    model?.capabilities.durations,
    '8s',
  );
  const thinkingLevel = pick(
    input.settings.thinkingLevel,
    model?.capabilities.thinkingLevels,
    'low',
  );

  const body: Record<string, unknown> = {
    model: input.model,
    input: contents.length === 1 && contents[0].type === 'text'
      ? input.prompt.trim()
      : contents,
    response_format: {
      type: 'video',
      aspect_ratio: aspectRatio,
      resolution,
      duration,
    },
    store: true,
    generation_config: {
      thinking_level: thinkingLevel,
    },
  };

  if (input.previousInteractionId) {
    body.previous_interaction_id = input.previousInteractionId;
  } else {
    const generationConfig = body.generation_config as Record<string, unknown>;
    generationConfig.video_config = {
      task: input.frames.length ? 'image_to_video' : 'text_to_video',
    };
  }

  return body;
}

@Injectable()
export class GeminiVideoProvider implements VideoProvider {
  readonly id = 'gemini';
  private readonly logger = new Logger(GeminiVideoProvider.name);

  constructor(
    private readonly gemini: GeminiService,
    @Optional() private readonly aiUsage?: AiUsageService,
  ) {}

  async generate(input: VideoGenerateRequest): Promise<VideoGenerateResult> {
    if (!this.gemini.configured) {
      throw new Error(
        'GEMINI_API_KEY não configurada. Defina no .env (Google AI Studio).',
      );
    }

    const model = this.gemini.normalizeModel(input.model);
    const videoSeconds = parseDurationSeconds(input.settings?.duration);
    await this.aiUsage?.assertWithinBudget();
    if (isVeoVideoModel(model)) {
      try {
        const result = await generateVeoVideo({ ...input, model }, this.gemini.apiKey);
        await this.aiUsage?.recordCall({
          model,
          kind: AI_USAGE_KIND.video,
          status: AI_USAGE_STATUS.estimated,
          videoSeconds: videoSeconds || 8,
        });
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Veo video failed: ${message}`);
        throw error instanceof Error ? error : new Error(message);
      }
    }

    const url = `${GEMINI_BASE}/interactions`;
    const body = buildGeminiVideoRequest({ ...input, model });

    try {
      const res = await axios.post(url, body, {
        params: { key: this.gemini.apiKey },
        timeout: GENERATE_TIMEOUT_MS,
        maxContentLength: MAX_BODY_BYTES,
        maxBodyLength: MAX_BODY_BYTES,
        signal: input.signal,
      });
      const parts = extractGeminiVideoParts(res.data);
      const summary = summarizeGeminiVideoParts(parts);
      if (!summary.videos.length && !summary.text) {
        const block = geminiVideoBlockReason(res.data);
        throw new Error(
          block
            ? `Gemini bloqueou a resposta: ${block}`
            : 'Gemini retornou resposta vazia',
        );
      }
      const usage = extractGeminiUsage(res.data);
      await this.aiUsage?.recordCall({
        model,
        kind: AI_USAGE_KIND.video,
        status: AI_USAGE_STATUS.billed,
        usage,
        videoSeconds,
      });
      return {
        ...summary,
        interactionId: geminiInteractionId(res.data),
        usage,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 0;
        if (status >= 400) {
          await this.aiUsage?.recordCall({
            model,
            kind: AI_USAGE_KIND.video,
            status: AI_USAGE_STATUS.failedUnbilled,
            httpStatus: status,
          });
        }
        const raw =
          typeof error.response?.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response?.data || '');
        const message = geminiHttpError(status, raw) || error.message;
        this.logger.warn(`Gemini video failed: ${message}`);
        throw new Error(message);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

function pick(
  value: string,
  allowed: readonly string[] | undefined,
  fallback: string,
): string {
  if (allowed?.includes(value)) return value;
  if (allowed?.includes(fallback)) return fallback;
  return allowed?.[0] || fallback;
}
