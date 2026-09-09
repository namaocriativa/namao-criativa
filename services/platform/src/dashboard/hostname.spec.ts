import { hostnameFromOrigin } from './hostname';

describe('hostnameFromOrigin', () => {
  it('extrai host de URL absoluta', () => {
    expect(hostnameFromOrigin('https://ld-firma.vercel.app/')).toBe(
      'ld-firma.vercel.app',
    );
  });

  it('aceita host sem scheme', () => {
    expect(hostnameFromOrigin('clinica.vercel.app/foo')).toBe(
      'clinica.vercel.app',
    );
  });

  it('vazio vira string vazia', () => {
    expect(hostnameFromOrigin(null)).toBe('');
    expect(hostnameFromOrigin('')).toBe('');
  });
});
