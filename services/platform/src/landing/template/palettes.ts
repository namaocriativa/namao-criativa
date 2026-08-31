export type Palette = {
  id: string;
  label: string;
  colors: {
    ink: string;
    paper: string;
    accent: string;
    muted: string;
    surface: string;
  };
};

export const PALETTES: Palette[] = [
  {
    id: 'slate-teal',
    label: 'Ardósia e teal',
    colors: {
      ink: '#142033',
      paper: '#eef2f4',
      accent: '#1f6b5c',
      muted: '#5b6b7c',
      surface: '#ffffff',
    },
  },
  {
    id: 'ink-gold',
    label: 'Tinta e ouro',
    colors: {
      ink: '#1a1612',
      paper: '#f3efe8',
      accent: '#9a6b2f',
      muted: '#6e6458',
      surface: '#fffaf3',
    },
  },
  {
    id: 'navy-coral',
    label: 'Marinho e coral',
    colors: {
      ink: '#0f1c2e',
      paper: '#f2f5f8',
      accent: '#c45c4a',
      muted: '#5a6a7a',
      surface: '#ffffff',
    },
  },
  {
    id: 'forest',
    label: 'Floresta',
    colors: {
      ink: '#13261c',
      paper: '#eef3ef',
      accent: '#2f6b45',
      muted: '#5a6e60',
      surface: '#f7faf7',
    },
  },
];

export function getPalette(id: string | undefined): Palette {
  return PALETTES.find((p) => p.id === id) || PALETTES[0];
}
