import { studioWelcomeEmailHtml, studioWelcomeEmailText } from './studio-welcome-email';

describe('studio-welcome-email', () => {
  it('inclui logo, credenciais e link do studio', () => {
    const html = studioWelcomeEmailHtml({
      name: 'Ana',
      email: 'ana@namao.local',
      password: 'secret-pass-1',
      loginUrl: 'http://localhost:5173/login',
      logoUrl: 'http://localhost:5174/logo.png',
    });
    expect(html).toContain('http://localhost:5174/logo.png');
    expect(html).toContain('ana@namao.local');
    expect(html).toContain('secret-pass-1');
    expect(html).toContain('http://localhost:5173/login');
    expect(html).toContain('Bem-vindo ao studio');
    expect(html).toContain('Entrar no studio');
  });

  it('usa copy de reset quando kind é reset', () => {
    const html = studioWelcomeEmailHtml({
      name: 'Ana',
      email: 'ana@namao.local',
      password: 'nova-senha',
      loginUrl: 'http://localhost:5173/login',
      logoUrl: 'http://localhost:5174/logo.png',
      kind: 'reset',
    });
    expect(html).toContain('Senha nova do studio');
    const text = studioWelcomeEmailText({
      name: 'Ana',
      email: 'ana@namao.local',
      password: 'nova-senha',
      loginUrl: 'http://localhost:5173/login',
      kind: 'reset',
    });
    expect(text).toContain('senha do studio');
  });
});
