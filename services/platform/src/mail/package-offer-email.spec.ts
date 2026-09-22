import { packageOfferEmailHtml, packageOfferEmailText } from './package-offer-email';

describe('package-offer-email', () => {
  it('escapa HTML do corpo e quebra parágrafos', () => {
    const html = packageOfferEmailHtml({
      heading: 'Site <promo>',
      body: 'Olá, Firma.\n\nPreço: 10 < 20',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(html).toContain('Site &lt;promo&gt;');
    expect(html).toContain('10 &lt; 20');
    expect(html).toContain('Proposta');
    expect(html).not.toContain('<promo>');
  });

  it('anexa o rodapé no texto', () => {
    const text = packageOfferEmailText({ body: 'Proposta da Namão' });
    expect(text).toContain('Proposta da Namão');
    expect(text).toContain('Namão Criativa');
  });
});
