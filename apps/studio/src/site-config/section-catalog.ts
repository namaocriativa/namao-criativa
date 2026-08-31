export const PRESET_SECTION_IDS = [
  "header",
  "hero",
  "services",
  "about",
  "gallery",
  "testimonials",
  "faq",
  "cta",
  "contact",
  "footer",
] as const;

export type PresetSectionId = (typeof PRESET_SECTION_IDS)[number];

export type LandingSectionConfig = {
  id: string;
  type: string;
  title: string;
  description: string;
  component?: string;
  /** Baixar vídeo stock do nicho (Pexels) quando o hero aceitar vídeo. */
  stockVideo?: boolean;
  media?: {
    images?: string[];
    logo?: string;
    video?: string;
    portraitVideo?: string;
  };
};

export type PresetSectionDefinition = {
  type: PresetSectionId;
  title: string;
  description: string;
  default: boolean;
};

export const CUSTOM_SECTION_TYPE = "custom";

export const PRESET_SECTIONS: PresetSectionDefinition[] = [
  {
    type: "header",
    title: "Header",
    description:
      "Barra fixa com marca/logo, âncoras das demais seções e o CTA principal se houver contato.",
    default: true,
  },
  {
    type: "hero",
    title: "Hero",
    description:
      "Abertura dominante com o nome do negócio, local/categoria, foto real e um CTA. Sem slogans inventados.",
    default: true,
  },
  {
    type: "services",
    title: "Serviços",
    description:
      "Grade com os serviços exatamente como estão no brief. Uma ideia por card.",
    default: true,
  },
  {
    type: "about",
    title: "Sobre",
    description:
      "Texto institucional a partir da description/rating do brief. Sem números inventados.",
    default: true,
  },
  {
    type: "gallery",
    title: "Galeria",
    description:
      "Fotos reais do brief em grade. Sem stock e sem imagens fora do catálogo.",
    default: true,
  },
  {
    type: "testimonials",
    title: "Prova social",
    description:
      "Só evidência real do brief (nota e quantidade de avaliações). Sem depoimentos inventados.",
    default: false,
  },
  {
    type: "faq",
    title: "FAQ",
    description:
      "Perguntas objetivas respondíveis só com fatos do brief. Sem inventar horários ou políticas.",
    default: false,
  },
  {
    type: "cta",
    title: "CTA",
    description:
      "Faixa curta de conversão com o CTA principal do brief (WhatsApp, telefone ou e-mail).",
    default: false,
  },
  {
    type: "contact",
    title: "Contato",
    description:
      "Telefone, WhatsApp, e-mail, endereço e mapa — somente o que existir no brief.",
    default: true,
  },
  {
    type: "footer",
    title: "Footer",
    description: "Rodapé mínimo com nome e cidade. Sem links inventados.",
    default: true,
  },
];

export function slugifySectionId(value: string, fallback = "custom"): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

export function uniqueSectionId(base: string, used: Set<string>): string {
  let id = base || "custom";
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

export function defaultSectionConfigs(): LandingSectionConfig[] {
  return PRESET_SECTIONS.filter((item) => item.default).map((item) => ({
    id: item.type,
    type: item.type,
    title: item.title,
    description: item.description,
  }));
}
