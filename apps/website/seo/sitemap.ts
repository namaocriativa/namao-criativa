import { INDEXABLE_PAGES } from './pages';
import { SITE_ORIGIN } from './site';

export function buildSitemapXml(lastmod = new Date().toISOString().slice(0, 10)): string {
  const urls = INDEXABLE_PAGES.map((page) => {
    const loc = page.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${page.path}`;
    const priority = page.path === '/' ? '1.0' : page.path.startsWith('/servicos') ? '0.8' : '0.6';
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
