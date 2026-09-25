import {
  fallbackEmail,
  generatePassword,
  isSendableEmail,
  normalizeEmail,
  publicLoginUrl,
  publicProposalLoginUrl,
} from './lead-account.util';

describe('lead-account.util', () => {
  it('normaliza e-mail', () => {
    expect(normalizeEmail('  Ada@Loja.COM ')).toBe('ada@loja.com');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it('gera fallback único e não enviável', () => {
    const email = fallbackEmail('clxyz123abc');
    expect(email).toBe('lead+clxyz123@clientes.namao.local');
    expect(isSendableEmail(email)).toBe(false);
  });

  it('reconhece e-mail real', () => {
    expect(isSendableEmail('ana@loja.com')).toBe(true);
    expect(isSendableEmail('nao-e-email')).toBe(false);
  });

  it('gera senha com 12+ caracteres', () => {
    const password = generatePassword();
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(generatePassword()).not.toBe(password);
  });

  it('monta URL de login', () => {
    expect(publicLoginUrl('https://namao.com/')).toBe(
      'https://namao.com/login.html',
    );
  });

  it('monta URL de login da proposta', () => {
    expect(publicProposalLoginUrl('https://namao.com/')).toBe(
      'https://namao.com/login.html?next=%2Fproposta.html',
    );
  });
});
