import {
  buildBrandIdentityPromptBlock,
  DEFAULT_LOGO_APPEARANCE,
  hasUsefulBrandIdentity,
  parseBrandIdentity,
} from './brand-identity.contract';

describe('brand-identity.contract', () => {
  it('parseia campos úteis e ignora inválidos', () => {
    expect(
      parseBrandIdentity({
        logoImageId: 'img-1',
        primaryColor: '#aabbcc',
        secondaryColor: 'red',
        headingFont: 'Montserrat',
        voice: 'próximo',
        logoAppearance: 'canto superior esquerdo',
      }),
    ).toEqual({
      logoImageId: 'img-1',
      primaryColor: '#AABBCC',
      headingFont: 'Montserrat',
      voice: 'próximo',
      logoAppearance: 'canto superior esquerdo',
    });
  });

  it('detecta identidade útil', () => {
    expect(hasUsefulBrandIdentity({})).toBe(false);
    expect(hasUsefulBrandIdentity({ primaryColor: '#111111' })).toBe(true);
    expect(hasUsefulBrandIdentity({ logoImageId: 'x' })).toBe(true);
  });

  it('monta bloco de prompt com identidade e logo', () => {
    const block = buildBrandIdentityPromptBlock(
      {
        primaryColor: '#112233',
        headingFont: 'Poppins',
        voice: 'direto',
        logoAppearance: 'rodapé discreto',
      },
      {
        useBrandIdentity: true,
        useBrandLogo: true,
        logoAppearance: 'topo direito, 10%',
      },
    );
    expect(block).toContain('Identidade da marca');
    expect(block).toContain('#112233');
    expect(block).toContain('Poppins');
    expect(block).toContain('direto');
    expect(block).toContain('topo direito, 10%');
  });

  it('usa aparência padrão quando o logo está ligado sem texto', () => {
    const block = buildBrandIdentityPromptBlock(
      { logoImageId: 'img-1' },
      { useBrandLogo: true },
    );
    expect(block).toContain(DEFAULT_LOGO_APPEARANCE);
  });

  it('não inclui identidade quando o toggle está desligado', () => {
    const block = buildBrandIdentityPromptBlock(
      { primaryColor: '#112233', voice: 'direto' },
      { useBrandIdentity: false, useBrandLogo: false },
    );
    expect(block).toBe('');
  });
});
