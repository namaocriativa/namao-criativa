import { clampSlideCount } from '../creative-studio/carousel-instagram.planner';
import { estimateImageCost, findImageModel } from '../image-studio/image-models';
import { DEFAULT_USD_TO_BRL } from '../ai-usage/ai-usage.period';
import { estimateVideoCost, findVideoModel } from '../video-studio/video-models';
import { parseStoredFormat } from './content-plan.contract';

const LLM_PRICES: Record<string, { in: number; out: number }> = {
  'gemini-2.5-pro': { in: 1.25, out: 10 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-flash-lite': { in: 0.1, out: 0.4 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
};

const DEFAULT_LLM = { in: 0.3, out: 2.5 };

export type ProduceEstimateQuery = {
  format?: string;
  slides?: string | number;
  takes?: string | number;
  planModel?: string;
  imageModel?: string;
  imageSize?: string;
  videoModel?: string;
  duration?: string;
  resolution?: string;
};

export type ProduceEstimateStage = {
  id: string;
  label: string;
  detail: string;
  model: string;
  modelLabel: string;
  count: number;
  unitUsd: number;
  usd: number;
};

export type ProduceEstimate = {
  usd: number;
  brl: number;
  label: string;
  stages: ProduceEstimateStage[];
};

export function estimateProduce(input: ProduceEstimateQuery): ProduceEstimate {
  const format = parseStoredFormat(input.format);
  const stages: ProduceEstimateStage[] =
    format === 'reel'
      ? [videoStage(input)]
      : format === 'static'
        ? [imageStage(input, 1)]
        : [planStage(input), imageStage(input, clampSlideCount(input.slides))];
  const usd = Number(stages.reduce((sum, stage) => sum + stage.usd, 0).toFixed(2));
  const brl = Number((usd * DEFAULT_USD_TO_BRL).toFixed(2));
  const imageCount = stages
    .filter((stage) => stage.id === 'slides' || stage.id === 'image')
    .reduce((sum, stage) => sum + stage.count, 0);
  const totalNote =
    imageCount > 1
      ? `Estimativa das ${imageCount} imagens`
      : imageCount === 1
        ? 'Estimativa da imagem'
        : stages.some((stage) => stage.id === 'video' && stage.count > 1)
          ? `Estimativa dos ${stages.find((stage) => stage.id === 'video')?.count} vídeos`
          : 'Estimativa';
  return {
    usd,
    brl,
    label: `${totalNote} ~US$ ${usd.toFixed(2)} · ~R$ ${brl.toFixed(2).replace('.', ',')}`,
    stages,
  };
}

function planStage(input: ProduceEstimateQuery): ProduceEstimateStage {
  const model = String(input.planModel || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';
  const usd = estimateLlmUsd(model);
  return {
    id: 'plan',
    label: 'Roteiro',
    detail: '',
    model,
    modelLabel: shortModel(model),
    count: 1,
    unitUsd: usd,
    usd,
  };
}

function imageStage(input: ProduceEstimateQuery, count: number): ProduceEstimateStage {
  const model = String(input.imageModel || 'gemini-3-pro-image').trim() || 'gemini-3-pro-image';
  const found = findImageModel(model);
  const n = Math.max(1, count);
  const cost = estimateImageCost({
    model,
    imageSize: input.imageSize,
    count: n,
  });
  const per = money(cost.usdPerImage, 3);
  return {
    id: n > 1 ? 'slides' : 'image',
    label: n > 1 ? `${n} imagens` : 'Imagem 4:5',
    detail: n > 1 ? `${n} × ~US$ ${per} · ${cost.imageSize}` : `${cost.imageSize} · ~US$ ${per}`,
    model,
    modelLabel: found?.label || shortModel(model),
    count: n,
    unitUsd: cost.usdPerImage,
    usd: cost.usdTotal,
  };
}

function videoStage(input: ProduceEstimateQuery): ProduceEstimateStage {
  const model = String(input.videoModel || 'gemini-omni-1.1-flash').trim() || 'gemini-omni-1.1-flash';
  const duration = String(input.duration || '8s').trim() || '8s';
  const resolution = String(input.resolution || '360p').trim() || '360p';
  const takeCount = Math.max(1, Math.min(5, Math.round(Number(input.takes) || 1)));
  const found = findVideoModel(model);
  const cost = estimateVideoCost({
    model,
    duration,
    resolution,
    thinkingLevel: 'low',
  });
  const usd = Number((cost.usdTotal * takeCount).toFixed(2));
  return {
    id: 'video',
    label:
      takeCount > 1
        ? `${takeCount} vídeos ${duration} · 9:16`
        : `Vídeo ${duration} · 9:16`,
    detail:
      takeCount > 1
        ? `${takeCount} × ~US$ ${money(cost.usdTotal, 2)} · ${resolution}`
        : `${resolution} · ~US$ ${money(cost.usdPerSecond, 3)}/s`,
    model,
    modelLabel: found?.label || shortModel(model),
    count: takeCount,
    unitUsd: cost.usdTotal,
    usd,
  };
}

function estimateLlmUsd(model: string, inputTokens = 4000, outputTokens = 2500): number {
  const price = LLM_PRICES[model] || DEFAULT_LLM;
  const usd =
    (inputTokens / 1_000_000) * price.in + (outputTokens / 1_000_000) * price.out;
  return Number(usd.toFixed(2));
}

function shortModel(id: string): string {
  return id.replace(/^gemini-/i, 'Gemini ').replace(/-/g, ' ');
}

function money(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',');
}
