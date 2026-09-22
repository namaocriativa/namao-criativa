import { INICIO_FIM_ID } from './creative-features';

export const START_END_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type StartEndStatus =
  (typeof START_END_STATUS)[keyof typeof START_END_STATUS];

export type InicioFimPromptInput = {
  prompt?: string;
  duration: string;
};

export function inicioFimPrompt(input: InicioFimPromptInput): string {
  const motion =
    input.prompt?.trim() ||
    'transição cinematográfica suave e contínua entre os dois quadros';
  const duration = input.duration.trim() || '5s';
  return [
    `Gere um clipe de ${duration} interpolando o primeiro quadro (imagem inicial) até o segundo quadro (imagem final).`,
    `Movimento: ${motion}.`,
    'A primeira imagem anexada é o quadro de abertura. A segunda imagem anexada é o quadro de encerramento.',
    'Mantenha identidade, iluminação e composição coerentes entre os dois extremos.',
    'Não adicione texto na tela. Áudio ambiente sutil, sem fala, a menos que o pedido descreva diálogo.',
    `Feature ${INICIO_FIM_ID}.`,
  ].join(' ');
}
