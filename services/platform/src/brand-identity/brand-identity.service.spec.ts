import { BadRequestException } from '@nestjs/common';
import { BrandIdentityService } from './brand-identity.service';

describe('BrandIdentityService', () => {
  const prisma = {
    lead: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    leadImage: { findFirst: jest.fn() },
  };
  const owners = { requireProfile: jest.fn() };
  const storage = { readStorageFile: jest.fn() };
  const service = new BrandIdentityService(
    prisma as never,
    owners as never,
    storage as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('retorna identidade vazia quando não há campo', async () => {
    owners.requireProfile.mockResolvedValue({ kind: 'lead', id: 'lead-1' });
    prisma.lead.findUnique.mockResolvedValue({ brandIdentity: null });
    await expect(service.get('lead-1')).resolves.toEqual({});
  });

  it('salva identidade e valida logo do perfil', async () => {
    owners.requireProfile.mockResolvedValue({ kind: 'lead', id: 'lead-1' });
    prisma.leadImage.findFirst.mockResolvedValue({
      id: 'img-1',
      localPath: 'storage/leads/lead-1/images/logo.png',
    });
    prisma.lead.update.mockResolvedValue({});
    const saved = await service.put('lead-1', {
      logoImageId: 'img-1',
      primaryColor: '#a1b2c3',
      voice: 'próximo',
    });
    expect(saved).toEqual(
      expect.objectContaining({
        logoImageId: 'img-1',
        primaryColor: '#A1B2C3',
        voice: 'próximo',
      }),
    );
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        brandIdentity: expect.objectContaining({ logoImageId: 'img-1' }),
      }),
    });
  });

  it('recusa logo de outro perfil', async () => {
    owners.requireProfile.mockResolvedValue({ kind: 'lead', id: 'lead-1' });
    prisma.leadImage.findFirst.mockResolvedValue(null);
    await expect(
      service.put('lead-1', { logoImageId: 'alien' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
