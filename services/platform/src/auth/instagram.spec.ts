import {
  INSTAGRAM_HANDLE,
  instagramProfileUrl,
  normalizeInstagram,
} from './instagram';

describe('normalizeInstagram', () => {
  it('aceita handle com @', () => {
    expect(normalizeInstagram('@meu.negocio')).toBe('meu.negocio');
  });

  it('aceita URL completa', () => {
    expect(normalizeInstagram('https://www.instagram.com/foo.bar/')).toBe(
      'foo.bar',
    );
  });

  it('monta o perfil', () => {
    expect(instagramProfileUrl('loja_ok')).toBe(
      'https://www.instagram.com/loja_ok/',
    );
  });

  it('valida o handle normalizado', () => {
    expect(INSTAGRAM_HANDLE.test(normalizeInstagram('@ok_1.name'))).toBe(true);
    expect(INSTAGRAM_HANDLE.test(normalizeInstagram('bad handle'))).toBe(false);
  });
});
