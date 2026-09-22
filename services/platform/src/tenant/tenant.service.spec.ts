import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';
import { TenantService } from './tenant.service';
import { TENANT_STATUS } from './tenant.constants';

describe('TenantService', () => {
  const prisma = {
    tenant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    offerTemplate: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    studioUserActivity: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const auth = {
    impersonateTenant: jest.fn(),
    stopImpersonation: jest.fn(),
  };
  const mail = { sendStudioWelcome: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('http://localhost:5173') };
  const service = new TenantService(
    prisma as never,
    auth as never,
    mail as never,
    config as never,
  );
  const root: JwtUser = {
    id: 'root-1',
    email: 'root@namao.local',
    name: 'Root',
    role: USER_ROLE.ROOT,
    tenantId: null,
    leadId: null,
    customerId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5173');
    mail.sendStudioWelcome.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
  });

  it('lista tenants', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.tenant.findMany).toHaveBeenCalled();
  });

  it('não cria conta se o e-mail já existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.create({ name: 'Agência', adminEmail: 'ana@ag.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });

  it('cria tenant, admin e template', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.tenant.create.mockResolvedValue({
      id: 't-new',
      name: 'Agência',
      slug: 'agencia',
      status: TENANT_STATUS.ACTIVE,
    });
    prisma.user.create.mockResolvedValue({});
    prisma.offerTemplate.create.mockResolvedValue({});
    const result = await service.create({
      name: 'Agência',
      adminEmail: 'ana@ag.com',
    });
    expect(result.id).toBe('t-new');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'ana@ag.com',
          role: USER_ROLE.ADMIN,
          tenantId: 't-new',
        }),
      }),
    );
    expect(mail.sendStudioWelcome).toHaveBeenCalled();
  });

  it('impersona só como ROOT', async () => {
    const admin: JwtUser = { ...root, role: USER_ROLE.ADMIN, tenantId: 't1' };
    await expect(service.impersonate(admin, 't1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('impersona tenant ativo', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Namão',
      status: TENANT_STATUS.ACTIVE,
    });
    auth.impersonateTenant.mockReturnValue({
      accessToken: 'tok',
      user: { ...root, tenantId: 't1' },
    });
    const issued = await service.impersonate(root, 't1');
    expect(auth.impersonateTenant).toHaveBeenCalledWith(
      root,
      expect.objectContaining({ id: 't1' }),
    );
    expect(issued.accessToken).toBe('tok');
  });

  it('activity só lista eventos do tenant pedido', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't-a',
      name: 'Agência A',
      slug: 'agencia-a',
      status: TENANT_STATUS.ACTIVE,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      _count: { users: 1, leads: 2, customers: 0 },
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u-a',
        email: 'ana@ag.com',
        name: 'Ana',
        role: USER_ROLE.ADMIN,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);
    prisma.studioUserActivity.findMany.mockResolvedValue([
      {
        id: 'act-a',
        title: 'Entrou no studio',
        summary: 'Ana',
        kind: 'auth.login',
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
        user: { id: 'u-a', name: 'Ana', email: 'ana@ag.com' },
      },
    ]);
    const result = await service.activity('t-a');
    expect(prisma.studioUserActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { tenantId: 't-a' } },
        take: 100,
      }),
    );
    expect(result.id).toBe('t-a');
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'act-a', title: 'Entrou no studio' }),
    ]);
    expect(result.staff).toHaveLength(1);
  });

  it('sai da impersonação e volta ao console', () => {
    auth.stopImpersonation.mockReturnValue({
      accessToken: 'root-tok',
      user: root,
    });
    const issued = service.stopImpersonation({
      ...root,
      tenantId: 't1',
      impersonatingTenantId: 't1',
    });
    expect(auth.stopImpersonation).toHaveBeenCalled();
    expect(issued.user.tenantId).toBeNull();
  });
});
