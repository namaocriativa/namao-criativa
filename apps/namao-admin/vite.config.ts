import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyFileSync,
  createReadStream,
  existsSync,
} from 'node:fs';
import { defineConfig, type Plugin, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveLocalApiUrl } from '../local-api-url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const api = resolveLocalApiUrl(path.resolve(rootDir, '../..'));

function namaoLogoPlugin(): Plugin {
  const logoFile = path.resolve(rootDir, '../website/public/logo-mark.png');
  const logoPaths = new Set(['/logo.png', '/logo-mark.png']);
  const serveLogo: Plugin['configureServer'] = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url?.split('?')[0];
      if (!url || !logoPaths.has(url) || req.method !== 'GET') {
        next();
        return;
      }
      if (!existsSync(logoFile)) {
        res.statusCode = 404;
        res.end('logo not found');
        return;
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache');
      createReadStream(logoFile).pipe(res);
    });
  };
  return {
    name: 'namao-logo',
    configureServer: serveLogo,
    configurePreviewServer: serveLogo,
    writeBundle(output) {
      if (!output.dir || !existsSync(logoFile)) return;
      copyFileSync(logoFile, path.join(output.dir, 'logo.png'));
      copyFileSync(logoFile, path.join(output.dir, 'logo-mark.png'));
    },
  };
}

function loginPagePlugin(): Plugin {
  const rewrite = (
    req: { url?: string },
    _res: unknown,
    next: () => void,
  ) => {
    const [pathname, query] = (req.url || '').split('?');
    if (pathname === '/login') {
      req.url = query ? `/login.html?${query}` : '/login.html';
    }
    next();
  };
  return {
    name: 'admin-login-page',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

function apiProxy(): ProxyOptions {
  return {
    target: api,
    timeout: 600_000,
    proxyTimeout: 600_000,
    bypass(req) {
      if (req.headers.accept?.includes('text/html')) {
        return '/index.html';
      }
    },
  };
}

export default defineConfig({
  clearScreen: false,
  appType: 'spa',
  plugins: [loginPagePlugin(), react(), namaoLogoPlugin()],
  server: {
    port: 5175,
    proxy: {
      '/auth': apiProxy(),
      '/studio': apiProxy(),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.join(rootDir, 'index.html'),
        login: path.join(rootDir, 'login.html'),
      },
    },
  },
});
