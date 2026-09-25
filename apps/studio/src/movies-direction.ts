export const DEFAULT_MOVIE_FRAMING = "plano_medio";
export const DEFAULT_MOVIE_CAMERA = "fixa";

export type MovieDirectionOption = {
  id: string;
  label: string;
  short: string;
  hint: string;
};

export const MOVIE_FRAMINGS: MovieDirectionOption[] = [
  {
    id: "plano_geral",
    label: "Plano geral",
    short: "PG",
    hint: "Plano geral: corpo inteiro e o ambiente, para situar a cena.",
  },
  {
    id: "plano_medio",
    label: "Plano médio",
    short: "PM",
    hint: "Plano médio: da cintura para cima, pessoa e contexto no quadro.",
  },
  {
    id: "close",
    label: "Close",
    short: "Close",
    hint: "Close: rosto preenchendo o quadro, foco na expressão.",
  },
  {
    id: "primeiro_plano",
    label: "Primeiro plano",
    short: "PP",
    hint: "Primeiro plano: ombros e rosto, mais íntimo que o plano médio.",
  },
  {
    id: "detalhe",
    label: "Detalhe",
    short: "Det",
    hint: "Detalhe: insert extremo de um objeto ou parte do corpo.",
  },
];

export const MOVIE_CAMERAS: MovieDirectionOption[] = [
  {
    id: "fixa",
    label: "Fixa",
    short: "Fixa",
    hint: "Fixa: câmera parada no tripé, sem pan nem zoom.",
  },
  {
    id: "pan_l_r",
    label: "Pan esquerda → direita",
    short: "→",
    hint: "Pan esquerda → direita: gira na horizontal nesse sentido.",
  },
  {
    id: "pan_r_l",
    label: "Pan direita → esquerda",
    short: "←",
    hint: "Pan direita → esquerda: gira na horizontal nesse sentido.",
  },
  {
    id: "travelling",
    label: "Travelling",
    short: "Trav",
    hint: "Travelling: desloca de lado acompanhando a ação.",
  },
  {
    id: "dolly_in",
    label: "Dolly in",
    short: "In",
    hint: "Dolly in: aproxima-se lentamente do sujeito.",
  },
  {
    id: "dolly_out",
    label: "Dolly out",
    short: "Out",
    hint: "Dolly out: afasta-se do sujeito.",
  },
  {
    id: "handheld",
    label: "Handheld",
    short: "Hand",
    hint: "Handheld: câmera na mão, com leve tremor natural.",
  },
  {
    id: "orbit",
    label: "Orbit",
    short: "Órb",
    hint: "Orbit: circunda o sujeito.",
  },
];

const framingIds = new Set(MOVIE_FRAMINGS.map((item) => item.id));
const cameraIds = new Set(MOVIE_CAMERAS.map((item) => item.id));

export function resolveMovieFramingId(id?: string | null): string {
  const key = (id || "").trim();
  return framingIds.has(key) ? key : DEFAULT_MOVIE_FRAMING;
}

export function resolveMovieCameraId(id?: string | null): string {
  const key = (id || "").trim();
  return cameraIds.has(key) ? key : DEFAULT_MOVIE_CAMERA;
}
