import { nameFromEmail } from './studio-users.util';

describe('nameFromEmail', () => {
  it('transforma a parte local em nome', () => {
    expect(nameFromEmail('ana.silva@namao.local')).toBe('Ana Silva');
  });

  it('cai para Operador se a parte local for vazia', () => {
    expect(nameFromEmail('@namao.local')).toBe('Operador');
  });
});
