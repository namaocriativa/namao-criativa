import {
  buildGtmSnippets,
  htmlHasGtm,
  injectGtmIntoHtml,
  normalizeGtmContainerId,
} from './gtm-snippet';

describe('gtm-snippet', () => {
  it('aceita só IDs GTM válidos', () => {
    expect(normalizeGtmContainerId('gtm-abc12')).toBe('GTM-ABC12');
    expect(normalizeGtmContainerId(' GTM-XXXX ')).toBe('GTM-XXXX');
    expect(normalizeGtmContainerId('UA-1')).toBe('');
    expect(normalizeGtmContainerId('')).toBe('');
  });

  it('monta dataLayer + snippets', () => {
    const snippets = buildGtmSnippets({
      containerId: 'GTM-TEST1',
      leadId: 'lead-1',
      siteId: 'site_abc',
      landingSlug: 'firma-x',
    });
    expect(snippets?.head).toContain('lead-1');
    expect(snippets?.head).toContain('site_abc');
    expect(snippets?.head).toContain('googletagmanager.com/gtm.js?id=');
    expect(snippets?.head).toContain('GTM-TEST1');
    expect(snippets?.body).toContain('ns.html?id=GTM-TEST1');
  });

  it('injeta no head/body e não duplica', () => {
    const html = `<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>`;
    const once = injectGtmIntoHtml(html, {
      containerId: 'GTM-ZZZ',
      leadId: 'l1',
    });
    expect(htmlHasGtm(once)).toBe(true);
    expect(once).toContain('window.dataLayer');
    expect(once.match(/googletagmanager\.com\/gtm\.js/g)?.length).toBe(1);
    const twice = injectGtmIntoHtml(once, { containerId: 'GTM-ZZZ' });
    expect(twice).toBe(once);
  });

  it('não altera HTML sem container', () => {
    const html = '<html><head></head><body></body></html>';
    expect(injectGtmIntoHtml(html, {})).toBe(html);
  });
});
