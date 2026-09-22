import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { resolveLocalApiUrl } from '../local-api-url';
import { viteInput } from './seo/pages';
import { namaoSeoPlugin } from './seo/plugin';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const api = resolveLocalApiUrl(path.resolve(rootDir, '../..'));

export default defineConfig({
  clearScreen: false,
  root: '.',
  publicDir: 'public',
  plugins: [namaoSeoPlugin()],
  server: {
    port: 5174,
    proxy: {
      '/auth': api,
      '/dashboard/analytics': api,
      '/invites': api,
      '/leads': api,
      '/invite-requests': api,
      '/namao-chat': api,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(viteInput()).map(([name, file]) => [
          name,
          path.resolve(rootDir, file),
        ]),
      ),
    },
  },
});
