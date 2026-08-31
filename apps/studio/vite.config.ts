import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const kitSrc = path.resolve(rootDir, '../../packages/landing-kit/src');
const api = 'http://localhost:3000';

function namaoLogoPlugin(): Plugin {
  const logoFile = path.resolve(rootDir, '../website/public/logo.png');
  return {
    name: 'namao-logo',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/logo.png' || req.method !== 'GET') {
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
    },
  };
}

function kitRenamePlugin(): Plugin {
  const catalogFile = path.join(kitSrc, 'catalog/variants.ts');
  return {
    name: 'kit-rename',
    configureServer(server) {
      server.middlewares.use('/__kit-rename', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk));
        });
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              id?: string;
              name?: string;
            };
            const id = String(body.id || '').trim();
            const name = String(body.name || '').trim().slice(0, 80);
            if (!id || !name || !/^[a-z0-9.-]+$/i.test(id)) {
              res.statusCode = 400;
              res.end('invalid');
              return;
            }
            const source = readFileSync(catalogFile, 'utf8');
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const pattern = new RegExp(
              `(id: '${escapedId}',\\s*\\n\\s*name: )'(?:\\\\'|[^'])*'`,
            );
            if (!pattern.test(source)) {
              res.statusCode = 404;
              res.end('not found');
              return;
            }
            writeFileSync(
              catalogFile,
              source.replace(pattern, `$1'${escapedName}'`),
            );
            res.statusCode = 204;
            res.end();
          } catch (error) {
            res.statusCode = 500;
            res.end(error instanceof Error ? error.message : 'error');
          }
        });
      });
    },
  };
}

/** Navegação do browser (Accept: text/html) fica no SPA; fetch/XHR segue para a API. */
function apiProxy(): ProxyOptions {
  return {
    target: api,
    bypass(req) {
      if (req.headers.accept?.includes('text/html')) {
        return '/index.html';
      }
    },
  };
}

export default defineConfig({
  appType: 'spa',
  plugins: [react(), tailwindcss(), namaoLogoPlugin(), kitRenamePlugin()],
  resolve: {
    alias: [
      {
        find: '@namao/landing-kit/renderer',
        replacement: path.join(kitSrc, 'renderer/index.tsx'),
      },
      {
        find: '@namao/landing-kit/theme.css',
        replacement: path.join(kitSrc, 'theme/tailwind.css'),
      },
      {
        find: '@namao/landing-kit/styles.css',
        replacement: path.join(kitSrc, 'styles.css'),
      },
      {
        find: '@namao/landing-kit',
        replacement: path.join(kitSrc, 'index.ts'),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/leads': apiProxy(),
      '/lead-discovery': apiProxy(),
      '/enrichment': apiProxy(),
      '/packages': apiProxy(),
      '/locations': apiProxy(),
      '/storage': apiProxy(),
      '/landing': apiProxy(),
      '/config': apiProxy(),
      '/auth': apiProxy(),
      '/invites': apiProxy(),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.join(rootDir, 'index.html'),
        'kit-preview': path.join(rootDir, 'kit-preview.html'),
      },
    },
  },
});
