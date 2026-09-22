import { existsSync } from 'fs';
import path from 'path';

const RELATIVE_CANDIDATES = [
  'apps/website/public/logo-mark.png',
  '../../apps/website/public/logo-mark.png',
];

export function resolveNamaoLogoPath(
  cwd = process.cwd(),
  dirname = __dirname,
): string | null {
  const files = [
    ...RELATIVE_CANDIDATES.map((relative) => path.resolve(cwd, relative)),
    path.resolve(dirname, '../../../../apps/website/public/logo-mark.png'),
    path.resolve(dirname, '../../../../../apps/website/public/logo-mark.png'),
  ];
  return files.find((file) => existsSync(file)) || null;
}
