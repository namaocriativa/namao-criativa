import { defineConfig } from 'vite';

const api = process.env.VITE_API_URL || 'http://localhost:3000';
const clientApi = process.env.VITE_CLIENT_API_URL || 'http://localhost:3001';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5174,
    proxy: {
      '/auth/instagram': api,
      '/auth/register': api,
      '/auth': clientApi,
      '/invites': api,
      '/leads': api,
      '/invite-requests': clientApi,
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
      },
    },
  },
});
