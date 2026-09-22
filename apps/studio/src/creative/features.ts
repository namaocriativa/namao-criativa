export const FLYER_VENDA_LANDING_ID = "flyer-venda-landing";
export const PERSONAGENS_ID = "personagens";
export const MOVIES_ID = "movies";
export const INICIO_FIM_ID = "inicio-fim";
export const UGC_SKILLS_ID = "ugc-skills";
export const PLAYGROUND_IMAGEM_ID = "playground-imagem";
export const PLAYGROUND_VIDEO_ID = "playground-video";

export type CreativeFeatureKind = "image" | "video";
export type CreativeFeatureStatus = "ready" | "soon";
export type CreativeComposerField = "lead" | "packages" | "notes" | "prompt";

export type CreativeFeatureDefinition = {
  id: string;
  kind: CreativeFeatureKind;
  title: string;
  description: string;
  status: CreativeFeatureStatus;
  composer: CreativeComposerField[];
  projectKind: "image" | "video";
};

export const CREATIVE_FEATURES: CreativeFeatureDefinition[] = [
  {
    id: PLAYGROUND_IMAGEM_ID,
    kind: "image",
    title: "Imagem livre",
    description:
      "Chat com a LLM. A imagem só é gerada depois que você revisar o prompt e confirmar.",
    status: "ready",
    composer: ["prompt"],
    projectKind: "image",
  },
  {
    id: FLYER_VENDA_LANDING_ID,
    kind: "image",
    title: "Flyer de venda",
    description:
      "Peça personalizada da Namão para vender site e pacotes ao lead, com foto, nicho e oferta.",
    status: "ready",
    composer: ["lead", "packages", "notes"],
    projectKind: "image",
  },
  {
    id: PERSONAGENS_ID,
    kind: "image",
    title: "Personagens",
    description:
      "Crie identidades reutilizáveis e gere fotos e vídeos do mesmo personagem.",
    status: "ready",
    composer: ["prompt"],
    projectKind: "image",
  },
  {
    id: PLAYGROUND_VIDEO_ID,
    kind: "video",
    title: "Vídeo livre",
    description:
      "Chat com a LLM. O vídeo só é gerado depois que você revisar o prompt e confirmar.",
    status: "ready",
    composer: ["prompt"],
    projectKind: "video",
  },
  {
    id: MOVIES_ID,
    kind: "video",
    title: "Filmes",
    description:
      "Storyboard de takes com personagens, cenário, ação e fala.",
    status: "ready",
    composer: ["prompt"],
    projectKind: "video",
  },
  {
    id: INICIO_FIM_ID,
    kind: "video",
    title: "Início e fim",
    description:
      "Clipe interpolando o quadro inicial até o quadro final.",
    status: "ready",
    composer: ["prompt"],
    projectKind: "video",
  },
  {
    id: UGC_SKILLS_ID,
    kind: "video",
    title: "UGC Skills",
    description:
      "Anúncio vertical estilo UGC: o personagem apresenta o produto para Reels, TikTok e Stories.",
    status: "ready",
    composer: ["prompt"],
    projectKind: "video",
  },
];

export function creativeFeaturesByKind(
  kind: CreativeFeatureKind,
): CreativeFeatureDefinition[] {
  return CREATIVE_FEATURES.filter((feature) => feature.kind === kind);
}

export function findCreativeFeature(
  id: string,
): CreativeFeatureDefinition | undefined {
  return CREATIVE_FEATURES.find((feature) => feature.id === id);
}

export function isPlaygroundFeature(id?: string | null): boolean {
  return !id || id === PLAYGROUND_IMAGEM_ID || id === PLAYGROUND_VIDEO_ID;
}

export function isVideoCreativeSkill(id?: string | null): boolean {
  return findCreativeFeature(id || "")?.kind === "video";
}

export function creativeSkillFeatures(
  kind: CreativeFeatureKind,
): CreativeFeatureDefinition[] {
  return creativeFeaturesByKind(kind).filter(
    (feature) => feature.status === "ready" && !isPlaygroundFeature(feature.id),
  );
}
