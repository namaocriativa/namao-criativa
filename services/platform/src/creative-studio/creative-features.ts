export const FLYER_VENDA_LANDING_ID = 'flyer-venda-landing';
export const PERSONAGENS_ID = 'personagens';
export const MOVIES_ID = 'movies';
export const INICIO_FIM_ID = 'inicio-fim';
export const UGC_SKILLS_ID = 'ugc-skills';
export const PLAYGROUND_IMAGEM_ID = 'playground-imagem';
export const PLAYGROUND_VIDEO_ID = 'playground-video';

export type CreativeFeatureKind = 'image' | 'video';
export type CreativeFeatureStatus = 'ready' | 'soon';
export type CreativeComposerField = 'lead' | 'packages' | 'notes' | 'prompt';

export type CreativeFeatureDefinition = {
  id: string;
  kind: CreativeFeatureKind;
  title: string;
  description: string;
  status: CreativeFeatureStatus;
  composer: CreativeComposerField[];
  projectKind: 'image' | 'video';
  defaults?: {
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
    duration?: string;
    resolution?: string;
  };
};

export const CREATIVE_FEATURES: CreativeFeatureDefinition[] = [
  {
    id: PLAYGROUND_IMAGEM_ID,
    kind: 'image',
    title: 'Imagem livre',
    description:
      'Chat aberto com a LLM. A imagem só nasce depois da confirmação.',
    status: 'ready',
    composer: ['prompt'],
    projectKind: 'image',
  },
  {
    id: FLYER_VENDA_LANDING_ID,
    kind: 'image',
    title: 'Flyer de venda',
    description:
      'Peça personalizada da Namão para vender site e pacotes ao lead, com foto, nicho e oferta.',
    status: 'ready',
    composer: ['lead', 'packages', 'notes'],
    projectKind: 'image',
    defaults: {
      model: 'gemini-3-pro-image',
      aspectRatio: '2:3',
      imageSize: '2K',
    },
  },
  {
    id: PERSONAGENS_ID,
    kind: 'image',
    title: 'Personagens',
    description:
      'Crie identidades reutilizáveis e gere fotos e vídeos do mesmo personagem.',
    status: 'ready',
    composer: ['prompt'],
    projectKind: 'image',
    defaults: {
      model: 'gemini-3-pro-image',
      aspectRatio: '3:4',
      imageSize: '1K',
    },
  },
  {
    id: PLAYGROUND_VIDEO_ID,
    kind: 'video',
    title: 'Vídeo livre',
    description:
      'Chat aberto com a LLM. O vídeo só nasce depois da confirmação.',
    status: 'ready',
    composer: ['prompt'],
    projectKind: 'video',
  },
  {
    id: MOVIES_ID,
    kind: 'video',
    title: 'Filmes',
    description:
      'Storyboard de takes com personagens, cenário, ação e fala.',
    status: 'ready',
    composer: ['prompt'],
    projectKind: 'video',
    defaults: {
      model: 'gemini-omni-1.1-flash',
      aspectRatio: '16:9',
      duration: '8s',
      resolution: '360p',
    },
  },
  {
    id: INICIO_FIM_ID,
    kind: 'video',
    title: 'Início e fim',
    description:
      'Clipe interpolando o quadro inicial até o quadro final.',
    status: 'ready',
    composer: ['prompt'],
    projectKind: 'video',
    defaults: {
      model: 'gemini-omni-1.1-flash',
      aspectRatio: '16:9',
      duration: '5s',
      resolution: '360p',
    },
  },
  {
    id: UGC_SKILLS_ID,
    kind: 'video',
    title: 'UGC Skills',
    description:
      'Anúncio vertical estilo UGC: o personagem apresenta o produto para Reels, TikTok e Stories.',
    status: 'ready',
    composer: ['prompt'],
    projectKind: 'video',
    defaults: {
      model: 'gemini-omni-1.1-flash',
      aspectRatio: '9:16',
      duration: '8s',
      resolution: '360p',
    },
  },
];

export function listCreativeFeatures(): CreativeFeatureDefinition[] {
  return CREATIVE_FEATURES;
}

export function findCreativeFeature(
  id: string,
): CreativeFeatureDefinition | undefined {
  return CREATIVE_FEATURES.find((feature) => feature.id === id);
}

export function creativeFeaturesByKind(
  kind: CreativeFeatureKind,
): CreativeFeatureDefinition[] {
  return CREATIVE_FEATURES.filter((feature) => feature.kind === kind);
}
