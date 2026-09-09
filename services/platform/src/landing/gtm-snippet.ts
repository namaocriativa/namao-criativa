export type GtmContext = {
  containerId?: string | null;
  leadId?: string | null;
  siteId?: string | null;
  landingSlug?: string | null;
};

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/;

export function normalizeGtmContainerId(
  raw?: string | null,
): string {
  const id = String(raw || '')
    .trim()
    .toUpperCase();
  return GTM_ID_RE.test(id) ? id : '';
}

export function gtmContainerIdFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return normalizeGtmContainerId(env.GTM_CONTAINER_ID);
}

export function htmlHasGtm(html: string): boolean {
  return html.includes('googletagmanager.com/gtm.js');
}

function dataLayerScript(ctx: GtmContext): string {
  const payload = {
    lead_id: String(ctx.leadId || '').trim(),
    site_id: String(ctx.siteId || '').trim(),
    landing_slug: String(ctx.landingSlug || '').trim(),
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push(${json});</script>`;
}

function headSnippet(containerId: string): string {
  return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');</script>
<!-- End Google Tag Manager -->`;
}

function bodySnippet(containerId: string): string {
  return `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}"
height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
}

export function buildGtmSnippets(ctx: GtmContext): {
  containerId: string;
  head: string;
  body: string;
} | null {
  const containerId = normalizeGtmContainerId(ctx.containerId);
  if (!containerId) return null;
  return {
    containerId,
    head: `${dataLayerScript(ctx)}\n${headSnippet(containerId)}`,
    body: bodySnippet(containerId),
  };
}

export function injectGtmIntoHtml(html: string, ctx: GtmContext): string {
  const snippets = buildGtmSnippets(ctx);
  if (!snippets) return html;
  if (htmlHasGtm(html)) return html;

  let next = html;
  if (/<\/head>/i.test(next)) {
    next = next.replace(/<\/head>/i, `    ${snippets.head}\n  </head>`);
  } else {
    next = `${snippets.head}\n${next}`;
  }
  if (/<body[^>]*>/i.test(next)) {
    next = next.replace(/<body([^>]*)>/i, `<body$1>\n    ${snippets.body}`);
  } else {
    next = `${next}\n${snippets.body}`;
  }
  return next;
}
