import { BadRequestException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { runWithTenant } from '../tenant/tenant-context';

describe('PackagesService', () => {
  const prisma = {
    package: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    offerTemplate: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const storage = {
    removePackageDir: jest.fn(),
    saveUploadedPackageImage: jest.fn(),
    removeImageFile: jest.fn(),
  };
  const service = new PackagesService(prisma as never, storage as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejeita promocional sem preço cheio', () => {
    expect(() => service.assertPromoPrice(null, 80)).toThrow(BadRequestException);
    expect(() => service.assertPromoPrice(100, 100)).toThrow(BadRequestException);
    expect(() => service.assertPromoPrice(100, 120)).toThrow(BadRequestException);
    expect(() => service.assertPromoPrice(100, 80)).not.toThrow();
    expect(() => service.assertPromoPrice(100, null)).not.toThrow();
  });

  it('atribui sortOrder seguinte na criação', async () => {
    prisma.package.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    prisma.package.create.mockResolvedValue({ id: 'pkg-1', sortOrder: 4 });
    await runWithTenant('tenant-1', () => service.create({ name: 'Site' }));
    expect(prisma.package.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Site',
          tenantId: 'tenant-1',
          sortOrder: 4,
          promoPrice: null,
        }),
      }),
    );
  });

  it('cria o template padrão na primeira leitura', async () => {
    prisma.offerTemplate.upsert.mockResolvedValue({ id: 'tpl-1' });
    await runWithTenant('tenant-1', () => service.getOfferTemplate());
    expect(prisma.offerTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        create: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
  });
});
