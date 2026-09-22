import { MOVIES_ID } from './creative-features';
import {
  buildCharacterIdentityPrompt,
  type CharacterIdentityInput,
} from './personagens.planner';

export const MOVIE_SHOT_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type MovieShotStatus =
  (typeof MOVIE_SHOT_STATUS)[keyof typeof MOVIE_SHOT_STATUS];

export type MovieShotPromptInput = {
  characters: CharacterIdentityInput[];
  scene: string;
  action: string;
  dialogue?: string;
};

export function movieShotPrompt(input: MovieShotPromptInput): string {
  const cast = input.characters.filter((item) => item.name.trim());
  const names = cast.map((item) => item.name.trim());
  const ensemble =
    names.length > 1
      ? `Cena de filme com elenco: ${names.join(', ')}.`
      : `Cena de filme com um único protagonista: ${names[0] || 'o personagem'}.`;
  const identities = cast
    .map((item, index) => {
      const identity = buildCharacterIdentityPrompt(item);
      return names.length > 1
        ? `Elenco ${index + 1}, ${item.name.trim()}: ${identity}`
        : identity;
    })
    .join(' ');
  const scene = input.scene.trim() || 'cenário cinematográfico limpo';
  const action =
    input.action.trim() ||
    (names.length > 1
      ? 'o elenco respira e olha para a câmera'
      : 'o personagem respira e olha para a câmera');
  const dialogue = input.dialogue?.trim() || '';
  const lines = [
    ensemble,
    `Cenário: ${scene}.`,
    `Ação: ${action}.`,
    identities,
    names.length > 1
      ? 'As imagens anexadas na ordem são os retratos do elenco. Cada pessoa precisa aparecer com o próprio rosto, sem fundir identidades.'
      : 'Câmera cinematográfica, movimento natural, continuidade de identidade com o quadro inicial.',
    'Não troque o elenco, não invente outro rosto e não coloque texto na tela.',
    `Feature ${MOVIES_ID}.`,
  ];
  if (dialogue) {
    lines.splice(
      3,
      0,
      `Fala em português brasileiro, áudio nativo e labial sincronizado: "${dialogue}".`,
    );
  }
  return lines.filter(Boolean).join(' ');
}
