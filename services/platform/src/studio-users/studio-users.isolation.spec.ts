import { USER_ROLE } from '../auth/roles';
import { StudioUsersService } from './studio-users.service';
import { runWithTenant } from '../tenant/tenant-context';
import type { JwtUser } from '../auth/jwt.strategy';

describe('StudioUsersService isolamento', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };
  const mail = { sendStudioWelcome: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('http://localhost:5173') };
  const service = new StudioUsersService(
    prisma as never,
    mail as never,
    config as never,
  );
  const admin: JwtUser = {
    id: 'admin-1',
    email: 'admin@t1.local',
    name: 'Admin',
    role: USER_ROLE.ADMIN,
    tenantId: 't1',
    leadId: null,
    customerId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5173');
  });

  it('lista só staff do tenant', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await runWithTenant('t1', () => service.list());
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 't1',
          role: { in: [USER_ROLE.ADMIN, USER_ROLE.OPERATOR] },
        },
      }),
    );
  });

  it('não encontra staff de outro tenant', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'op-2',
      email: 'b@t2.local',
      name: 'Bia',
      role: USER_ROLE.OPERATOR,
      tenantId: 't2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      runWithTenant('t1', () => service.get('op-2')),
    ).rejects.toThrow(/não encontrado/);
  });

  it('último admin é por tenant', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-2',
      email: 'other@t1.local',
      name: 'Other',
      role: USER_ROLE.ADMIN,
      tenantId: 't1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.user.count.mockResolvedValue(0);
    await expect(
      runWithTenant('t1', () => service.remove('admin-2', admin)),
    ).rejects.toThrow(/último admin/);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        role: USER_ROLE.ADMIN,
        tenantId: 't1',
        id: { not: 'admin-2' },
      },
    });
  });

  it('cria só OPERATOR no tenant atual, nunca ROOT', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'op-new',
      role: USER_ROLE.OPERATOR,
      tenantId: 't1',
    });
    mail.sendStudioWelcome.mockResolvedValue(undefined);
    await runWithTenant('t1', () =>
      service.create({ email: 'nova@t1.local' }),
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: USER_ROLE.OPERATOR,
          tenantId: 't1',
        }),
      }),
    );
  });
});
