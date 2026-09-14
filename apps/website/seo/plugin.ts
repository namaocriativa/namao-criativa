import type { Plugin } from 'vite';
import { renderFaqList, renderMarketingFooter, renderMarketingNav } from './chrome';
import { injectGtmBody, renderSeoHead } from './head';
import { matchSeoPage } from './pages';
import { buildSitemapXml } from './sitemap';

function gtmId(): string | undefined {
  return process.env.VITE_WEBSITE_GTM_ID || process.env.WEBSITE_GTM_CONTAINER_ID;
}

export function namaoSeoPlugin(): Plugin {
  return {
    name: 'namao-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = matchSeoPage(ctx.filename || '', ctx.path);
        if (!page) return html;
        const gtm = gtmId();
        let next = html.replace('<!--seo-->', renderSeoHead(page, gtm));
        next = next.replace('<!--site-nav-->', renderMarketingNav(page.path));
        next = next.replace('<!--site-footer-->', renderMarketingFooter());
        next = next.replace('<!--faq-list-->', renderFaqList());
        return injectGtmBody(next, page, gtm);
      },
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: buildSitemapXml(),
      });
    },
  };
}
