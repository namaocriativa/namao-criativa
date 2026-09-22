import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { CreativeStartEndService } from './creative-start-end.service';
import { START_END_STATUS } from './inicio-fim.planner';
import { runWithTenant } from '../tenant/tenant-context';

describe('CreativeStartEndService', () => {
  const prisma = {
    creativeStartEndClip: {
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
    saveStartEndAsset: jest.fn(),
    removeStartEndDir: jest.fn(),
    readStorageFile: jest.fn(),
  };
  const geminiVideos = { generate: jest.fn() };

  const service = new CreativeStartEndService(
    prisma as never,
    storage as never,
    geminiVideos as never,
  );

  const clip = {
    id: 'c1',
    tenantId: 'tenant-1',
    prompt: 'a luz esquenta',
    duration: '5s',
    aspectRatio: '16:9',
    resolution: '720p',
    status: START_END_STATUS.DRAFT,
    error: '',
    firstFramePath: 'storage/inicio-fim/c1/first.png',
    firstFrameName: 'first.png',
    firstFrameMime: 'image/png',
    lastFramePath: 'storage/inicio-fim/c1/last.png',
    lastFrameName: 'last.png',
    lastFrameMime: 'image/png',
    localPath: '',
    filename: '',
    mimeType: null,
    updatedAt: new Date('2026-09-18T12:00:00Z'),
  };

  let stored = { ...clip };

  beforeEach(() => {
    jest.resetAllMocks();
    stored = { ...clip };
    prisma.creativeStartEndClip.findUnique.mockImplementation(async () => stored);
    prisma.creativeStartEndClip.create.mockImplementation(async ({ data }) => {
      stored = {
        ...stored,
        ...data,
        id: 'c1',
        status: START_END_STATUS.DRAFT,
        error: '',
        firstFramePath: '',
        lastFramePath: '',
        localPath: '',
      };
      return stored;
    });
    prisma.creativeStartEndClip.update.mockImplementation(async ({ data }) => {
      stored = { ...stored, ...data };
      return stored;
    });
    prisma.creativeStartEndClip.delete.mockResolvedValue(stored);
    storage.saveStartEndAsset.mockImplementation(
      async (
        _id: string,
        _buffer: Buffer,
        _name: string,
        mime: string,
        prefix: string,
      ) => ({
        localPath: `storage/inicio-fim/c1/${prefix}.png`,
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

  it('recusa criar sem um dos quadros', async () => {
    await expect(
      service.create(
        {},
        {
          firstFrame: [
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
    expect(prisma.creativeStartEndClip.create).not.toHaveBeenCalled();
  });

  it('gera com first e last frame e persiste ready', async () => {
    storage.saveStartEndAsset
      .mockResolvedValueOnce({
        localPath: 'storage/inicio-fim/c1/first.png',
        filename: 'first.png',
        mimeType: 'image/png',
      })
      .mockResolvedValueOnce({
        localPath: 'storage/inicio-fim/c1/last.png',
        filename: 'last.png',
        mimeType: 'image/png',
      })
      .mockResolvedValueOnce({
        localPath: 'storage/inicio-fim/c1/clip.mp4',
        filename: 'clip.mp4',
        mimeType: 'video/mp4',
      });

    const created = await runWithTenant('tenant-1', () =>
      service.create(
        { prompt: 'a luz esquenta', duration: '8s' },
        {
          firstFrame: [
            {
              buffer: Buffer.from('a'),
              originalname: 'a.png',
              mimetype: 'image/png',
              size: 1,
            },
          ],
          lastFrame: [
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

    expect(prisma.creativeStartEndClip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prompt: 'a luz esquenta',
          duration: '8s',
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
          aspectRatio: '16:9',
          resolution: '360p',
          thinkingLevel: 'low',
        }),
      }),
    );
    const generateCall = geminiVideos.generate.mock.calls[0][0] as {
      prompt: string;
    };
    expect(generateCall.prompt).toContain('quadro de abertura');
    expect(generateCall.prompt).toContain('a luz esquenta');
    expect(created.status).toBe(START_END_STATUS.READY);
    expect(created.localPath).toBe('storage/inicio-fim/c1/clip.mp4');
  });

  it('copia imagens da library quando não há upload', async () => {
    prisma.imageAsset.findUnique
      .mockResolvedValueOnce({
        id: 'img-1',
        localPath: 'storage/image-projects/p/a.png',
        filename: 'a.png',
        mimeType: 'image/jpeg',
      })
      .mockResolvedValueOnce({
        id: 'img-2',
        localPath: 'storage/image-projects/p/b.png',
        filename: 'b.png',
        mimeType: 'image/jpeg',
      });
    prisma.creativeStartEndClip.findUnique.mockResolvedValue(clip);

    await runWithTenant('tenant-1', () =>
      service.create(
        {
          firstFrameImageAssetId: 'img-1',
          lastFrameImageAssetId: 'img-2',
        },
        {},
      ),
    );

    expect(storage.readStorageFile).toHaveBeenCalledWith(
      'storage/image-projects/p/a.png',
    );
    expect(storage.readStorageFile).toHaveBeenCalledWith(
      'storage/image-projects/p/b.png',
    );
    expect(geminiVideos.generate).toHaveBeenCalled();
  });

  it('marca failed quando o Gemini quebra', async () => {
    geminiVideos.generate.mockRejectedValue(new Error('quota'));
    await expect(service.generate('c1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prisma.creativeStartEndClip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: START_END_STATUS.FAILED,
          error: 'quota',
        }),
      }),
    );
  });

  it('reusa o outro quadro via sourceClipId', async () => {
    prisma.creativeStartEndClip.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'old') return clip;
      return stored;
    });
    await runWithTenant('tenant-1', () =>
      service.create(
        { sourceClipId: 'old' },
        {
          lastFrame: [
            {
              buffer: Buffer.from('b'),
              originalname: 'b.png',
              mimetype: 'image/png',
              size: 1,
            },
          ],
        },
      ),
    );
    expect(storage.readStorageFile).toHaveBeenCalledWith(
      'storage/inicio-fim/c1/first.png',
    );
    expect(geminiVideos.generate).toHaveBeenCalled();
  });

  it('persiste duração e prompt novos no generate', async () => {
    storage.saveStartEndAsset.mockResolvedValue({
      localPath: 'storage/inicio-fim/c1/clip.mp4',
      filename: 'clip.mp4',
      mimeType: 'video/mp4',
    });
    await service.generate('c1', {
      duration: '10s',
      prompt: 'zoom lento',
      resolution: '360p',
      thinkingLevel: 'low',
    });
    expect(prisma.creativeStartEndClip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duration: '10s',
          prompt: 'zoom lento',
          status: START_END_STATUS.GENERATING,
        }),
      }),
    );
    const generateCall = geminiVideos.generate.mock.calls[0][0] as {
      prompt: string;
      settings: { duration: string; resolution: string };
    };
    expect(generateCall.settings.duration).toBe('10s');
    expect(generateCall.settings.resolution).toBe('360p');
    expect(generateCall.prompt).toContain('zoom lento');
  });
});
