import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { runWithTenant } from '../tenant/tenant-context';
import { fetchWebsiteSnippet } from './calendar-carousel.prompt';

jest.mock('./calendar-carousel.prompt', () => {
  const actual = jest.requireActual('./calendar-carousel.prompt') as object;
  return {
    ...actual,
    fetchWebsiteSnippet: jest.fn().mockResolvedValue('Studio no centro'),
  };
});

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
  const creativeStudio = { generateCarousel: jest.fn() };
  const user = { id: 'user-1' };
  const service = new CalendarService(
    prisma as never,
    storage as never,
    llm as never,
    creativeStudio as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(fetchWebsiteSnippet).mockResolvedValue('Studio no centro');
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

  it('recusa carrossel sem link', async () => {
    await expect(
      service.createFromCarousel(
        {
          sourceUrl: '   ',
          scheduledAt: '2026-09-26T13:00:00.000Z',
          leadId: 'lead-1',
        },
        user as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa carrossel sem perfil', async () => {
    await expect(
      service.createFromCarousel(
        {
          sourceUrl: 'https://www.instagram.com/loja_ana/',
          scheduledAt: '2026-09-26T13:00:00.000Z',
        },
        user as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gera carrossel do Instagram, cria rascunho e anexa slides sem scrape', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Loja Ana',
      category: 'Estética',
    });
    prisma.contentCalendarPost.create.mockResolvedValue({ id: 'post-1' });
    prisma.contentCalendarPost.findUnique.mockResolvedValue({
      id: 'post-1',
      tenantId: 'tenant-1',
      targets: [],
      assets: [],
    });
    creativeStudio.generateCarousel.mockResolvedValue({
      spec: {
        caption: 'Salve este carrossel',
        slides: [{ headline: 'Dor da rotina' }],
      },
      assets: [{ id: 'img-1' }, { id: 'img-2' }],
    });
    const attach = jest
      .spyOn(service, 'attachStudioAsset')
      .mockResolvedValue({ id: 'post-1' } as never);

    await runWithTenant('tenant-1', () =>
      service.createFromCarousel(
        {
          sourceUrl: 'https://www.instagram.com/loja_ana/',
          scheduledAt: '2026-09-26T13:00:00.000Z',
          leadId: 'lead-1',
          notes: 'Tom direto',
        },
        user as never,
      ),
    );

    expect(fetchWebsiteSnippet).not.toHaveBeenCalled();
    expect(creativeStudio.generateCarousel).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('https://www.instagram.com/loja_ana/'),
        notes: 'Tom direto',
      }),
      user,
    );
    expect(prisma.contentCalendarPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Dor da rotina',
          caption: 'Salve este carrossel',
          status: 'draft',
          leadId: 'lead-1',
        }),
      }),
    );
    expect(attach).toHaveBeenCalledTimes(2);
    expect(attach).toHaveBeenCalledWith('post-1', {
      source: 'image-studio',
      assetId: 'img-1',
    });
  });

  it('enriquece site (não Instagram) antes de gerar o carrossel', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Loja Ana',
    });
    prisma.contentCalendarPost.create.mockResolvedValue({ id: 'post-1' });
    prisma.contentCalendarPost.findUnique.mockResolvedValue({
      id: 'post-1',
      tenantId: 'tenant-1',
      targets: [],
      assets: [],
    });
    creativeStudio.generateCarousel.mockResolvedValue({
      spec: { caption: 'Salve', slides: [{ headline: 'Capa' }] },
      assets: [{ id: 'img-1' }],
    });
    jest
      .spyOn(service, 'attachStudioAsset')
      .mockResolvedValue({ id: 'post-1' } as never);

    await runWithTenant('tenant-1', () =>
      service.createFromCarousel(
        {
          sourceUrl: 'https://loja-ana.com.br',
          scheduledAt: '2026-09-26T13:00:00.000Z',
          leadId: 'lead-1',
        },
        user as never,
      ),
    );

    expect(fetchWebsiteSnippet).toHaveBeenCalledWith('https://loja-ana.com.br/');
    expect(creativeStudio.generateCarousel).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Studio no centro'),
      }),
      user,
    );
  });

  it('recusa carrossel sem slides gerados', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Loja Ana',
    });
    creativeStudio.generateCarousel.mockResolvedValue({
      spec: { caption: '', slides: [] },
      assets: [],
      error: 'Falha ao gerar um slide',
    });
    await expect(
      runWithTenant('tenant-1', () =>
        service.createFromCarousel(
          {
            sourceUrl: 'https://www.instagram.com/loja_ana/',
            scheduledAt: '2026-09-26T13:00:00.000Z',
            leadId: 'lead-1',
          },
          user as never,
        ),
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.contentCalendarPost.create).not.toHaveBeenCalled();
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
