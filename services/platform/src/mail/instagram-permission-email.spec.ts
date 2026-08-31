import {
  instagramPermissionEmailHtml,
  instagramPermissionEmailText,
} from './instagram-permission-email';

describe('instagram-permission-email', () => {
  it('inclui pedido de mídia, CTA e link', () => {
    const html = instagramPermissionEmailHtml({
      name: 'Juliane',
      actionUrl: 'http://localhost:5174/register.html?invite=abc',
      logoUrl: 'http://localhost:5174/logo.png',
      hasAccount: false,
    });
    expect(html).toContain('Juliane');
    expect(html).toContain('http://localhost:5174/register.html?invite=abc');
    expect(html).toContain('Criar conta e autorizar');
    expect(html).toContain('Namão Criativa');
  });

  it('texto cobre fluxo com conta existente', () => {
    const text = instagramPermissionEmailText({
      name: 'Juliane',
      actionUrl: 'http://localhost:5174/conectar.html',
      hasAccount: true,
    });
    expect(text).toContain('conectar.html');
    expect(text).toContain('autorize o Instagram');
  });
});
