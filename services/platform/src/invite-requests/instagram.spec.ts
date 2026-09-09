import { INSTAGRAM_HANDLE, normalizeInstagram } from './instagram';

describe('normalizeInstagram', () => {
  it('aceita handle com @', () => {
    expect(normalizeInstagram('@meu.negocio')).toBe('meu.negocio');
  });

  it('aceita URL completa', () => {
    expect(normalizeInstagram('https://www.instagram.com/foo.bar/')).toBe(
      'foo.bar',
    );
  });

  it('aceita host sem protocolo', () => {
    expect(normalizeInstagram('instagram.com/loja_ok')).toBe('loja_ok');
  });

  it('corta query string', () => {
    expect(normalizeInstagram('https://instagram.com/foo?igsh=abc')).toBe(
      'foo',
    );
  });

  it('valida o handle normalizado', () => {
    expect(INSTAGRAM_HANDLE.test(normalizeInstagram('@ok_1.name'))).toBe(true);
    expect(INSTAGRAM_HANDLE.test(normalizeInstagram('bad handle'))).toBe(false);
  });
});
