import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { USER_ROLE } from '../auth/roles';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioUsersService } from './studio-users.service';

describe('StudioUsersService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    studioUserActivity: {
      findMany: jest.fn(),
    },
  };
  const mail = { sendStudioWelcome: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('http://localhost:5173') };
  const service = new StudioUsersService(
    prisma as never,
    mail as never,
    config as never,
  );
  const admin: JwtUser = {
    id: 'admin-1',
    email: 'admin@namao.local',
    name: 'Admin',
    role: USER_ROLE.ADMIN,
    leadId: null,
    customerId: null,
  };
  const created = {
    id: 'op-1',
    email: 'ana@namao.local',
    name: 'Ana',
    role: USER_ROLE.OPERATOR,
    createdAt: new Date('2026-09-14T12:00:00.000Z'),
    updatedAt: new Date('2026-09-14T12:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('http://localhost:5173');
    mail.sendStudioWelcome.mockResolvedValue(undefined);
  });

  it('lista só ADMIN e OPERATOR', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: [USER_ROLE.ADMIN, USER_ROLE.OPERATOR] } },
      }),
    );
  });

  it('rejeita e-mail já cadastrado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.create({ email: 'ana@namao.local' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('cria OPERATOR, gera senha e envia convite', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created);
    const result = await service.create({ email: 'ana@namao.local' });
    expect(result).toEqual(created);
    expect(result).not.toHaveProperty('password');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'ana@namao.local',
          name: 'Ana',
          role: USER_ROLE.OPERATOR,
        }),
      }),
    );
    expect(mail.sendStudioWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@namao.local',
        email: 'ana@namao.local',
        kind: 'welcome',
        loginUrl: 'http://localhost:5173/login',
      }),
    );
    const password = mail.sendStudioWelcome.mock.calls[0][0].password as string;
    expect(password.length).toBeGreaterThanOrEqual(8);
  });

  it('apaga o usuário se o e-mail falhar', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created);
    prisma.user.delete.mockResolvedValue({});
    mail.sendStudioWelcome.mockRejectedValue(new Error('resend down'));
    await expect(
      service.create({ email: 'ana@namao.local' }),
    ).rejects.toThrow('resend down');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: created.id } });
  });

  it('não remove a própria conta', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: USER_ROLE.ADMIN,
    });
    await expect(service.remove(admin.id, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('não apaga o último admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-2',
      email: 'other@namao.local',
      name: 'Other',
      role: USER_ROLE.ADMIN,
    });
    prisma.user.count.mockResolvedValue(0);
    await expect(service.remove('admin-2', admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('não encontra CLIENT', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'c1',
      email: 'cli@loja.com',
      name: 'Cli',
      role: USER_ROLE.CLIENT,
    });
    await expect(service.resetPassword('c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('envia a nova senha por e-mail e não devolve plaintext', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'op-1',
      email: 'op@namao.local',
      name: 'Operador',
      role: USER_ROLE.OPERATOR,
    });
    prisma.user.update.mockResolvedValue({});
    const result = await service.resetPassword('op-1');
    expect(result).toEqual({ ok: true });
    expect(result).not.toHaveProperty('password');
    expect(mail.sendStudioWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'op@namao.local',
        email: 'op@namao.local',
        kind: 'reset',
        loginUrl: 'http://localhost:5173/login',
      }),
    );
  });

  it('inclui conta criada no histórico', async () => {
    prisma.user.findUnique.mockResolvedValue(created);
    prisma.studioUserActivity.findMany.mockResolvedValue([
      {
        id: 'act-1',
        title: 'Entrou no studio',
        summary: 'Login no studio',
        kind: 'auth.login',
        createdAt: new Date('2026-09-14T13:00:00.000Z'),
      },
    ]);
    const { items } = await service.listActivity('op-1');
    expect(items.map((item) => item.kind)).toEqual([
      'auth.login',
      'account.created',
    ]);
  });
});
