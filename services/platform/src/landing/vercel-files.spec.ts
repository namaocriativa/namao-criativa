import { sha1Buffer, toVercelPath, vercelProjectName } from './vercel-files';

describe('vercel-files', () => {
  it('sanitiza o nome do projeto Vercel', () => {
    expect(vercelProjectName('Aguiar Advogados_ada1c0u8')).toBe(
      'ld-aguiar-advogados-ada1c0u8',
    );
    expect(vercelProjectName('---')).toBe('ld-site');
  });

  it('normaliza caminho posix para upload', () => {
    expect(toVercelPath('assets\\index.js')).toBe('assets/index.js');
    expect(sha1Buffer(Buffer.from('abc')).length).toBe(40);
  });
});
