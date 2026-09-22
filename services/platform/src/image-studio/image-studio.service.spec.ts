import { ImageStudioService } from './image-studio.service';
import { defaultImageProjectSettings } from './image-models';
import { runWithTenant } from '../tenant/tenant-context';

describe('ImageStudioService', () => {
  const prisma = {
    imageProject: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const storage = {
    saveImageProjectAsset: jest.fn(),
    removeImageProjectDir: jest.fn(),
    readStorageFile: jest.fn(),
  };
  const geminiImages = { generate: jest.fn() };

  const service = new ImageStudioService(
    prisma as never,
    storage as never,
    geminiImages as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('cria projeto com Nano Banana Pro', async () => {
    prisma.imageProject.create.mockImplementation(async ({ data }) => ({
      id: 'proj-1',
      ...data,
      messages: [],
      assets: [],
      _count: { messages: 0, assets: 0 },
    }));

    const project = await runWithTenant('tenant-1', () =>
      service.create({ name: 'Campanha' }, 'user-1'),
    );
    expect(prisma.imageProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Campanha',
          createdByUserId: 'user-1',
          tenantId: 'tenant-1',
          settings: defaultImageProjectSettings(),
        }),
      }),
    );
    expect(project.settings).toEqual(defaultImageProjectSettings());
  });

  it('cria projeto com featureId do Studio Criativo', async () => {
    prisma.imageProject.create.mockImplementation(async ({ data }) => ({
      id: 'proj-2',
      ...data,
      messages: [],
      assets: [],
      _count: { messages: 0, assets: 0 },
    }));

    const project = await runWithTenant('tenant-1', () =>
      service.create(
        {
          name: 'Flyer · Clínica',
          featureId: 'flyer-venda-landing',
          aspectRatio: '2:3',
          imageSize: '2K',
        },
        'user-1',
      ),
    );
    expect(project.settings).toMatchObject({
      featureId: 'flyer-venda-landing',
      aspectRatio: '2:3',
      imageSize: '2K',
    });
  });

  it('cria projeto com skillRun da habilidade', async () => {
    prisma.imageProject.create.mockImplementation(async ({ data }) => ({
      id: 'proj-3',
      ...data,
      messages: [],
      assets: [],
      _count: { messages: 0, assets: 0 },
    }));

    const skillRun = {
      leadId: 'lead-1',
      leadLabel: 'Clínica Norte',
      packageIds: ['pkg-1'],
      packages: [{ id: 'pkg-1', name: 'Site Estratégico' }],
      notes: 'Promo',
    };
    const project = await runWithTenant('tenant-1', () =>
      service.create(
        {
          name: 'Flyer · Clínica',
          featureId: 'flyer-venda-landing',
          skillRun,
        },
        'user-1',
      ),
    );
    expect(project.settings).toMatchObject({
      featureId: 'flyer-venda-landing',
      skillRun: expect.objectContaining({
        leadId: 'lead-1',
        leadLabel: 'Clínica Norte',
      }),
    });
  });

  it('persiste settings no update', async () => {
    prisma.imageProject.findUnique.mockResolvedValue({
      id: 'proj-1',
      tenantId: 'tenant-1',
      name: 'Campanha',
      settings: defaultImageProjectSettings(),
    });
    prisma.imageProject.update.mockImplementation(async ({ data }) => ({
      id: 'proj-1',
      name: data.name || 'Campanha',
      settings: data.settings,
      messages: [],
      assets: [],
    }));

    const updated = await runWithTenant('tenant-1', () =>
      service.update('proj-1', {
        name: 'Campanha v2',
        model: 'gemini-3.1-flash-image',
        temperature: 0.4,
        aspectRatio: '9:16',
        imageSize: '2K',
        systemInstruction: 'claro e nítido',
        googleSearch: true,
      }),
    );

    expect(updated.settings).toMatchObject({
      model: 'gemini-3.1-flash-image',
      temperature: 0.4,
      aspectRatio: '9:16',
      imageSize: '2K',
      systemInstruction: 'claro e nítido',
      googleSearch: true,
    });
    expect(prisma.imageProject.update).toHaveBeenCalled();
  });

  it('lista library só com projetos que têm imagens geradas', async () => {
    prisma.imageProject.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Campanha',
        updatedAt: new Date(),
        assets: [{ id: 'a1', filename: 'gen.png', localPath: 'storage/x.png' }],
      },
      { id: 'p2', name: 'Vazio', updatedAt: new Date(), assets: [] },
    ]);

    const library = await runWithTenant('tenant-1', () => service.library());
    expect(library).toHaveLength(1);
    expect(library[0].id).toBe('p1');
  });
});
