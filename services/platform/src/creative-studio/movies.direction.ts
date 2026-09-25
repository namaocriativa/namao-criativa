export const DEFAULT_MOVIE_FRAMING = 'plano_medio';
export const DEFAULT_MOVIE_CAMERA = 'fixa';

export type MovieDirectionOption = {
  id: string;
  label: string;
  short: string;
  prompt: string;
};

export const MOVIE_FRAMINGS = [
  {
    id: 'plano_geral',
    label: 'Plano geral',
    short: 'PG',
    prompt:
      'Enquadramento: plano geral, corpo inteiro e ambiente visíveis, establishing shot, sujeito nítido no quadro.',
  },
  {
    id: 'plano_medio',
    label: 'Plano médio',
    short: 'PM',
    prompt:
      'Enquadramento: plano médio, da cintura para cima, sujeito nítido no centro.',
  },
  {
    id: 'close',
    label: 'Close',
    short: 'Close',
    prompt: 'Enquadramento: close, rosto preenchendo o quadro.',
  },
  {
    id: 'primeiro_plano',
    label: 'Primeiro plano',
    short: 'PP',
    prompt: 'Enquadramento: primeiro plano, ombros e rosto.',
  },
  {
    id: 'detalhe',
    label: 'Detalhe',
    short: 'Det',
    prompt:
      'Enquadramento: detalhe, insert extremo de um objeto ou parte do corpo.',
  },
] as const satisfies readonly MovieDirectionOption[];

export const MOVIE_CAMERAS = [
  {
    id: 'fixa',
    label: 'Fixa',
    short: 'Fixa',
    prompt: 'Câmera: fixa em tripé, sem pan nem zoom.',
  },
  {
    id: 'pan_l_r',
    label: 'Pan esquerda → direita',
    short: '→',
    prompt: 'Câmera: pan contínuo da esquerda para a direita.',
  },
  {
    id: 'pan_r_l',
    label: 'Pan direita → esquerda',
    short: '←',
    prompt: 'Câmera: pan contínuo da direita para a esquerda.',
  },
  {
    id: 'travelling',
    label: 'Travelling',
    short: 'Trav',
    prompt: 'Câmera: travelling lateral acompanhando a ação.',
  },
  {
    id: 'dolly_in',
    label: 'Dolly in',
    short: 'In',
    prompt: 'Câmera: dolly in lento em direção ao protagonista.',
  },
  {
    id: 'dolly_out',
    label: 'Dolly out',
    short: 'Out',
    prompt: 'Câmera: dolly out, recua afastando do sujeito.',
  },
  {
    id: 'handheld',
    label: 'Handheld',
    short: 'Hand',
    prompt: 'Câmera: handheld, leve tremor natural.',
  },
  {
    id: 'orbit',
    label: 'Orbit',
    short: 'Órb',
    prompt: 'Câmera: orbit, circunda o sujeito.',
  },
] as const satisfies readonly MovieDirectionOption[];

export const MOVIE_FRAMING_IDS = MOVIE_FRAMINGS.map((item) => item.id);
export const MOVIE_CAMERA_IDS = MOVIE_CAMERAS.map((item) => item.id);

export type MovieFramingId = (typeof MOVIE_FRAMING_IDS)[number];
export type MovieCameraId = (typeof MOVIE_CAMERA_IDS)[number];

function findOption<T extends MovieDirectionOption>(
  options: readonly T[],
  id: string | undefined,
  fallback: T,
): T {
  const key = id?.trim() || '';
  return options.find((item) => item.id === key) || fallback;
}

export function resolveMovieFraming(id?: string): MovieDirectionOption {
  return findOption(
    MOVIE_FRAMINGS,
    id,
    MOVIE_FRAMINGS.find((item) => item.id === DEFAULT_MOVIE_FRAMING)!,
  );
}

export function resolveMovieCamera(id?: string): MovieDirectionOption {
  return findOption(
    MOVIE_CAMERAS,
    id,
    MOVIE_CAMERAS.find((item) => item.id === DEFAULT_MOVIE_CAMERA)!,
  );
}

export function isMovieFramingId(id: string): id is MovieFramingId {
  return MOVIE_FRAMING_IDS.includes(id as MovieFramingId);
}

export function isMovieCameraId(id: string): id is MovieCameraId {
  return MOVIE_CAMERA_IDS.includes(id as MovieCameraId);
}
