import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadService } from './lead.service';

function leadFixture() {
  return {
    id: 'lead-1',
    name: 'Firma',
    images: [],
  };
}

describe('LeadService images', () => {
  const prisma = {
    lead: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    leadImage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const storage = {
    saveUploadedImage: jest.fn(),
    removeImageFile: jest.fn(),
    removeLeadDir: jest.fn(),
  };

  const service = new LeadService(prisma as never, storage as never, {
    present: (_user: unknown, record: unknown) => record,
    visibleWhere: () => ({}),
  } as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.lead.findUnique.mockResolvedValue(leadFixture());
  });

  it('grava upload e devolve o lead', async () => {
    storage.saveUploadedImage.mockResolvedValue({
      sourceUrl: 'upload://abc',
      localPath: 'storage/leads/lead-1/images/upload-a.jpg',
      filename: 'upload-a.jpg',
      mimeType: 'image/jpeg',
      width: null,
      height: null,
    });
    prisma.leadImage.create.mockResolvedValue({});

    const result = await service.addImages('lead-1', [
      {
        buffer: Buffer.from('fake-jpeg'),
        originalname: 'foto.jpg',
        mimetype: 'image/jpeg',
        size: 9,
      },
    ]);

    expect(storage.saveUploadedImage).toHaveBeenCalledWith(
      'lead-1',
      expect.any(Buffer),
      'foto.jpg',
      'image/jpeg',
    );
    expect(prisma.leadImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        source: 'upload',
        filename: 'upload-a.jpg',
      }),
    });
    expect(result.id).toBe('lead-1');
  });

  it('recusa tipo não permitido', async () => {
    await expect(
      service.addImages('lead-1', [
        {
          buffer: Buffer.from('<svg></svg>'),
          originalname: 'x.svg',
          mimetype: 'image/svg+xml',
          size: 11,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.saveUploadedImage).not.toHaveBeenCalled();
  });

  it('remove arquivo e registro da imagem', async () => {
    prisma.leadImage.findFirst.mockResolvedValue({
      id: 'img-1',
      leadId: 'lead-1',
      localPath: 'storage/leads/lead-1/images/a.jpg',
    });
    prisma.leadImage.delete.mockResolvedValue({});

    await service.deleteImage('lead-1', 'img-1');

    expect(storage.removeImageFile).toHaveBeenCalledWith(
      'storage/leads/lead-1/images/a.jpg',
    );
    expect(prisma.leadImage.delete).toHaveBeenCalledWith({
      where: { id: 'img-1' },
    });
  });

  it('atualiza contato e devolve o lead', async () => {
    prisma.lead.update.mockResolvedValue({});
    prisma.lead.findUnique.mockResolvedValue({
      ...leadFixture(),
      email: 'contato@firma.com',
      phone: '19999990000',
    });

    const result = await service.update('lead-1', {
      email: 'contato@firma.com',
      phone: '19999990000',
      website: null,
    });

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: {
        email: 'contato@firma.com',
        phone: '19999990000',
        website: null,
      },
    });
    expect(result.email).toBe('contato@firma.com');
  });

  it('não grava update se o payload está vazio', async () => {
    await service.update('lead-1', {});
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it('404 se a imagem não pertence ao lead', async () => {
    prisma.leadImage.findFirst.mockResolvedValue(null);
    await expect(service.deleteImage('lead-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
