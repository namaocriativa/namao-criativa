import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProposalService } from './proposal.service';

describe('ProposalService', () => {
  const prisma = {
    proposal: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lead: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    leadActivity: { create: jest.fn() },
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'NAMAO_PIX_KEY') return '12345678000199';
      if (key === 'NAMAO_CNPJ') return '12.345.678/0001-99';
      if (key === 'NAMAO_LEGAL_NAME') return 'Namão Criativa';
      return null;
    }),
  };
  const owners = {
    requireKind: jest.fn().mockResolvedValue('lead'),
    kindOf: jest.fn().mockResolvedValue('lead'),
  };
  const packages = {
    requireActive: jest.fn(),
  };
  const convert = { convert: jest.fn() };
  const service = new ProposalService(
    prisma as never,
    config as never,
    owners as never,
    packages as never,
    convert as never,
  );

  const snapshot = {
    name: 'Site',
    summary: 'Presença',
    description: null,
    benefits: ['Google'],
    price: 1200,
    promoPrice: 800,
    currency: 'BRL',
  };

  const pending = {
    id: 'prop-1',
    status: 'pending',
    paymentStatus: 'pending',
    collectPayment: true,
    acceptedAt: null,
    paidAt: null,
    packageSnapshot: snapshot,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    owners.requireKind.mockResolvedValue('lead');
    owners.kindOf.mockResolvedValue('lead');
    config.get.mockImplementation((key: string) => {
      if (key === 'NAMAO_PIX_KEY') return '12345678000199';
      if (key === 'NAMAO_CNPJ') return '12.345.678/0001-99';
      if (key === 'NAMAO_LEGAL_NAME') return 'Namão Criativa';
      return null;
    });
    packages.requireActive.mockResolvedValue({
      id: 'pkg-1',
      ...snapshot,
    });
    prisma.lead.findUnique.mockResolvedValue({ tenantId: 't1' });
  });

  it('cria proposta no envio', async () => {
    prisma.proposal.findFirst.mockResolvedValue(null);
    prisma.proposal.create.mockResolvedValue(pending);
    await service.upsertFromSend('lead-1', 'pkg-1');
    expect(prisma.proposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't1',
        leadId: 'lead-1',
        packageId: 'pkg-1',
        status: 'pending',
      }),
    });
  });

  it('atualiza snapshot se ainda pendente', async () => {
    prisma.proposal.findFirst.mockResolvedValue(pending);
    prisma.proposal.update.mockResolvedValue(pending);
    await service.upsertFromSend('lead-1', 'pkg-1');
    expect(prisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: expect.objectContaining({ packageId: 'pkg-1' }),
    });
    expect(prisma.proposal.create).not.toHaveBeenCalled();
  });

  it('não reabre proposta aceita', async () => {
    prisma.proposal.findFirst.mockResolvedValue({
      ...pending,
      status: 'accepted',
    });
    const result = await service.upsertFromSend('lead-1', 'pkg-1');
    expect(result.status).toBe('accepted');
    expect(prisma.proposal.update).not.toHaveBeenCalled();
  });

  it('aceite converte lead e marca accepted', async () => {
    prisma.proposal.findFirst
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({
        ...pending,
        status: 'accepted',
        paymentStatus: 'pending',
        acceptedAt: new Date(),
      });
    prisma.proposal.update.mockResolvedValue({
      ...pending,
      status: 'accepted',
    });
    const result = await service.accept({
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: 'CLIENT',
      tenantId: 't1',
      leadId: 'lead-1',
      customerId: null,
    });
    expect(convert.convert).toHaveBeenCalledWith('lead-1');
    expect(prisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: expect.objectContaining({ status: 'accepted' }),
    });
    expect(result.proposal?.status).toBe('accepted');
    expect(result.proposal?.pix?.brCode).toContain('br.gov.bcb.pix');
  });

  it('segundo aceite é no-op', async () => {
    prisma.proposal.findFirst.mockResolvedValue({
      ...pending,
      status: 'accepted',
      acceptedAt: new Date(),
    });
    await service.accept({
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: 'CLIENT',
      tenantId: 't1',
      leadId: null,
      customerId: 'lead-1',
    });
    expect(convert.convert).not.toHaveBeenCalled();
    expect(prisma.proposal.update).not.toHaveBeenCalled();
  });

  it('aceite sem proposta 404', async () => {
    prisma.proposal.findFirst.mockResolvedValue(null);
    await expect(
      service.accept({
        id: 'u1',
        email: 'a@b.com',
        name: 'Ana',
        role: 'CLIENT',
        tenantId: 't1',
        leadId: 'lead-1',
        customerId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca pago', async () => {
    prisma.proposal.findFirst.mockResolvedValue({
      ...pending,
      status: 'accepted',
    });
    prisma.proposal.update.mockResolvedValue({
      ...pending,
      status: 'accepted',
      paymentStatus: 'paid',
      paidAt: new Date(),
    });
    const result = await service.markPaid('lead-1');
    expect(result.proposal?.paymentStatus).toBe('paid');
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'proposal.paid' }),
    });
  });

  it('recusa cliente sem owner', async () => {
    await expect(
      service.getForClient({
        id: 'u1',
        email: 'a@b.com',
        name: 'Ana',
        role: 'CLIENT',
        tenantId: 't1',
        leadId: null,
        customerId: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
