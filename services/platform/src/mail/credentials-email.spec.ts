import { credentialsEmailHtml } from './credentials-email';

describe('credentials-email', () => {
  it('inclui logo, credenciais e link de login', () => {
    const html = credentialsEmailHtml({
      name: 'Ana',
      email: 'ana@loja.com',
      password: 'secret-pass-1',
      loginUrl: 'http://localhost:5174/login.html',
      logoUrl: 'http://localhost:5174/logo.png',
    });
    expect(html).toContain('http://localhost:5174/logo.png');
    expect(html).toContain('ana@loja.com');
    expect(html).toContain('secret-pass-1');
    expect(html).toContain('http://localhost:5174/login.html');
    expect(html).toContain('Namão Criativa');
  });
});
