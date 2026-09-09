import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sha256 } from './chat-crypto';
import { ChatSessionService } from './session.service';

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    chatSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  };
}

function ownersMock() {
  return {
    findByPublicSiteId: jest.fn(),
    requireProfile: jest.fn(),
  };
}

describe('ChatSessionService', () => {
  it('retorna 404 para site inexistente ou chat desligado', async () => {
    const prisma = prismaMock();
    const owners = ownersMock();
    owners.findByPublicSiteId.mockResolvedValue(null);
    const service = new ChatSessionService(prisma as never, owners as never);
    await expect(
      service.create({ siteId: 'site_x', ip: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    owners.findByPublicSiteId.mockResolvedValue({
      kind: 'lead',
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
    const owners = ownersMock();
    owners.findByPublicSiteId.mockResolvedValue({
      kind: 'lead',
      id: 'lead1',
      chatEnabled: true,
      publicSiteId: 'site_ok',
    });
    (prisma.chatSession.create as jest.Mock).mockImplementation(
      async ({ data }) => data,
    );
    const service = new ChatSessionService(prisma as never, owners as never);
    const created = await service.create({ siteId: 'site_ok', ip: '1.1.1.1' });
    const saved = (prisma.chatSession.create as jest.Mock).mock.calls[0][0]
      .data;
    expect(saved.tokenHash).toBe(sha256(created.sessionToken));
    expect(saved.tokenHash).not.toBe(created.sessionToken);
    expect(created.sessionId.startsWith('sess_')).toBe(true);
    expect(saved.leadId).toBe('lead1');
    expect(saved.customerId).toBeNull();
    expect(saved.channel).toBe('landing');
  });

  it('rejeita token expirado', async () => {
    const prisma = prismaMock();
    const owners = ownersMock();
    (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess_1',
      status: 'active',
      expiresAt: new Date(Date.now() - 1000),
      leadId: 'lead1',
      customerId: null,
    });
    const service = new ChatSessionService(prisma as never, owners as never);
    await expect(service.resolve('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.chatSession.update).toHaveBeenCalled();
  });
});
