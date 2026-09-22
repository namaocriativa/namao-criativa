import axios from 'axios';
import { geminiHttpError } from '../llm/gemini-sse';
import { durationSeconds, findVideoModel } from './video-models';
import type {
  VideoGenerateRequest,
  VideoGenerateResult,
} from './video-provider';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const POLL_MS = 10_000;
const MAX_WAIT_MS = 600_000;
const MAX_BODY_BYTES = 80 * 1024 * 1024;

type VeoInlineImage = {
  inlineData: { mimeType: string; data: string };
};

type VeoSampleVideo = {
  uri?: string;
  encodedVideo?: string;
  bytesBase64Encoded?: string;
  mimeType?: string;
  videoBytes?: string;
};

type VeoSample = {
  video?: VeoSampleVideo;
  bytesBase64Encoded?: string;
};

type VeoOperation = {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: VeoSample[];
      raiMediaFilteredReasons?: string[];
    };
    generatedVideos?: VeoSample[];
  };
};

export function buildVeoVideoRequest(
  input: VideoGenerateRequest,
): { model: string; body: Record<string, unknown> } {
  const model = findVideoModel(input.model);
  const aspectRatio = pick(
    input.settings.aspectRatio,
    model?.capabilities.aspectRatios,
    '16:9',
  );
  const resolution = pick(
    input.settings.resolution,
    model?.capabilities.resolutions,
    '720p',
  );
  const duration = pick(
    input.settings.duration,
    model?.capabilities.durations,
    '8s',
  );
  const seconds = durationSeconds(duration) || 8;
  const first = input.frames[0];
  const last = input.frames[1];
  const instance: Record<string, unknown> = {
    prompt: input.prompt.trim(),
  };
  if (first?.data) {
    instance.image = veoImage(first.mimeType, first.data);
  }
  if (last?.data) {
    instance.lastFrame = veoImage(last.mimeType, last.data);
  }

  return {
    model: input.model.replace(/^models\//, '').trim(),
    body: {
      instances: [instance],
      parameters: {
        aspectRatio,
        durationSeconds: seconds,
        resolution,
        personGeneration: input.frames.length ? 'allow_adult' : 'allow_all',
      },
    },
  };
}

export function veoOperationError(data: unknown): string | undefined {
  const op = data as VeoOperation;
  if (op.error?.message) return op.error.message;
  const reasons = op.response?.generateVideoResponse?.raiMediaFilteredReasons;
  if (reasons?.length) return reasons.filter(Boolean).join('; ');
  return undefined;
}

export function extractVeoGeneratedVideo(data: unknown): {
  uri?: string;
  base64?: string;
  mimeType: string;
} | undefined {
  const op = data as VeoOperation;
  const sample =
    op.response?.generateVideoResponse?.generatedSamples?.[0] ||
    op.response?.generatedVideos?.[0];
  if (!sample) return undefined;
  const video = sample.video || {};
  const base64 =
    video.bytesBase64Encoded ||
    video.encodedVideo ||
    video.videoBytes ||
    sample.bytesBase64Encoded;
  const uri = typeof video.uri === 'string' ? video.uri.trim() : '';
  if (!uri && !base64) return undefined;
  return {
    uri: uri || undefined,
    base64: base64 || undefined,
    mimeType: video.mimeType || 'video/mp4',
  };
}

export async function generateVeoVideo(
  input: VideoGenerateRequest,
  apiKey: string,
): Promise<VideoGenerateResult> {
  const { model, body } = buildVeoVideoRequest(input);
  const started = Date.now();
  let operation: VeoOperation;
  try {
    const res = await axios.post<VeoOperation>(
      `${GEMINI_BASE}/models/${model}:predictLongRunning`,
      body,
      {
        params: { key: apiKey },
        timeout: 60_000,
        maxBodyLength: MAX_BODY_BYTES,
        signal: input.signal,
      },
    );
    operation = res.data || {};
  } catch (error) {
    throw wrapAxios(error);
  }

  const startError = veoOperationError(operation);
  if (startError) throw new Error(startError);
  const operationName = operation.name?.trim();
  if (!operationName) {
    throw new Error('Veo não devolveu o id da operação');
  }

  while (!operation.done) {
    if (Date.now() - started > MAX_WAIT_MS) {
      throw new Error('Veo excedeu o tempo de geração');
    }
    await sleep(POLL_MS, input.signal);
    try {
      const res = await axios.get<VeoOperation>(
        veoOperationUrl(operationName),
        {
          params: { key: apiKey },
          timeout: 30_000,
          signal: input.signal,
        },
      );
      operation = res.data || {};
    } catch (error) {
      throw wrapAxios(error);
    }
    const pollError = veoOperationError(operation);
    if (pollError) throw new Error(pollError);
  }

  const generated = extractVeoGeneratedVideo(operation);
  if (!generated) {
    throw new Error('Veo retornou resposta vazia');
  }

  let buffer: Buffer;
  let mimeType = generated.mimeType;
  if (generated.base64) {
    buffer = Buffer.from(generated.base64, 'base64');
  } else if (generated.uri) {
    const downloaded = await downloadVeoVideo(generated.uri, apiKey, input.signal);
    buffer = downloaded.buffer;
    mimeType = downloaded.mimeType || mimeType;
  } else {
    throw new Error('Veo retornou resposta vazia');
  }

  return {
    text: '',
    thoughts: '',
    videos: [{ mimeType, buffer }],
  };
}

async function downloadVeoVideo(
  uri: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const res = await axios.get<ArrayBuffer>(uri, {
      params: { key: apiKey },
      responseType: 'arraybuffer',
      timeout: 120_000,
      maxContentLength: MAX_BODY_BYTES,
      signal,
      headers: { Accept: 'video/mp4,application/octet-stream,*/*' },
    });
    const mimeType =
      String(res.headers['content-type'] || '')
        .split(';')[0]
        .trim() || 'video/mp4';
    return { buffer: Buffer.from(res.data), mimeType };
  } catch (error) {
    throw wrapAxios(error);
  }
}

function veoOperationUrl(name: string): string {
  if (/^https?:\/\//i.test(name)) return name;
  return `${GEMINI_BASE}/${name.replace(/^\//, '')}`;
}

function veoImage(mimeType: string, data: string): VeoInlineImage {
  return {
    inlineData: {
      mimeType: mimeType || 'image/png',
      data,
    },
  };
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

function wrapAxios(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 0;
    const raw =
      typeof error.response?.data === 'string'
        ? error.response.data
        : Buffer.isBuffer(error.response?.data)
          ? error.response.data.toString('utf8')
          : JSON.stringify(error.response?.data || '');
    return new Error(geminiHttpError(status, raw) || error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
