import { defineConfig } from 'vite';

const api = process.env.VITE_API_URL || 'http://localhost:3000';

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
