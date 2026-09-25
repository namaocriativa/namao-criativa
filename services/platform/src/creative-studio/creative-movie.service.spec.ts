import { BadGatewayException, ConflictException } from '@nestjs/common';
import { CreativeMovieService } from './creative-movie.service';
import { MOVIE_SHOT_STATUS } from './movies.planner';
import { runWithTenant } from '../tenant/tenant-context';

describe('CreativeMovieService', () => {
  const prisma = {
    creativeMovie: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    creativeMovieShot: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    creativeMovieShotCast: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const storage = {
    saveMovieAsset: jest.fn(),
    removeMovieDir: jest.fn(),
  };
  const characters = {
    findById: jest.fn(),
    heroImageFile: jest.fn(),
  };
  const geminiVideos = { generate: jest.fn() };

  const service = new CreativeMovieService(
    prisma as never,
    storage as never,
    characters as never,
    geminiVideos as never,
  );

  const movie = {
    id: 'm1',
    tenantId: 'tenant-1',
    title: 'Noite na cobertura',
    aspectRatio: '16:9',
    duration: '8s',
    shots: [
      {
        id: 's1',
        movieId: 'm1',
        characterId: 'ch1',
        sortOrder: 0,
        scene: 'cobertura',
        action: 'acena',
        dialogue: 'Oi.',
        framing: 'plano_medio',
        camera: 'fixa',
        status: MOVIE_SHOT_STATUS.DRAFT,
        character: {
          id: 'ch1',
          name: 'Luma',
          appearance: 'cabelo ruivo',
          personality: 'calma',
        },
        cast: [
          {
            characterId: 'ch1',
            sortOrder: 0,
            character: {
              id: 'ch1',
              name: 'Luma',
              appearance: 'cabelo ruivo',
              personality: 'calma',
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.creativeMovie.findUnique.mockResolvedValue(movie);
    prisma.creativeMovie.update.mockResolvedValue(movie);
    prisma.creativeMovie.create.mockResolvedValue({ ...movie, shots: [] });
    characters.findById.mockResolvedValue(movie.shots[0].character);
    characters.heroImageFile.mockResolvedValue({
      character: movie.shots[0].character,
      file: {
        buffer: Buffer.from('face'),
        originalname: 'sheet.jpg',
        mimetype: 'image/jpeg',
        size: 4,
      },
    });
    storage.saveMovieAsset.mockResolvedValue({
      localPath: 'storage/movies/m1/shot.mp4',
      filename: 'shot.mp4',
      mimeType: 'video/mp4',
    });
    geminiVideos.generate.mockResolvedValue({
      text: '',
      thoughts: '',
      videos: [{ mimeType: 'video/mp4', buffer: Buffer.from('vid') }],
    });
  });

  it('cria filme com defaults cinematográficos', async () => {
    await runWithTenant('tenant-1', () =>
      service.create({ title: 'Noite na cobertura' }, 'user-1'),
    );
    expect(prisma.creativeMovie.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Noite na cobertura',
          aspectRatio: '16:9',
          duration: '8s',
          createdByUserId: 'user-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('gera take com first-frame da ficha', async () => {
    prisma.creativeMovie.findUnique
      .mockResolvedValueOnce(movie)
      .mockResolvedValue(movie);
    await service.generateShot('m1', 's1', {
      resolution: '360p',
      thinkingLevel: 'low',
    });
    expect(geminiVideos.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('plano médio'),
        frames: [expect.objectContaining({ mimeType: 'image/jpeg' })],
        settings: expect.objectContaining({
          aspectRatio: '16:9',
          duration: '8s',
          resolution: '360p',
          thinkingLevel: 'low',
          model: 'gemini-omni-1.1-flash',
        }),
      }),
    );
    expect(storage.saveMovieAsset).toHaveBeenCalled();
    expect(prisma.creativeMovieShot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MOVIE_SHOT_STATUS.READY,
          localPath: 'storage/movies/m1/shot.mp4',
        }),
      }),
    );
  });

  it('bloqueia take que já está gerando', async () => {
    prisma.creativeMovie.findUnique.mockResolvedValue({
      ...movie,
      shots: [
        {
          ...movie.shots[0],
          status: MOVIE_SHOT_STATUS.GENERATING,
          updatedAt: new Date(),
        },
      ],
    });
    await expect(service.generateShot('m1', 's1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('marca o take como failed quando o Gemini quebra', async () => {
    geminiVideos.generate.mockRejectedValue(new Error('quota'));
    await expect(service.generateShot('m1', 's1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prisma.creativeMovieShot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MOVIE_SHOT_STATUS.FAILED,
          error: 'quota',
        }),
      }),
    );
  });

  it('grava o elenco do take com mais de um personagem', async () => {
    prisma.creativeMovie.findUnique
      .mockResolvedValueOnce({ ...movie, shots: [] })
      .mockResolvedValue(movie);
    prisma.creativeMovieShot.create.mockResolvedValue({ id: 's2' });
    characters.findById.mockResolvedValue({});
    await runWithTenant('tenant-1', () =>
      service.addShot('m1', {
        characterIds: ['ch1', 'ch2'],
        scene: 'sala',
        action: 'conversam',
      }),
    );
    expect(prisma.creativeMovieShot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: 'ch1',
          framing: 'plano_medio',
          camera: 'fixa',
        }),
      }),
    );
    expect(prisma.creativeMovieShotCast.createMany).toHaveBeenCalledWith({
      data: [
        { shotId: 's2', characterId: 'ch1', assetId: null, sortOrder: 0 },
        { shotId: 's2', characterId: 'ch2', assetId: null, sortOrder: 1 },
      ],
    });
  });

  it('grava a imagem escolhida de cada personagem no take', async () => {
    prisma.creativeMovie.findUnique
      .mockResolvedValueOnce({ ...movie, shots: [] })
      .mockResolvedValue(movie);
    prisma.creativeMovieShot.create.mockResolvedValue({ id: 's3' });
    characters.findById.mockImplementation(async (id: string) => ({
      id,
      name: id,
      assets: [{ id: `${id}-img`, kind: 'photo', mimeType: 'image/jpeg' }],
    }));
    await runWithTenant('tenant-1', () =>
      service.addShot('m1', {
        characterIds: ['ch1'],
        characterAssets: { ch1: 'ch1-img' },
        scene: 'sala',
        action: 'entra',
      }),
    );
    expect(prisma.creativeMovieShotCast.createMany).toHaveBeenCalledWith({
      data: [
        { shotId: 's3', characterId: 'ch1', assetId: 'ch1-img', sortOrder: 0 },
      ],
    });
  });

  it('atualiza enquadramento e câmera do take', async () => {
    prisma.creativeMovieShot.findFirst.mockResolvedValue(movie.shots[0]);
    await service.updateShot('m1', 's1', {
      framing: 'detalhe',
      camera: 'handheld',
    });
    expect(prisma.creativeMovieShot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          framing: 'detalhe',
          camera: 'handheld',
        }),
      }),
    );
  });

  it('grava enquadramento e câmera no take', async () => {
    prisma.creativeMovie.findUnique
      .mockResolvedValueOnce({ ...movie, shots: [] })
      .mockResolvedValue(movie);
    prisma.creativeMovieShot.create.mockResolvedValue({ id: 's4' });
    characters.findById.mockResolvedValue({});
    await runWithTenant('tenant-1', () =>
      service.addShot('m1', {
        characterIds: ['ch1'],
        scene: 'rua',
        action: 'caminha',
        framing: 'close',
        camera: 'dolly_in',
      }),
    );
    expect(prisma.creativeMovieShot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          framing: 'close',
          camera: 'dolly_in',
        }),
      }),
    );
  });

  it('gera take com retrato de cada personagem do elenco', async () => {
    const duo = {
      ...movie,
      shots: [
        {
          ...movie.shots[0],
          cast: [
            { ...movie.shots[0].cast[0], assetId: 'luma-photo' },
            {
              characterId: 'ch2',
              assetId: 'eduarda-sheet',
              sortOrder: 1,
              character: {
                id: 'ch2',
                name: 'Eduarda',
                appearance: 'cabelo preto',
                personality: 'direta',
              },
            },
          ],
        },
      ],
    };
    prisma.creativeMovie.findUnique
      .mockResolvedValueOnce(duo)
      .mockResolvedValue(duo);
    await service.generateShot('m1', 's1');
    expect(characters.heroImageFile).toHaveBeenCalledWith('ch1', 'luma-photo');
    expect(characters.heroImageFile).toHaveBeenCalledWith('ch2', 'eduarda-sheet');
    expect(geminiVideos.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        frames: [
          expect.objectContaining({ mimeType: 'image/jpeg' }),
          expect.objectContaining({ mimeType: 'image/jpeg' }),
        ],
      }),
    );
  });
});
