import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sha256 } from './chat-crypto';
import { ChatSessionService } from './session.service';

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    lead: {
      findUnique: jest.fn(),
    },
    chatSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  };
}

describe('ChatSessionService', () => {
  it('retorna 404 para site inexistente ou chat desligado', async () => {
    const prisma = prismaMock();
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new ChatSessionService(prisma as never);
    await expect(
      service.create({ siteId: 'site_x', ip: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'lead1',
      chatEnabled: false,
      publicSiteId: 'site_x',
    });
    await expect(
      service.create({ siteId: 'site_x', ip: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('grava só o hash do token', async () => {
    const prisma = prismaMock();
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'lead1',
      chatEnabled: true,
      publicSiteId: 'site_ok',
    });
    (prisma.chatSession.create as jest.Mock).mockImplementation(
      async ({ data }) => data,
    );
    const service = new ChatSessionService(prisma as never);
    const created = await service.create({ siteId: 'site_ok', ip: '1.1.1.1' });
    const saved = (prisma.chatSession.create as jest.Mock).mock.calls[0][0]
      .data;
    expect(saved.tokenHash).toBe(sha256(created.sessionToken));
    expect(saved.tokenHash).not.toBe(created.sessionToken);
    expect(created.sessionId.startsWith('sess_')).toBe(true);
  });

  it('rejeita token expirado', async () => {
    const prisma = prismaMock();
    (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess_1',
      status: 'active',
      expiresAt: new Date(Date.now() - 1000),
      lead: { chatEnabled: true },
    });
    const service = new ChatSessionService(prisma as never);
    await expect(service.resolve('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.chatSession.update).toHaveBeenCalled();
  });
});
