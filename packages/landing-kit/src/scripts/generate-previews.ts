import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COMPONENT_IDS } from '../ids';

/**
 * Gera placeholders PNG 1x1 para cada variante.
 * Troque por Playwright (render da variante com examples) quando quiser previews reais.
 */
function png1x1(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

const root = join(__dirname, '..', '..', 'previews');
mkdirSync(root, { recursive: true });
const bytes = png1x1();
for (const id of COMPONENT_IDS) {
  const file = join(root, `${id}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  console.log(file);
}
