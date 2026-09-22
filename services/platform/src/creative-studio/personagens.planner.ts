import { PERSONAGENS_ID } from './creative-features';

export const CHARACTER_ASSET_KIND = {
  UPLOAD: 'upload',
  SHEET: 'sheet',
  PHOTO: 'photo',
  VIDEO: 'video',
} as const;

export type CharacterAssetKind =
  (typeof CHARACTER_ASSET_KIND)[keyof typeof CHARACTER_ASSET_KIND];

export const CHARACTER_IMAGE_SYSTEM_INSTRUCTION = [
  'Você gera o mesmo personagem em todas as imagens.',
  'Trave identidade: rosto, idade aparente, etnia, corpo, cabelo, olhos, marcas e o figurino-assinatura descritos nas referências e no briefing.',
  'Não invente outra pessoa, não suavize traços e não mude o corte de cabelo sem pedido explícito.',
  'As imagens anexadas são a verdade visual. Copie o rosto com fidelidade fotográfica.',
  'Uma única imagem por resposta, nítida, sem texto na arte, sem marca d’água e sem colagem de várias poses.',
].join(' ');

export type CharacterIdentityInput = {
  name: string;
  appearance: string;
  personality?: string;
};

export function buildCharacterIdentityPrompt(
  input: CharacterIdentityInput,
): string {
  const name = input.name.trim();
  const appearance = input.appearance.trim();
  const personality = input.personality?.trim() || '';
  const lines = [
    `Personagem canônico: ${name}.`,
    `Aparência travada: ${appearance}.`,
  ];
  if (personality) lines.push(`Personalidade e presença: ${personality}.`);
  lines.push(
    'Mantenha esta identidade em qualquer pose, cenário, figurino extra ou ângulo.',
  );
  return lines.join(' ');
}

export function characterPortraitPrompt(input: CharacterIdentityInput): string {
  const identity = buildCharacterIdentityPrompt(input);
  return [
    `Retrato de ficha do personagem ${input.name.trim()}, 3/4 de corpo, olhando para a câmera.`,
    'Iluminação de estúdio suave, fundo neutro limpo, pose natural e reconhecível.',
    'Esta imagem vira a referência-mestre da identidade.',
    identity,
    `Feature ${PERSONAGENS_ID}.`,
  ].join(' ');
}

export function characterPhotoPrompt(
  input: CharacterIdentityInput,
  scene: string,
): string {
  const identity = buildCharacterIdentityPrompt(input);
  const action = scene.trim() || 'retrato em novo ângulo, mesmo personagem';
  return [
    `Fotografe o personagem ${input.name.trim()} exatamente como nas referências.`,
    `Cena: ${action}.`,
    identity,
    'O rosto e o corpo precisam ser os mesmos da ficha. Sem personagem extra no centro.',
  ].join(' ');
}

export function characterVideoPrompt(
  input: CharacterIdentityInput,
  action: string,
): string {
  const identity = buildCharacterIdentityPrompt(input);
  const motion = action.trim() || 'o personagem respira, pisca e olha para a câmera';
  return [
    `Vídeo curto do personagem ${input.name.trim()}, identidade idêntica ao quadro inicial e às referências.`,
    `Ação: ${motion}.`,
    identity,
    'Câmera estável, movimento natural, sem morphing de rosto e sem trocar o elenco.',
  ].join(' ');
}

export function mergeCharacterSystemInstruction(
  extra?: string | null,
): string {
  const extraText = extra?.trim() || '';
  if (!extraText) return CHARACTER_IMAGE_SYSTEM_INSTRUCTION;
  return `${CHARACTER_IMAGE_SYSTEM_INSTRUCTION}\n${extraText}`;
}
