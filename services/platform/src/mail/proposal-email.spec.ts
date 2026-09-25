import { proposalEmailHtml, proposalEmailText } from './proposal-email';

describe('proposal-email', () => {
  it('escapa HTML e inclui o CTA', () => {
    const html = proposalEmailHtml({
      name: 'Firma <x>',
      packageName: 'Site & App',
      loginUrl: 'http://localhost:5174/login.html?next=%2Fproposta.html',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(html).toContain('Firma &lt;x&gt;');
    expect(html).toContain('Site &amp; App');
    expect(html).toContain('Ver proposta');
    expect(html).toContain('login.html?next=%2Fproposta.html');
  });

  it('texto aponta para o login da proposta', () => {
    const text = proposalEmailText({
      name: 'Firma',
      packageName: 'Site',
      loginUrl: 'http://localhost:5174/login.html?next=%2Fproposta.html',
    });
    expect(text).toContain('Site');
    expect(text).toContain('login.html?next=%2Fproposta.html');
    expect(text).toContain('Namão Criativa');
  });
});
