import { loadEnv, log } from '../lib/config.js';
import {
  resolveWebsiteProxyOrigins,
  writeWebsiteRedirects,
} from '../lib/website-redirects.js';

loadEnv();
const origins = resolveWebsiteProxyOrigins();
const result = writeWebsiteRedirects(origins);

if (!result.written) {
  log('website', 'no _redirects (set WEBSITE_API_ORIGIN)');
  process.exit(0);
}

log('website', `api proxy → ${origins.apiOrigin}`);
log('website', `wrote ${result.path}`);
