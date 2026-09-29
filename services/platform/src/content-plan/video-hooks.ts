export type ContentPlanVideoHook = {
  id: string;
  group: string;
  title: string;
  summary: string;
  example: string;
  prompt: string;
};

export const CONTENT_PLAN_VIDEO_HOOKS: ContentPlanVideoHook[] = [
  {
    id: 'stunt-cinematic',
    group: 'Background estilo stunt viral',
    title: 'Realista / cinematográfico',
    summary:
      'FPV de adrenalina, céu aberto, trepidação de câmera. O assunto da peça entra nesse visual.',
    example:
      'Viral da cadeira de escritório amarrada a um avião — referência da linguagem, não a cena obrigatória.',
    prompt:
      'Apply this VISUAL LANGUAGE to the subject of the brief (the selected character if any, otherwise the person, product or story of the piece). Do NOT reproduce the famous office-chair-tied-to-a-propeller-plane stunt unless the script explicitly asks for that prop. Language: cinematic FPV / drone videography of extreme sports — open sky, dramatic clouds below, height and speed, kinetic tension (ropes, harness, cable or equivalent physics), slight camera shake, adrenaline sports lighting. The subject occupies the role of the stunt body. Camera flies with them. Keep the piece message; only world, camera and energy change.',
  },
  {
    id: 'stunt-pixar',
    group: 'Background estilo stunt viral',
    title: 'Animação 3D / Pixar',
    summary:
      '3D arredondado, nuvens fofas, cores vivas, física brincalhona. O assunto da peça vira o herói animado.',
    example:
      'Cadeira de madeira puxada por um avião vintage — só ilustra flutuação e puxão, não o set obrigatório.',
    prompt:
      'Apply this VISUAL LANGUAGE to the subject of the brief. Do NOT lock the scene to a wooden chair pulled by a vintage airplane unless the script asks for it. Language: 3D Pixar-style animation — rounded forms, fluffy white clouds, bright sunny day, vibrant saturated colors, expressive squash-and-stretch, playful physics, dynamic camera. The subject (character if provided) is the hero of this animated world. The chair-in-the-sky gag is only a reference of buoyancy and pull, not a required set piece. Keep the piece message; only the look changes.',
  },
  {
    id: 'stunt-gta',
    group: 'Background estilo stunt viral',
    title: 'GTA V / games',
    summary:
      'Simulação 3D em terceira pessoa, velocidade, física satisfatória, cores saturadas de game.',
    example:
      'Percurso neon no céu com loopings — gramática do mundo, não o mapa obrigatório.',
    prompt:
      'Apply this VISUAL LANGUAGE to the subject of the brief. Do NOT lock the scene to a neon sky obstacle course unless the script asks for it. Language: hyper-realistic 3D game footage in the style of GTA V — third-person camera, high-speed traversal, satisfying physics, loopings, bright saturated colors, slightly stylized realism. Put the subject (character, vehicle or product from the brief) into that game-world energy. Neon tubes in the sky are a reference of the grammar, not a mandatory map. Keep the piece message; only the look changes.',
  },
];

export function findVideoHook(
  id: string | null | undefined,
): ContentPlanVideoHook | undefined {
  const key = String(id || '').trim();
  if (!key) return undefined;
  return CONTENT_PLAN_VIDEO_HOOKS.find((item) => item.id === key);
}

export function listVideoHooks(): ContentPlanVideoHook[] {
  return CONTENT_PLAN_VIDEO_HOOKS;
}

export function applyVideoHookToPrompt(
  prompt: string,
  hook: ContentPlanVideoHook | undefined,
): string {
  if (!hook) return prompt;
  return `${prompt}\n\nVisual hook (${hook.title}) — style language only; adapt the brief's subject; do not force example props:\n${hook.prompt}`;
}
