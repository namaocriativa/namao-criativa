import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { CreativeUgcService } from './creative-ugc.service';
import { UGC_CLIP_STATUS } from './ugc-skills.planner';
import { runWithTenant } from '../tenant/tenant-context';

describe('CreativeUgcService', () => {
  const prisma = {
    creativeUgcClip: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    imageAsset: {
      findUnique: jest.fn(),
    },
  };
  const storage = {
    saveUgcSkillsAsset: jest.fn(),
    removeUgcSkillsDir: jest.fn(),
    readStorageFile: jest.fn(),
  };
  const geminiVideos = { generate: jest.fn() };
  const characters = {
    heroImageFile: jest.fn(),
  };

  const service = new CreativeUgcService(
    prisma as never,
    storage as never,
    geminiVideos as never,
    characters as never,
  );

  const character = {
    id: 'char-1',
    tenantId: 'tenant-1',
    name: 'Luma',
    appearance: 'cabelo ruivo',
    personality: 'energia de vendedora',
    identityPrompt: 'Personagem canônico: Luma.',
  };

  const clip = {
    id: 'c1',
    tenantId: 'tenant-1',
    characterId: 'char-1',
    prompt: 'hook de 2s',
    duration: '8s',
    aspectRatio: '9:16',
    resolution: '720p',
    status: UGC_CLIP_STATUS.DRAFT,
    error: '',
    firstFramePath: 'storage/ugc-skills/c1/first.png',
    firstFrameName: 'first.png',
    firstFrameMime: 'image/png',
    productPath: 'storage/ugc-skills/c1/product.png',
    productName: 'product.png',
    productMime: 'image/png',
    localPath: '',
    filename: '',
    mimeType: null,
    updatedAt: new Date('2026-09-18T12:00:00Z'),
    character,
  };

  let stored = { ...clip };

  beforeEach(() => {
    jest.resetAllMocks();
    stored = { ...clip };
    prisma.creativeUgcClip.findUnique.mockImplementation(async () => stored);
    prisma.creativeUgcClip.create.mockImplementation(async ({ data }) => {
      stored = {
        ...stored,
        ...data,
        id: 'c1',
        status: UGC_CLIP_STATUS.DRAFT,
        error: '',
        firstFramePath: '',
        productPath: '',
        localPath: '',
        character,
      };
      return stored;
    });
    prisma.creativeUgcClip.update.mockImplementation(async ({ data }) => {
      stored = { ...stored, ...data, character };
      return stored;
    });
    prisma.creativeUgcClip.delete.mockResolvedValue(stored);
    characters.heroImageFile.mockResolvedValue({
      character,
      file: {
        buffer: Buffer.from('face'),
        originalname: 'luma.png',
        mimetype: 'image/png',
        size: 4,
      },
    });
    storage.saveUgcSkillsAsset.mockImplementation(
      async (
        _id: string,
        _buffer: Buffer,
        _name: string,
        mime: string,
        prefix: string,
      ) => ({
        localPath: `storage/ugc-skills/c1/${prefix}.png`,
        filename: `${prefix}.png`,
        mimeType: mime,
      }),
    );
    storage.readStorageFile.mockResolvedValue(Buffer.from('frame'));
    geminiVideos.generate.mockResolvedValue({
      text: '',
      thoughts: '',
      videos: [{ mimeType: 'video/mp4', buffer: Buffer.from('vid') }],
    });
  });

  it('recusa criar sem personagem', async () => {
    await expect(
      service.create(
        { characterId: '' } as never,
        {
          product: [
            {
              buffer: Buffer.from('a'),
              originalname: 'a.png',
              mimetype: 'image/png',
              size: 1,
            },
          ],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creativeUgcClip.create).not.toHaveBeenCalled();
  });

  it('recusa criar sem foto do personagem', async () => {
    characters.heroImageFile.mockResolvedValue({
      character,
      file: null,
    });
    await expect(
      service.create(
        { characterId: 'char-1' },
        {
          product: [
            {
              buffer: Buffer.from('a'),
              originalname: 'a.png',
              mimetype: 'image/png',
              size: 1,
            },
          ],
        },
      ),
    ).rejects.toThrow(/Personagens/);
  });

  it('recusa criar sem foto do produto', async () => {
    await expect(
      service.create({ characterId: 'char-1' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creativeUgcClip.create).not.toHaveBeenCalled();
  });

  it('gera com first-frame do personagem e last-frame do produto', async () => {
    storage.saveUgcSkillsAsset
      .mockResolvedValueOnce({
        localPath: 'storage/ugc-skills/c1/first.png',
        filename: 'first.png',
        mimeType: 'image/png',
      })
      .mockResolvedValueOnce({
        localPath: 'storage/ugc-skills/c1/product.png',
        filename: 'product.png',
        mimeType: 'image/png',
      })
      .mockResolvedValueOnce({
        localPath: 'storage/ugc-skills/c1/clip.mp4',
        filename: 'clip.mp4',
        mimeType: 'video/mp4',
      });

    const created = await runWithTenant('tenant-1', () =>
      service.create(
        { characterId: 'char-1', prompt: 'hook de 2s', duration: '8s', aspectRatio: '9:16', resolution: '360p', thinkingLevel: 'low' },
        {
          product: [
            {
              buffer: Buffer.from('b'),
              originalname: 'b.png',
              mimetype: 'image/png',
              size: 1,
            },
          ],
        },
        'user-1',
      ),
    );

    expect(prisma.creativeUgcClip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: 'char-1',
          prompt: 'hook de 2s',
          duration: '8s',
          aspectRatio: '9:16',
          createdByUserId: 'user-1',
        }),
      }),
    );
    expect(geminiVideos.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        frames: [
          expect.objectContaining({ mimeType: 'image/png' }),
          expect.objectContaining({ mimeType: 'image/png' }),
        ],
        settings: expect.objectContaining({
          duration: '8s',
          aspectRatio: '9:16',
          resolution: '360p',
          thinkingLevel: 'low',
          model: 'gemini-omni-1.1-flash',
        }),
      }),
    );
    const generateCall = geminiVideos.generate.mock.calls[0][0] as {
      prompt: string;
    };
    expect(generateCall.prompt).toContain('Luma');
    expect(generateCall.prompt).toContain('hook de 2s');
    expect(generateCall.prompt).toContain('foto do produto');
    expect(created.status).toBe(UGC_CLIP_STATUS.READY);
    expect(created.localPath).toBe('storage/ugc-skills/c1/clip.mp4');
  });

  it('copia a foto do produto de outro clipe', async () => {
    prisma.creativeUgcClip.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'old') return clip;
      return stored;
    });

    await runWithTenant('tenant-1', () =>
      service.create({ characterId: 'char-1', sourceClipId: 'old' }, {}),
    );

    expect(storage.readStorageFile).toHaveBeenCalledWith(
      'storage/ugc-skills/c1/product.png',
    );
    expect(geminiVideos.generate).toHaveBeenCalled();
  });

  it('marca failed quando o Gemini quebra', async () => {
    geminiVideos.generate.mockRejectedValue(new Error('quota'));
    await expect(service.generate('c1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prisma.creativeUgcClip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: UGC_CLIP_STATUS.FAILED,
          error: 'quota',
        }),
      }),
    );
  });

  it('persiste duração e prompt novos no generate', async () => {
    storage.saveUgcSkillsAsset.mockResolvedValue({
      localPath: 'storage/ugc-skills/c1/clip.mp4',
      filename: 'clip.mp4',
      mimeType: 'video/mp4',
    });
    await service.generate('c1', {
      duration: '10s',
      prompt: 'CTA novo',
      resolution: '360p',
      thinkingLevel: 'low',
    });
    expect(prisma.creativeUgcClip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duration: '10s',
          prompt: 'CTA novo',
          status: UGC_CLIP_STATUS.GENERATING,
        }),
      }),
    );
    const generateCall = geminiVideos.generate.mock.calls[0][0] as {
      prompt: string;
      settings: { duration: string; resolution: string; thinkingLevel: string };
    };
    expect(generateCall.settings.duration).toBe('10s');
    expect(generateCall.settings.resolution).toBe('360p');
    expect(generateCall.settings.thinkingLevel).toBe('low');
    expect(generateCall.prompt).toContain('CTA novo');
  });
});
