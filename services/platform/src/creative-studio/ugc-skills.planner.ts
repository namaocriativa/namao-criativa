import { UGC_SKILLS_ID } from './creative-features';
import {
  buildCharacterIdentityPrompt,
  type CharacterIdentityInput,
} from './personagens.planner';

export const UGC_CLIP_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type UgcClipStatus =
  (typeof UGC_CLIP_STATUS)[keyof typeof UGC_CLIP_STATUS];

export type UgcSkillsPromptInput = CharacterIdentityInput & {
  prompt?: string;
  duration: string;
  identityPrompt?: string;
};

export function ugcSkillsPrompt(input: UgcSkillsPromptInput): string {
  const identity = buildCharacterIdentityPrompt(input);
  const extra = input.identityPrompt?.trim() || '';
  const request =
    input.prompt?.trim() ||
    'o criador olha para a câmera, mostra o produto e convida a comprar';
  const duration = input.duration.trim() || '8s';
  return [
    `Gere um clipe de anúncio UGC de ${duration} para Reels, TikTok e Stories.`,
    `A primeira imagem anexada é o criador: ${input.name.trim()}. Mantenha o mesmo rosto, corpo e identidade o tempo todo.`,
    'A segunda imagem anexada é a foto do produto. O produto precisa permanecer reconhecível, com forma, cor e marca fiéis.',
    'O criador apresenta, demonstra ou revela o produto. Não transforme a pessoa no produto, não faça morph de identidade e não troque o elenco.',
    'Câmera handheld estilo UGC, luz natural, hook nos primeiros 2 segundos, demo do produto, fecha com CTA.',
    `Pedido do operador: ${request}.`,
    identity,
    extra,
    'Fala em português brasileiro com áudio nativo e labial sincronizado se o pedido incluir fala ou CTA falado. Sem texto na tela.',
    `Feature ${UGC_SKILLS_ID}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
