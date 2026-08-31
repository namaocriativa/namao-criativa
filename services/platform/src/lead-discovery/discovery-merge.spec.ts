import { DiscoveryResult } from '../providers/provider.types';
import { mergeDiscoveryResults, namesSimilar } from './discovery-merge';

const place = { city: 'São Paulo', state: 'SP' };

function googleLead(
  overrides: Partial<DiscoveryResult> = {},
): DiscoveryResult {
  return {
    name: 'Padaria Central',
    address: 'Rua A, 10',
    website: null,
    phone: null,
    instagram: null,
    rating: 4.5,
    reviewCount: 20,
    category: 'bakery',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.55,
    longitude: -46.63,
    externalId: 'ChIJabc',
    source: 'google',
    sources: ['google'],
    ...overrides,
  };
}

function osmLead(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  return {
    name: 'Padaria Central',
    address: 'Rua A, 10 - Centro',
    website: 'https://padariacentral.com.br',
    phone: '+55 11 99999-0000',
    instagram: '@padariacentral',
    rating: null,
    reviewCount: null,
    category: 'bakery',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5502,
    longitude: -46.63,
    externalId: 'node/1',
    source: 'search',
    sources: ['search'],
    ...overrides,
  };
}

describe('discovery-merge', () => {
  it('une Google e OSM pelo nome e preenche contato', () => {
    const merged = mergeDiscoveryResults([googleLead()], [osmLead()], place);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('google');
    expect(merged[0].sources).toEqual(
      expect.arrayContaining(['google', 'search']),
    );
    expect(merged[0].website).toBe('https://padariacentral.com.br');
    expect(merged[0].phone).toBe('+55 11 99999-0000');
    expect(merged[0].instagram).toBe('@padariacentral');
    expect(merged[0].rating).toBe(4.5);
  });

  it('não une o mesmo nome quando as coordenadas estão longe', () => {
    const merged = mergeDiscoveryResults(
      [googleLead()],
      [
        osmLead({
          latitude: -23.6,
          longitude: -46.7,
          website: 'https://outra.com',
        }),
      ],
      place,
    );
    expect(merged).toHaveLength(2);
  });

  it('une por proximidade quando o nome é parecido', () => {
    const merged = mergeDiscoveryResults(
      [googleLead({ name: 'Padaria Central Ltda' })],
      [osmLead({ name: 'Padaria Central' })],
      place,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].website).toContain('padariacentral');
  });

  it('mantém OSM sem par no Google', () => {
    const merged = mergeDiscoveryResults(
      [googleLead()],
      [osmLead({ name: 'Café da Esquina', latitude: -23.57, longitude: -46.65 })],
      place,
    );
    expect(merged).toHaveLength(2);
    expect(merged[1].source).toBe('search');
    expect(merged[1].sources).toEqual(['search']);
  });

  it('reconhece nomes semelhantes', () => {
    expect(namesSimilar('Padaria Central Ltda', 'Padaria Central')).toBe(true);
    expect(namesSimilar('Restaurante Foo', 'Barbearia Bar')).toBe(false);
  });
});
