import { JwtStrategy } from './jwt.strategy';
import { JWT_TYP } from './identity';
import { USER_ROLE } from './roles';

describe('JwtStrategy', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    clientAccount: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue('test-jwt-secret-value') };
  const strategy = new JwtStrategy(config as never, prisma as never);

  const staff = {
    id: 'staff-1',
    email: 'admin@namao.local',
    name: 'Admin',
    role: USER_ROLE.ADMIN,
  };
  const account = {
    id: 'client-1',
    email: 'ana@loja.com',
    name: 'Ana',
    leadId: 'lead-1',
    customerId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue(staff);
    prisma.clientAccount.findUnique.mockResolvedValue(account);
  });

  it('resolve staff pela tabela User', async () => {
    const user = await strategy.validate(
      { headers: {} } as never,
      { sub: 'staff-1', email: staff.email, role: USER_ROLE.ADMIN, typ: JWT_TYP.STAFF },
    );
    expect(user).toEqual({
      ...staff,
      typ: JWT_TYP.STAFF,
      leadId: null,
      customerId: null,
    });
    expect(prisma.clientAccount.findUnique).not.toHaveBeenCalled();
  });

  it('resolve portal pela tabela ClientAccount', async () => {
    const user = await strategy.validate(
      { headers: {} } as never,
      {
        sub: 'client-1',
        email: account.email,
        role: USER_ROLE.CLIENT,
        typ: JWT_TYP.CLIENT,
      },
    );
    expect(user).toEqual({
      ...account,
      role: USER_ROLE.CLIENT,
      typ: JWT_TYP.CLIENT,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('não aceita staff no cookie do site', async () => {
    const user = await strategy.validate(
      { headers: { cookie: 'namao_client_token=abc.def.ghi' } } as never,
      { sub: 'staff-1', email: staff.email, role: USER_ROLE.ADMIN, typ: JWT_TYP.STAFF },
    );
    expect(user).toBeNull();
  });

  it('não aceita portal no cookie do studio', async () => {
    const user = await strategy.validate(
      { headers: { cookie: 'namao_studio_token=abc.def.ghi' } } as never,
      {
        sub: 'client-1',
        email: account.email,
        role: USER_ROLE.CLIENT,
        typ: JWT_TYP.CLIENT,
      },
    );
    expect(user).toBeNull();
  });

  it('infere staff pelo cookie antigo sem typ', async () => {
    const user = await strategy.validate(
      { headers: { cookie: 'namao_studio_token=abc.def.ghi' } } as never,
      { sub: 'staff-1', email: staff.email, role: USER_ROLE.ADMIN },
    );
    expect(user?.typ).toBe(JWT_TYP.STAFF);
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('infere portal pelo cookie antigo sem typ', async () => {
    const user = await strategy.validate(
      { headers: { cookie: 'namao_client_token=abc.def.ghi' } } as never,
      { sub: 'client-1', email: account.email, role: USER_ROLE.CLIENT },
    );
    expect(user?.typ).toBe(JWT_TYP.CLIENT);
    expect(prisma.clientAccount.findUnique).toHaveBeenCalled();
  });
});
