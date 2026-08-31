export type FontPair = {
  id: string;
  label: string;
  display: string;
  body: string;
  googleFontsHref: string;
};

export const FONT_PAIRS: FontPair[] = [
  {
    id: 'fraunces-source',
    label: 'Fraunces + Source Sans 3',
    display: '"Fraunces", Georgia, serif',
    body: '"Source Sans 3", system-ui, sans-serif',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600&display=swap',
  },
  {
    id: 'literata-ibm',
    label: 'Literata + IBM Plex Sans',
    display: '"Literata", Georgia, serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Literata:opsz,wght@7..72,500;7..72,700&display=swap',
  },
  {
    id: 'playfair-lato',
    label: 'Playfair + Lato',
    display: '"Playfair Display", Georgia, serif',
    body: '"Lato", system-ui, sans-serif',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@500;700&display=swap',
  },
];

export function getFontPair(id: string | undefined): FontPair {
  return FONT_PAIRS.find((p) => p.id === id) || FONT_PAIRS[0];
}
