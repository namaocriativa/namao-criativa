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
  };
  const mail = { sendCredentials: jest.fn().mockResolvedValue(undefined) };
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

  beforeEach(() => {
    jest.resetAllMocks();
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
      service.create({
        name: 'Ana',
        email: 'ana@namao.local',
        password: 'password1',
        role: USER_ROLE.OPERATOR,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
    expect(mail.sendCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'op@namao.local',
        email: 'op@namao.local',
        loginUrl: 'http://localhost:5173/login',
      }),
    );
  });
});
