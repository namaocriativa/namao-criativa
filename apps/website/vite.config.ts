import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { resolveLocalApiUrl } from '../local-api-url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const api = resolveLocalApiUrl(path.resolve(rootDir, '../..'));

export default defineConfig({
  root: '.',
  publicDir: 'public',
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
      input: {
        main: 'index.html',
        register: 'register.html',
        login: 'login.html',
        conectar: 'conectar.html',
        dashboard: 'dashboard.html',
        termos: 'termos.html',
        privacidade: 'privacidade.html',
      },
    },
  },
});
