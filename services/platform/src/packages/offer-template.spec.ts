import {
  interpolateOffer,
  offerPriceLine,
  offerVars,
  renderOfferTemplate,
} from './offer-template';

describe('offer-template', () => {
  const pkg = {
    name: 'Site Estratégico',
    summary: 'Presença digital',
    description: 'Site completo',
    benefits: ['Google', 'WhatsApp'],
    price: 1200,
    promoPrice: 800,
    currency: 'BRL',
  };

  it('monta de/por quando há preço promocional', () => {
    expect(offerPriceLine(pkg)).toMatch(/de .+ por .+/);
    expect(offerPriceLine({ ...pkg, promoPrice: null })).not.toMatch(/por /);
    expect(offerPriceLine({ name: 'X', price: null })).toBe('Sob consulta');
  });

  it('interpola placeholders do lead e do pacote', () => {
    const vars = offerVars('Firma', pkg);
    const text = interpolateOffer(
      '{{lead.name}} · {{package.name}} · {{package.priceLine}}\n{{package.benefits}}',
      vars,
    );
    expect(text).toContain('Firma');
    expect(text).toContain('Site Estratégico');
    expect(text).toContain('de ');
    expect(text).toContain('• Google');
    expect(text).toContain('• WhatsApp');
  });

  it('substitui token desconhecido por vazio', () => {
    expect(interpolateOffer('oi {{package.missing}} fim', offerVars('A', pkg))).toBe(
      'oi  fim',
    );
  });

  it('renderiza assunto, e-mail e WhatsApp com o default', () => {
    const rendered = renderOfferTemplate(null, 'Firma', pkg);
    expect(rendered.subject).toContain('Site Estratégico');
    expect(rendered.subject).toContain('Firma');
    expect(rendered.emailBody).toContain('Site Estratégico');
    expect(rendered.whatsappMessage).toContain('*Site Estratégico*');
  });
});
