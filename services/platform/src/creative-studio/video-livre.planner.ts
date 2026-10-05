import {
  clampVideoTakeCount,
  MAX_VIDEO_TAKES,
  MIN_VIDEO_TAKES,
} from '../content-plan/content-plan.contract';

export { clampVideoTakeCount, MAX_VIDEO_TAKES, MIN_VIDEO_TAKES };

export const VIDEO_LIVRE_CLIP_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type VideoLivreClipStatus =
  (typeof VIDEO_LIVRE_CLIP_STATUS)[keyof typeof VIDEO_LIVRE_CLIP_STATUS];

export type VideoLivreRefineInput = {
  brief: string;
  note?: string;
  videoHookTitle?: string;
  noCharacterVoice?: boolean;
};

export type VideoLivreRefineResult = {
  title: string;
  productionPrompt: string;
};

export type VideoLivreBreakInput = {
  script: string;
  takeCount: number;
  videoHookTitle?: string;
  noCharacterVoice?: boolean;
};

export type VideoLivreBreakTake = {
  id: string;
  label: string;
  beat: string;
  productionPrompt: string;
};

export type VideoLivreBreakResult = {
  takes: VideoLivreBreakTake[];
};

export const NO_CHARACTER_VOICE_INSTRUCTION =
  'Sem fala do personagem: só visual. Sem diálogo, voice-over, narração ou labial falado. Áudio ambiente sutil no máximo; o personagem age em silêncio.';

export function applyNoCharacterVoice(
  prompt: string,
  enabled?: boolean,
): string {
  const text = String(prompt || '').trim();
  if (!enabled) return text;
  if (!text) return NO_CHARACTER_VOICE_INSTRUCTION;
  if (text.includes(NO_CHARACTER_VOICE_INSTRUCTION)) return text;
  return `${text}\n\n${NO_CHARACTER_VOICE_INSTRUCTION}`;
}

export function buildVideoLivreRefinePrompt(input: VideoLivreRefineInput): string {
  const brief = String(input.brief || '').trim();
  const note = String(input.note || '').trim();
  const hook = String(input.videoHookTitle || '').trim();
  return [
    'Você é um diretor de conteúdo para Reels/TikTok (9:16).',
    'A partir do briefing, produza um roteiro curto de vídeo pronto para geração.',
    'Responda APENAS JSON com o shape:',
    '{ "title": string, "productionPrompt": string }',
    '',
    'Regras:',
    '- title: até 80 caracteres, em português.',
    '- productionPrompt: briefing de produção em português (ou misto com inglês técnico de câmera se útil), 2–6 frases.',
    '- Inclua assunto, ação, câmera, ritmo e CTA se fizer sentido.',
    '- Não invente marca, produto ou personagem que o briefing não cite.',
    input.noCharacterVoice
      ? '- Sem fala do personagem: descreva só ação visual; sem diálogo, voice-over ou labial falado.'
      : '',
    hook
      ? `- Há um hook visual selecionado (${hook}): preserve o assunto do briefing; o estilo de câmera/mundo será aplicado depois.`
      : '',
    note ? `- Pedido de ajuste: ${note}` : '',
    '',
    'Briefing:',
    brief || '(vazio)',
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseVideoLivreRefine(value: unknown): VideoLivreRefineResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Resposta inválida do refine');
  }
  const row = value as Record<string, unknown>;
  const title = String(row.title || '').trim().slice(0, 80);
  const productionPrompt = String(row.productionPrompt || '').trim().slice(0, 8000);
  if (!productionPrompt) {
    throw new Error('productionPrompt vazio');
  }
  return {
    title: title || productionPrompt.slice(0, 60),
    productionPrompt,
  };
}

export function buildVideoLivreBreakPrompt(input: VideoLivreBreakInput): string {
  const count = clampVideoTakeCount(input.takeCount);
  const script = String(input.script || '').trim();
  const hook = String(input.videoHookTitle || '').trim();
  const hookBlock = hook
    ? [
        `HOOK VISUAL selecionado (${hook}): preserve o assunto; aplique a mesma linguagem de câmera/mundo em TODAS as takes.`,
        'O estilo será reforçado depois; não force props do exemplo do hook.',
      ].join('\n')
    : '';
  return [
    `Você parte UM roteiro de Reel/TikTok 9:16 em EXATAMENTE ${count} takes de vídeo.`,
    'Cada take dura ~8 a 10 segundos e precisa funcionar sozinha (início, meio, fim claros).',
    'CONTINUIDADE LINEAR OBRIGATÓRIA:',
    '- As takes formam uma sequência contínua do mesmo assunto, personagem e cenário.',
    '- Sem mudanças bruscas de look, iluminação, fantasia ou ângulo entre takes consecutivas.',
    '- Take N deve parecer a continuação natural da take N-1 (ponte visual/ação clara).',
    '- Arco: take 1 prende (hook), takes do meio desenvolvem, a última fecha com CTA.',
    input.noCharacterVoice
      ? '- Sem fala do personagem em TODAS as takes: só ação visual; sem diálogo, voice-over ou labial falado.'
      : '',
    'Não repita o mesmo gag nem a mesma ação em takes diferentes.',
    'Português do Brasil. Não invente marca, WhatsApp, @ ou depoimento que o roteiro não cite.',
    'productionPrompt é o briefing concreto enviado ao modelo de vídeo (câmera, ação, fala se houver, ritmo). Máximo ~80 palavras por take.',
    'label curto (ex.: "Take 1 · Hook"). beat = uma frase do que acontece.',
    'Responda APENAS um JSON:',
    '{',
    '  "takes": [',
    '    {',
    '      "id": "take-1",',
    '      "label": "Take 1 · Hook",',
    '      "beat": "o que acontece neste clip",',
    '      "productionPrompt": "briefing de geração do clip"',
    '    }',
    '  ]',
    '}',
    hookBlock,
    '',
    'ROTEIRO:',
    script || '(vazio)',
    '',
    `QUANTIDADE OBRIGATÓRIA DE TAKES: ${count}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseVideoLivreBreak(
  value: unknown,
  takeCount: number,
): VideoLivreBreakResult {
  const count = clampVideoTakeCount(takeCount);
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta inválida do break');
  }
  const row = value as Record<string, unknown>;
  const rawTakes = Array.isArray(row.takes)
    ? row.takes
    : Array.isArray(value)
      ? value
      : [];
  const takes: VideoLivreBreakTake[] = [];
  for (let index = 0; index < rawTakes.length && takes.length < count; index += 1) {
    const entry = rawTakes[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const take = entry as Record<string, unknown>;
    const productionPrompt = String(
      take.productionPrompt || take.prompt || '',
    )
      .trim()
      .slice(0, 4000);
    const beat = String(take.beat || '').trim().slice(0, 400);
    if (!productionPrompt) continue;
    takes.push({
      id:
        String(take.id || `take-${takes.length + 1}`).trim().slice(0, 64) ||
        `take-${takes.length + 1}`,
      label:
        String(take.label || `Take ${takes.length + 1}`).trim().slice(0, 120) ||
        `Take ${takes.length + 1}`,
      beat: beat || productionPrompt.slice(0, 120),
      productionPrompt,
    });
  }
  while (takes.length < count) {
    const index = takes.length;
    takes.push({
      id: `take-${index + 1}`,
      label:
        index === 0
          ? 'Take 1 · Hook'
          : index === count - 1
            ? `Take ${count} · CTA`
            : `Take ${index + 1}`,
      beat: `Parte ${index + 1} do roteiro`,
      productionPrompt: '',
    });
  }
  if (!takes.some((take) => take.productionPrompt)) {
    throw new Error('takes vazias');
  }
  return { takes: takes.slice(0, count) };
}
