import { BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { runWithTenant } from '../tenant/tenant-context';

describe('CalendarService', () => {
  const prisma = {
    contentCalendarPost: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    contentCalendarTarget: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    contentCalendarAsset: {
      create: jest.fn(),
    },
    lead: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
  };
  const storage = {
    saveCalendarAsset: jest.fn(),
    removeCalendarDir: jest.fn(),
    removeImageFile: jest.fn(),
    readStorageFile: jest.fn(),
  };
  const service = new CalendarService(prisma as never, storage as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('cria post em rascunho com alvos por plataforma', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1' });
    prisma.contentCalendarPost.create.mockResolvedValue({ id: 'post-1' });
    await runWithTenant('tenant-1', () =>
      service.create(
        {
          title: 'Reel cobertura',
          caption: 'Vamos nessa',
          scheduledAt: '2026-09-20T18:00:00.000Z',
          platforms: ['instagram', 'tiktok', 'instagram'],
          leadId: 'lead-1',
        },
        'user-1',
      ),
    );
    expect(prisma.contentCalendarPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Reel cobertura',
          status: 'draft',
          tenantId: 'tenant-1',
          leadId: 'lead-1',
          customerId: null,
          createdByUserId: 'user-1',
          targets: {
            create: [
              { platform: 'instagram', status: 'pending' },
              { platform: 'tiktok', status: 'pending' },
            ],
          },
        }),
      }),
    );
  });

  it('rejeita lead e cliente juntos', async () => {
    await expect(
      service.create(
        {
          title: 'X',
          scheduledAt: '2026-09-20T18:00:00.000Z',
          platforms: ['youtube'],
          leadId: 'lead-1',
          customerId: 'cust-1',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('agenda só com mídia', async () => {
    prisma.contentCalendarPost.findUnique.mockResolvedValue({
      id: 'post-1',
      targets: [{ platform: 'instagram', status: 'pending' }],
      assets: [],
    });
    await expect(service.schedule('post-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
