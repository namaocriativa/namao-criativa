import { UGC_SKILLS_ID } from './creative-features';
import {
  buildCharacterIdentityPrompt,
  type CharacterIdentityInput,
} from './personagens.planner';
import {
  hasReelBeats,
  overlayRule,
  parseReelPrompt,
  type ReelBeats,
} from './reel-script';

export const UGC_CLIP_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type UgcClipStatus =
  (typeof UGC_CLIP_STATUS)[keyof typeof UGC_CLIP_STATUS];

export type UgcSkillsPromptInput = CharacterIdentityInput &
  ReelBeats & {
    prompt?: string;
    duration: string;
    identityPrompt?: string;
  };

export function ugcSkillsPrompt(input: UgcSkillsPromptInput): string {
  const identity = buildCharacterIdentityPrompt(input);
  const extra = input.identityPrompt?.trim() || '';
  const parsed = parseReelPrompt(input.prompt);
  const beats: ReelBeats = {
    hook: input.hook?.trim() || parsed.hook,
    story: input.story?.trim() || parsed.story,
    cta: input.cta?.trim() || parsed.cta,
    overlayText: input.overlayText?.trim() || parsed.overlayText,
  };
  const request = hasReelBeats(beats)
    ? [
        beats.hook ? `Hook (0–2s): ${beats.hook}` : '',
        beats.story ? `História: ${beats.story}` : '',
        beats.cta ? `CTA falado no fecho: ${beats.cta}` : '',
        parsed.extra,
      ]
        .filter(Boolean)
        .join('. ')
    : input.prompt?.trim() ||
      'o criador olha para a câmera, mostra o produto e convida a comprar';
  const duration = input.duration.trim() || '8s';
  const overlay = overlayRule(beats.overlayText);
  return [
    `Gere um clipe de anúncio UGC de ${duration} para Reels, TikTok e Stories.`,
    `A primeira imagem anexada é o criador: ${input.name.trim()}. Mantenha o mesmo rosto, corpo e identidade o tempo todo.`,
    'A segunda imagem anexada é a foto do produto. O produto precisa permanecer reconhecível, com forma, cor e marca fiéis.',
    'O criador apresenta, demonstra ou revela o produto. Não transforme a pessoa no produto, não faça morph de identidade e não troque o elenco.',
    hasReelBeats(beats)
      ? 'Câmera handheld estilo UGC, luz natural. Estrutura de retenção: hook nos primeiros 2 segundos, história curta no meio, fecha com CTA falado.'
      : 'Câmera handheld estilo UGC, luz natural, hook nos primeiros 2 segundos, demo do produto, fecha com CTA.',
    `Pedido do operador: ${request}.`,
    identity,
    extra,
    `Fala em português brasileiro com áudio nativo e labial sincronizado se o pedido incluir fala ou CTA falado. ${overlay}`,
    `Feature ${UGC_SKILLS_ID}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
