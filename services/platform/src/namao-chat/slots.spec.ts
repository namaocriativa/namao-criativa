import { mergeSlots, missingSlot, slotsComplete } from './slots';

describe('namao-chat slots', () => {
  it('extrai nome simples sem tratar como Instagram', () => {
    expect(mergeSlots({}, 'Ana')).toEqual({ name: 'Ana' });
    expect(mergeSlots({}, 'João Silva')).toEqual({ name: 'João Silva' });
  });

  it('ignora frases que não são nome', () => {
    expect(mergeSlots({}, 'Quero criar conta')).toEqual({});
    expect(mergeSlots({}, 'Quais serviços vocês oferecem?')).toEqual({});
  });

  it('extrai e-mail e Instagram explícito', () => {
    expect(mergeSlots({ name: 'Ana' }, 'ana@loja.com')).toEqual({
      name: 'Ana',
      email: 'ana@loja.com',
    });
    expect(mergeSlots({ name: 'Ana', email: 'ana@loja.com' }, '@loja.ana')).toEqual({
      name: 'Ana',
      email: 'ana@loja.com',
      instagram: 'loja.ana',
    });
  });

  it('não trata handle sem @ como Instagram no primeiro passo', () => {
    expect(mergeSlots({}, 'loja_ana')).toEqual({});
    expect(
      mergeSlots({ name: 'Ana', email: 'ana@loja.com' }, 'loja_ana'),
    ).toEqual({
      name: 'Ana',
      email: 'ana@loja.com',
      instagram: 'loja_ana',
    });
  });

  it('marca cadastro completo na ordem nome → e-mail → Instagram', () => {
    let slots = mergeSlots({}, 'Maria Souza');
    expect(missingSlot(slots)).toBe('email');
    slots = mergeSlots(slots, 'maria@negocio.com');
    expect(missingSlot(slots)).toBe('instagram');
    slots = mergeSlots(slots, 'https://instagram.com/maria.negocio');
    expect(slotsComplete(slots)).toBe(true);
    expect(slots.instagram).toBe('maria.negocio');
  });
});
