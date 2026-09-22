import { VideoStudioService } from './video-studio.service';
import { defaultVideoProjectSettings } from './video-models';
import { runWithTenant } from '../tenant/tenant-context';

describe('VideoStudioService', () => {
  const prisma = {
    videoProject: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    videoMessage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    videoAsset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    imageAsset: {
      findUnique: jest.fn(),
    },
  };
  const storage = {
    saveVideoProjectAsset: jest.fn(),
    removeVideoProjectDir: jest.fn(),
    readStorageFile: jest.fn(),
  };
  const geminiVideos = { generate: jest.fn() };

  const service = new VideoStudioService(
    prisma as never,
    storage as never,
    geminiVideos as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('cria projeto com Omni 1.1 Flash', async () => {
    prisma.videoProject.create.mockImplementation(async ({ data }) => ({
      id: 'vid-1',
      ...data,
      messages: [],
      assets: [],
      _count: { messages: 0, assets: 0 },
    }));

    const project = await runWithTenant('tenant-1', () =>
      service.create({ name: 'Piscina' }, 'user-1'),
    );
    expect(prisma.videoProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Piscina',
          createdByUserId: 'user-1',
          tenantId: 'tenant-1',
          settings: defaultVideoProjectSettings(),
        }),
      }),
    );
    expect(project.settings).toEqual(defaultVideoProjectSettings());
  });

  it('persiste settings no update', async () => {
    prisma.videoProject.findUnique.mockResolvedValue({
      id: 'vid-1',
      name: 'Piscina',
      settings: defaultVideoProjectSettings(),
    });
    prisma.videoProject.update.mockImplementation(async ({ data }) => ({
      id: 'vid-1',
      name: data.name || 'Piscina',
      settings: data.settings,
      messages: [],
      assets: [],
    }));

    const updated = await service.update('vid-1', {
      name: 'Piscina v2',
      aspectRatio: '9:16',
      duration: '10s',
      resolution: '1080p',
      thinkingLevel: 'medium',
    });

    expect(updated.settings).toMatchObject({
      model: 'gemini-omni-1.1-flash',
      aspectRatio: '9:16',
      duration: '10s',
      resolution: '1080p',
      thinkingLevel: 'medium',
    });
    expect(prisma.videoProject.update).toHaveBeenCalled();
  });

  it('recusa image asset inexistente como quadro inicial', async () => {
    prisma.videoProject.findUnique.mockResolvedValue({
      id: 'vid-1',
      settings: defaultVideoProjectSettings(),
    });
    prisma.imageAsset.findUnique.mockResolvedValue(null);

    await expect(
      service.generate('vid-1', {
        prompt: 'a criança se aproxima da piscina',
        firstFrameImageAssetId: 'missing',
      }),
    ).rejects.toThrow('Imagem não encontrada na aba Imagens');
    expect(geminiVideos.generate).not.toHaveBeenCalled();
  });
});
