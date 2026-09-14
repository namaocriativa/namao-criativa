import { resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret', () => {
  it('exige um valor', () => {
    expect(() => resolveJwtSecret('', 'development')).toThrow(
      'JWT_SECRET is required',
    );
    expect(() => resolveJwtSecret(undefined, 'test')).toThrow(
      'JWT_SECRET is required',
    );
  });

  it('aceita placeholder só fora de produção', () => {
    expect(resolveJwtSecret('dev-jwt-secret-change-me', 'development')).toBe(
      'dev-jwt-secret-change-me',
    );
  });

  it('rejeita placeholder em produção', () => {
    expect(() =>
      resolveJwtSecret('dev-jwt-secret-change-me', 'production'),
    ).toThrow(/development placeholder/);
    expect(() =>
      resolveJwtSecret('change-me-in-production', 'production'),
    ).toThrow(/development placeholder/);
  });

  it('aceita secret forte em produção', () => {
    expect(resolveJwtSecret('a-long-random-production-secret', 'production')).toBe(
      'a-long-random-production-secret',
    );
  });
});
