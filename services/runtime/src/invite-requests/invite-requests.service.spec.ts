import { HttpException, HttpStatus } from '@nestjs/common';
import { InviteRequestsService } from './invite-requests.service';

function req(ip = '127.0.0.1') {
  return { ip, headers: {}, socket: { remoteAddress: ip } } as never;
}

describe('InviteRequestsService', () => {
  const dto = {
    name: 'Ana',
    email: 'ana@loja.com',
    instagram: 'loja_ana',
  };

  it('não cria de novo se o e-mail já existe', async () => {
    const mongo = {
      prisma: {
        inviteRequest: {
          findFirst: jest.fn().mockResolvedValue({ id: '1' }),
          create: jest.fn(),
        },
      },
    };
    const rateLimit = { tooMany: jest.fn().mockResolvedValue(false) };
    const service = new InviteRequestsService(
      mongo as never,
      rateLimit as never,
    );
    await expect(service.create(req(), dto)).resolves.toEqual({ ok: true });
    expect(mongo.prisma.inviteRequest.create).not.toHaveBeenCalled();
  });

  it('grava pedido novo', async () => {
    const mongo = {
      prisma: {
        inviteRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: '2' }),
        },
      },
    };
    const rateLimit = { tooMany: jest.fn().mockResolvedValue(false) };
    const service = new InviteRequestsService(
      mongo as never,
      rateLimit as never,
    );
    await expect(service.create(req(), dto)).resolves.toEqual({ ok: true });
    expect(mongo.prisma.inviteRequest.create).toHaveBeenCalledWith({
      data: {
        name: 'Ana',
        email: 'ana@loja.com',
        instagram: 'loja_ana',
        status: 'pending',
      },
    });
  });

  it('bloqueia excesso de pedidos', async () => {
    const mongo = { prisma: { inviteRequest: { findFirst: jest.fn() } } };
    const rateLimit = { tooMany: jest.fn().mockResolvedValue(true) };
    const service = new InviteRequestsService(
      mongo as never,
      rateLimit as never,
    );
    const err = await service.create(req(), dto).catch((error) => error);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });
});
