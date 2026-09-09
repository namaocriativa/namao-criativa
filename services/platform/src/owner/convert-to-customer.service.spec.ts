import { NotFoundException } from '@nestjs/common';
import { ConvertToCustomerService } from './convert-to-customer.service';

describe('ConvertToCustomerService', () => {
  const tx = {
    lead: { update: jest.fn(), delete: jest.fn() },
    customer: { create: jest.fn() },
    leadImage: { updateMany: jest.fn() },
    leadSource: { updateMany: jest.fn() },
    user: { updateMany: jest.fn() },
    invite: { updateMany: jest.fn() },
    instagramConnection: { updateMany: jest.fn() },
    landingJob: { updateMany: jest.fn() },
    landingGeneration: { updateMany: jest.fn() },
    chatSession: { updateMany: jest.fn() },
    chatEvent: { updateMany: jest.fn() },
    leadActivity: { updateMany: jest.fn(), create: jest.fn() },
  };

  const prisma = {
    lead: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) =>
      fn(tx),
    ),
  };
  const owners = {
    requireDetail: jest.fn(),
  };

  const service = new ConvertToCustomerService(
    prisma as never,
    owners as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
    );
  });

  it('404 se o lead não existe', async () => {
    prisma.lead.findUnique.mockResolvedValue(null);
    await expect(service.convert('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('copia campos, reassocia filhos e apaga o lead sem limpar storage', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      category: 'advocacia',
      description: 'desc',
      phone: '11',
      whatsapp: '11',
      email: 'a@b.com',
      website: 'https://x.com',
      address: null,
      city: 'SP',
      state: 'SP',
      country: 'BR',
      latitude: null,
      longitude: null,
      instagram: null,
      facebook: null,
      linkedin: null,
      services: ['a'],
      rating: 4,
      reviewCount: 2,
      metadata: { k: 1 },
      generateConfig: { sections: [] },
      landingSlug: 'firma',
      landingStatus: 'built',
      landingBuiltAt: new Date('2026-01-02'),
      activeLandingJobId: null,
      publicSiteId: 'site-1',
      chatEnabled: true,
      publishedOrigin: 'https://firma.vercel.app',
      vercelProjectId: 'prj',
      vercelDeploymentId: 'dpl',
      fromPublicSignup: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-03'),
    });
    owners.requireDetail.mockResolvedValue({ id: 'lead-1', name: 'Firma' });

    const result = await service.convert('lead-1');

    expect(tx.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { landingSlug: null, publicSiteId: null },
    });
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'lead-1',
        name: 'Firma',
        landingSlug: 'firma',
        publicSiteId: 'site-1',
        fromPublicSignup: true,
      }),
    });
    expect(tx.leadImage.updateMany).toHaveBeenCalledWith({
      where: { leadId: 'lead-1' },
      data: { customerId: 'lead-1', leadId: null },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { leadId: 'lead-1' },
      data: { customerId: 'lead-1', leadId: null },
    });
    expect(tx.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    expect(tx.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'lead-1',
        leadId: null,
        kind: 'converted',
      }),
    });
    expect(result).toEqual({ id: 'lead-1', name: 'Firma' });
  });
});
