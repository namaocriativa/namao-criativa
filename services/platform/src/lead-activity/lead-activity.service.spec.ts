import { NotFoundException } from '@nestjs/common';
import { LeadActivityService } from './lead-activity.service';

describe('LeadActivityService', () => {
  const prisma = {
    lead: { findUnique: jest.fn() },
    leadActivity: { create: jest.fn(), findMany: jest.fn() },
  };
  const owners = {
    requireKind: jest.fn().mockResolvedValue('lead'),
    findProfile: jest.fn(),
  };
  const service = new LeadActivityService(prisma as never, owners as never);

  beforeEach(() => {
    jest.resetAllMocks();
    owners.requireKind.mockResolvedValue('lead');
  });

  it('grava uma atividade', async () => {
    prisma.leadActivity.create.mockResolvedValue({ id: 'act-1' });
    await service.record({
      leadId: 'lead-1',
      channel: 'email',
      kind: 'site-introduction',
      title: 'E-mail enviado: Apresentação do site',
      summary: 'Enviado para ana@loja.com',
      payload: { to: 'ana@loja.com' },
    });
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: {
        leadId: 'lead-1',
        customerId: null,
        channel: 'email',
        kind: 'site-introduction',
        title: 'E-mail enviado: Apresentação do site',
        summary: 'Enviado para ana@loja.com',
        payload: { to: 'ana@loja.com' },
      },
    });
  });

  it('404 se o lead não existe', async () => {
    owners.findProfile.mockResolvedValue(null);
    await expect(service.listHistory('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mistura atividades persistidas com eventos de sistema, do mais novo ao mais antigo', async () => {
    owners.findProfile.mockResolvedValue({
      id: 'lead-1',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-03T10:00:00.000Z'),
      landingBuiltAt: new Date('2026-01-02T10:00:00.000Z'),
    });
    prisma.leadActivity.findMany.mockResolvedValue([
      {
        id: 'act-1',
        title: 'WhatsApp enviado: Acesso ao painel',
        summary: 'Enviado para +5511999999999',
        channel: 'whatsapp',
        kind: 'credentials',
        createdAt: new Date('2026-01-04T10:00:00.000Z'),
      },
    ]);

    const result = await service.listHistory('lead-1');
    expect(result.items.map((item) => item.id)).toEqual([
      'act-1',
      'system:updated',
      'system:site-built',
      'system:created',
    ]);
    expect(result.items[0]).toMatchObject({
      channel: 'whatsapp',
      kind: 'credentials',
      summary: 'Enviado para +5511999999999',
    });
  });
});
