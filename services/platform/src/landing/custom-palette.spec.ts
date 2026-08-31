import {
  contrastRatio,
  generatePalette,
  parseColorIntensity,
  parseHex,
  resolveTheme,
} from '@namao/landing-kit';

describe('custom palette', () => {
  it('parseHex aceita #RGB de 6 dígitos com ou sem hash', () => {
    expect(parseHex('#95F9E3')).toBe('#95f9e3');
    expect(parseHex('69ebd0')).toBe('#69ebd0');
    expect(parseHex('green')).toBeNull();
  });

  it('gera paleta com contraste texto/fundo >= 4.5', () => {
    const rng = () => 0.42;
    const colors = generatePalette({}, rng);
    expect(contrastRatio(colors.ink, colors.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('respeita cores travadas na geração', () => {
    const colors = generatePalette({ accent: '#ff4d4d' }, () => 0.2);
    expect(colors.accent).toBe('#ff4d4d');
  });

  it('parseColorIntensity cai em moderado', () => {
    expect(parseColorIntensity('leve')).toBe('leve');
    expect(parseColorIntensity('nope')).toBe('moderado');
  });

  it('resolveTheme usa hex custom nas CSS vars', () => {
    const theme = resolveTheme({
      style: 'premium',
      colors: {
        paper: '#95f9e3',
        surface: '#69ebd0',
        accent: '#49d49d',
        ink: '#564946',
        muted: '#558564',
      },
    });
    expect(theme.cssVariables).toContain('--paper: #95f9e3');
    expect(theme.cssVariables).toContain('--accent: #49d49d');
    expect(theme.colors.accent).toBe('#49d49d');
  });
});
