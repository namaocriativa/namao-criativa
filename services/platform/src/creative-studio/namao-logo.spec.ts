import { existsSync } from 'fs';
import path from 'path';
import { resolveNamaoLogoPath } from './namao-logo';

describe('resolveNamaoLogoPath', () => {
  it('encontra o logo a partir da raiz do repositório', () => {
    const root = path.resolve(__dirname, '../../../../');
    const found = resolveNamaoLogoPath(root, '/tmp/missing');
    expect(found).toBe(path.join(root, 'apps/website/public/logo-mark.png'));
    expect(existsSync(found!)).toBe(true);
  });

  it('encontra o logo a partir de services/platform', () => {
    const platformCwd = path.resolve(__dirname, '../../');
    const found = resolveNamaoLogoPath(platformCwd, __dirname);
    expect(found && existsSync(found)).toBe(true);
  });
});
