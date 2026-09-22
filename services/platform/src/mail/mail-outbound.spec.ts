import { replyToForFrom, transactionalMailFields } from './mail-outbound';

describe('mail-outbound', () => {
  it('responde no contato quando o From é noreply', () => {
    expect(
      replyToForFrom('Namão Criativa <noreply@namaocriativa.com.br>'),
    ).toBe('contato@namaocriativa.com.br');
  });

  it('mantém o From como Reply-To quando já é um endereço humano', () => {
    expect(
      replyToForFrom('Namão Criativa <contato@namaocriativa.com.br>'),
    ).toBe('contato@namaocriativa.com.br');
  });

  it('inclui List-Unsubscribe transacional', () => {
    const fields = transactionalMailFields(
      'Namão Criativa <contato@namaocriativa.com.br>',
    );
    expect(fields.headers['List-Unsubscribe']).toBe(
      '<mailto:contato@namaocriativa.com.br>',
    );
    expect(fields.headers['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );
    expect(fields.tags).toEqual([{ name: 'category', value: 'transactional' }]);
  });
});
