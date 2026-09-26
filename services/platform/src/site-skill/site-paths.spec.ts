import { assertSafeRelPath } from './site-paths';

describe('assertSafeRelPath', () => {
  it('aceita arquivos do Vite', () => {
    expect(assertSafeRelPath('src/App.tsx')).toBe('src/App.tsx');
    expect(assertSafeRelPath('public/images/a.jpg')).toBe('public/images/a.jpg');
  });

  it('recusa path fora do projeto', () => {
    expect(() => assertSafeRelPath('../secret')).toThrow(/fora/);
    expect(() => assertSafeRelPath('node_modules/x')).toThrow(/fora/);
    expect(() => assertSafeRelPath('.git/config')).toThrow(/fora/);
  });
});
