import {
  isBlockedWebsite,
  selectOfficialWebsite,
  tokenizeBusinessName,
} from './official-website';

describe('official-website', () => {
  describe('selectOfficialWebsite', () => {
    it('rejeita diretório/marketplace quando o estabelecimento não tem site', () => {
      expect(
        selectOfficialWebsite(
          [
            'https://restaurantguru.com.br/',
            'https://www.ifood.com.br/delivery/leme-sp/suricato-padaria',
            'https://www.instagram.com/suricatopadaria/',
            'https://www.tripadvisor.com.br/Restaurant_Review-Suricato.html',
          ],
          'Suricato Padaria',
        ),
      ).toBeNull();
    });

    it('não escolhe o primeiro resultado só porque ele aparece na busca', () => {
      expect(
        selectOfficialWebsite(
          ['https://restaurantguru.com.br/', 'https://guiamais.com.br/leme/suricato'],
          'Suricato Padaria',
        ),
      ).toBeNull();
    });

    it('aceita domínio que contém o nome distintivo do negócio', () => {
      expect(
        selectOfficialWebsite(
          [
            'https://restaurantguru.com.br/',
            'https://suricatopadaria.com.br/cardapio',
          ],
          'Suricato Padaria',
        ),
      ).toBe('https://suricatopadaria.com.br/');
    });

    it('não usa palavra genérica do ramo para casar outro estabelecimento', () => {
      expect(
        selectOfficialWebsite(
          ['https://padariadoleme.com.br/', 'https://restaurantguru.com.br/'],
          'Suricato Padaria',
        ),
      ).toBeNull();
    });

    it('casa nome distintivo mesmo com tipo genérico no domínio', () => {
      expect(
        selectOfficialWebsite(
          ['https://padariacentral.com.br/'],
          'Padaria Central',
        ),
      ).toBe('https://padariacentral.com.br/');
    });

    it('não inventa site quando o nome não tem token distintivo', () => {
      expect(
        selectOfficialWebsite(
          ['https://padariadoleme.com.br/', 'https://exemplo.com.br/'],
          'Padaria',
        ),
      ).toBeNull();
    });
  });

  describe('isBlockedWebsite', () => {
    it('bloqueia restaurantguru e ifood', () => {
      expect(isBlockedWebsite('https://restaurantguru.com.br/')).toBe(true);
      expect(
        isBlockedWebsite('https://www.ifood.com.br/delivery/leme-sp/foo'),
      ).toBe(true);
      expect(isBlockedWebsite('https://suricatopadaria.com.br/')).toBe(false);
    });
  });

  describe('tokenizeBusinessName', () => {
    it('ignora tipo de negócio genérico', () => {
      expect(tokenizeBusinessName('Suricato Padaria')).toEqual(['suricato']);
    });
  });
});
