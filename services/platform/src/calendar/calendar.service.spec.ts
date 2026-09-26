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
    contentCalendarReminder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
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
  const llm = { generateJson: jest.fn() };
  const service = new CalendarService(
    prisma as never,
    storage as never,
    llm as never,
  );

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

  it('recusa ideias sem perfil', async () => {
    await expect(service.generateIdeas({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cria rascunhos espaçados a partir das ideias', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1' });
    prisma.contentCalendarPost.create.mockImplementation(async (args: { data: { title: string } }) => ({
      id: `post-${args.data.title}`,
    }));
    await runWithTenant('tenant-1', () =>
      service.createFromIdeas(
        {
          leadId: 'lead-1',
          startAt: '2026-09-26T13:00:00.000Z',
          ideas: [
            {
              title: 'Dor 1',
              hook: 'Hook 1',
              caption: 'Salve este post',
              format: 'carousel',
            },
            {
              title: 'Dor 2',
              hook: 'Hook 2',
              caption: 'Comenta EU QUERO',
              format: 'reel',
            },
          ],
        },
        'user-1',
      ),
    );
    expect(prisma.contentCalendarPost.create).toHaveBeenCalledTimes(2);
    const first = prisma.contentCalendarPost.create.mock.calls[0][0].data;
    const second = prisma.contentCalendarPost.create.mock.calls[1][0].data;
    expect(first.title).toBe('Dor 1');
    expect(second.scheduledAt.getTime() - first.scheduledAt.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it('filtra o mês por lead quando o query vem', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1' });
    prisma.contentCalendarPost.findMany.mockResolvedValue([]);
    await runWithTenant('tenant-1', () =>
      service.findRange(
        '2026-09-01T00:00:00.000Z',
        '2026-09-30T23:59:59.000Z',
        { leadId: 'lead-1' },
      ),
    );
    expect(prisma.contentCalendarPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leadId: 'lead-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('recusa filtro com lead e cliente juntos', async () => {
    await expect(
      service.findRange(undefined, undefined, {
        leadId: 'lead-1',
        customerId: 'cust-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cria lembrete no perfil e lista no range', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1' });
    prisma.contentCalendarReminder.create.mockResolvedValue({ id: 'rem-1' });
    await runWithTenant('tenant-1', () =>
      service.createReminder(
        {
          title: 'Filmar depoimento',
          notes: 'Levar tripé',
          scheduledAt: '2026-09-22T14:00:00.000Z',
          leadId: 'lead-1',
        },
        'user-1',
      ),
    );
    expect(prisma.contentCalendarReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Filmar depoimento',
          notes: 'Levar tripé',
          status: 'open',
          tenantId: 'tenant-1',
          leadId: 'lead-1',
          customerId: null,
          createdByUserId: 'user-1',
        }),
      }),
    );
  });

  it('recusa lembrete sem perfil', async () => {
    await expect(
      service.createReminder(
        {
          title: 'X',
          scheduledAt: '2026-09-22T14:00:00.000Z',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca lembrete como feito', async () => {
    prisma.contentCalendarReminder.findUnique.mockResolvedValue({
      id: 'rem-1',
      tenantId: 'tenant-1',
    });
    prisma.contentCalendarReminder.update.mockResolvedValue({ id: 'rem-1' });
    await runWithTenant('tenant-1', () =>
      service.updateReminder('rem-1', { status: 'done' }),
    );
    expect(prisma.contentCalendarReminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-1' },
      data: { status: 'done' },
    });
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
