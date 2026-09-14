import type { PageSeo } from './pages';
import {
  SITE_LOGO,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_THEME_COLOR,
  absoluteUrl,
  gtmContainerId,
} from './site';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

export function gtmHeadSnippet(id: string): string {
  return `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`;
}

export function gtmBodySnippet(id: string): string {
  return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}

export function renderSeoHead(page: PageSeo, gtmRaw?: string): string {
  const canonical = absoluteUrl(page.path);
  const ogImage = absoluteUrl(SITE_OG_IMAGE);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const gtm = page.noindex ? null : gtmContainerId(gtmRaw);
  const parts = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    page.noindex
      ? `<meta name="robots" content="noindex, nofollow" />`
      : `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<link rel="icon" type="image/png" href="${SITE_LOGO}" />`,
    `<link rel="apple-touch-icon" href="${SITE_LOGO}" />`,
    `<meta name="theme-color" content="${SITE_THEME_COLOR}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
    `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@600;700;800&family=Figtree:wght@400;500;600&display=swap" rel="stylesheet" />`,
  ];
  if (page.preloadImage) {
    parts.push(
      `<link rel="preload" as="image" href="${page.preloadImage}" />`,
    );
  }
  for (const node of page.jsonLd || []) {
    parts.push(jsonLdScript(node));
  }
  if (gtm) parts.push(gtmHeadSnippet(gtm));
  return parts.join('\n    ');
}

export function injectGtmBody(html: string, page: PageSeo, gtmRaw?: string): string {
  const gtm = page.noindex ? null : gtmContainerId(gtmRaw);
  if (!gtm) return html;
  return html.replace(/<body([^>]*)>/i, `<body$1>\n    ${gtmBodySnippet(gtm)}`);
}
