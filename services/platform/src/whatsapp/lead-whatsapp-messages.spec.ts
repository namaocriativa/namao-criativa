import {
  applyWhatsAppPlaceholders,
  proposalWhatsApp,
} from './lead-whatsapp-messages';

describe('lead-whatsapp-messages', () => {
  it('substitui placeholders de prévia', () => {
    const text = applyWhatsAppPlaceholders(
      'Senha: ••••••••\nLink: http://x/register.html?invite=preview',
      [
        ['••••••••', 'abc123'],
        ['http://x/register.html?invite=preview', 'http://x/register.html?invite=real'],
      ],
    );
    expect(text).toContain('Senha: abc123');
    expect(text).toContain('invite=real');
    expect(text).not.toContain('invite=preview');
  });

  it('monta o convite da proposta', () => {
    const text = proposalWhatsApp({
      name: 'Firma',
      packageName: 'Site',
      loginUrl: 'http://localhost:5174/login.html?next=%2Fproposta.html',
    });
    expect(text).toContain('Firma');
    expect(text).toContain('*Site*');
    expect(text).toContain('proposta.html');
  });
});
