import {
  namePlaceDedupeKey,
  websiteDedupeKey,
} from './lead-dedupe';

describe('lead-dedupe', () => {
  it('normaliza websites equivalentes', () => {
    expect(websiteDedupeKey('https://www.Exemplo.com.br/')).toBe(
      'exemplo.com.br',
    );
    expect(websiteDedupeKey('exemplo.com.br')).toBe('exemplo.com.br');
    expect(websiteDedupeKey('https://exemplo.com.br/contato')).toBe(
      'exemplo.com.br',
    );
  });

  it('normaliza nome+cidade+estado ignorando acentos', () => {
    expect(
      namePlaceDedupeKey({
        name: 'Empresa Exemplo Ltda',
        city: 'São Paulo',
        state: 'SP',
      }),
    ).toBe(
      namePlaceDedupeKey({
        name: 'empresa exemplo ltda',
        city: 'sao paulo',
        state: 'sp',
      }),
    );
  });
});
