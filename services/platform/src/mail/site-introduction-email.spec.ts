import {
  namaoWhatsAppUrl,
  siteIntroductionEmailHtml,
  siteIntroductionEmailText,
} from './site-introduction-email';

describe('site-introduction-email', () => {
  it('inclui site, cadastro, WhatsApp e serviços de Google', () => {
    const html = siteIntroductionEmailHtml({
      name: 'Firma',
      siteUrl: 'https://firma.vercel.app',
      registerUrl: 'http://localhost:5174/register.html?invite=abc',
      whatsappUrl: 'https://wa.me/5519997306695?text=oi',
      logoUrl: 'http://localhost:5174/logo.png',
      hasAccount: false,
    });
    expect(html).toContain('Firma');
    expect(html).toContain('https://firma.vercel.app');
    expect(html).toContain('Ver o site');
    expect(html).toContain('Completar cadastro');
    expect(html).toContain('http://localhost:5174/register.html?invite=abc');
    expect(html).toContain('Falar no WhatsApp');
    expect(html).toContain('Google Meu Negócio');
    expect(html).toContain('Namão Criativa');
  });

  it('omite o CTA do site quando ainda não foi publicado', () => {
    const html = siteIntroductionEmailHtml({
      name: 'Firma',
      siteUrl: null,
      registerUrl: 'http://localhost:5174/register.html?invite=preview',
      whatsappUrl: null,
      logoUrl: 'http://localhost:5174/logo.png',
      hasAccount: false,
    });
    expect(html).not.toContain('Ver o site');
    expect(html).not.toContain('Falar no WhatsApp');
    expect(html).toContain('Completar cadastro');
  });

  it('texto cobre fluxo com conta existente', () => {
    const text = siteIntroductionEmailText({
      name: 'Firma',
      siteUrl: 'https://firma.vercel.app',
      registerUrl: 'http://localhost:5174/login.html',
      whatsappUrl: 'https://wa.me/5519997306695',
      hasAccount: true,
    });
    expect(text).toContain('https://firma.vercel.app');
    expect(text).toContain('Entrar no painel');
    expect(text).toContain('login.html');
    expect(text).toContain('WhatsApp');
  });

  it('monta o link do WhatsApp da Namão', () => {
    const url = namaoWhatsAppUrl('+55 19 99730-6695', 'Firma');
    expect(url).toContain('https://wa.me/5519997306695?text=');
    expect(url).toContain(encodeURIComponent('Firma'));
  });

  it('aceita mensagem customizada no WhatsApp', () => {
    const url = namaoWhatsAppUrl('+5519997306695', 'Firma', 'Quero pagar o serviço.');
    expect(url).toContain(encodeURIComponent('Quero pagar o serviço.'));
    expect(url).not.toContain(encodeURIComponent('Vi o site'));
  });
});
