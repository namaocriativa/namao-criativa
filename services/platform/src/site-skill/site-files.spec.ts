import { parseSiteFiles } from './site-files';

describe('parseSiteFiles', () => {
  it('aceita o mapa do Vite', () => {
    const parsed = parseSiteFiles({
      files: { 'src/App.tsx': 'export default function App(){return null}' },
      extraDeps: ['motion'],
    });
    expect(parsed.files['src/App.tsx']).toContain('App');
    expect(parsed.extraDeps).toEqual(['motion']);
  });

  it('recusa path fora do projeto', () => {
    expect(() =>
      parseSiteFiles({ files: { '../secret.ts': 'x' } }),
    ).toThrow(/fora/);
    expect(() =>
      parseSiteFiles({ files: { 'node_modules/x.js': 'x' } }),
    ).toThrow(/fora/);
  });
});
