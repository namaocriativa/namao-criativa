import { BadGatewayException, ConflictException } from '@nestjs/common';
import {
  CreativeCharacterService,
  pickCharacterHero,
  pickIdentityAssets,
} from './creative-character.service';
import { CHARACTER_ASSET_KIND } from './personagens.planner';
import { runWithTenant } from '../tenant/tenant-context';

describe('pickCharacterHero', () => {
  it('prefere a ficha mais recente, depois foto, depois upload', () => {
    const hero = pickCharacterHero([
      { kind: CHARACTER_ASSET_KIND.UPLOAD, id: 'u' },
      { kind: CHARACTER_ASSET_KIND.PHOTO, id: 'p' },
      { kind: CHARACTER_ASSET_KIND.SHEET, id: 's1' },
      { kind: CHARACTER_ASSET_KIND.SHEET, id: 's2' },
    ]);
    expect(hero?.id).toBe('s2');
  });
});

describe('pickIdentityAssets', () => {
  it('prioriza uploads e ficha antes das fotos extras', () => {
    const picked = pickIdentityAssets(
      [
        { kind: CHARACTER_ASSET_KIND.PHOTO, id: 'p' },
        { kind: CHARACTER_ASSET_KIND.UPLOAD, id: 'u' },
        { kind: CHARACTER_ASSET_KIND.SHEET, id: 's' },
        { kind: CHARACTER_ASSET_KIND.VIDEO, id: 'v' },
      ],
      8,
    );
    expect(picked.map((item) => item.id)).toEqual(['u', 's', 'p']);
  });
});

describe('CreativeCharacterService', () => {
  const prisma = {
    creativeCharacter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    creativeCharacterAsset: {
      create: jest.fn(),
    },
    creativeUgcClip: {
      count: jest.fn(),
    },
    creativeMovieShot: {
      count: jest.fn(),
    },
    creativeMovieShotCast: {
      count: jest.fn(),
    },
  };
  const storage = {
    saveCharacterAsset: jest.fn(),
    readStorageFile: jest.fn(),
    removeCharacterDir: jest.fn(),
  };
  const geminiImages = { generate: jest.fn() };
  const geminiVideos = { generate: jest.fn() };

  const service = new CreativeCharacterService(
    prisma as never,
    storage as never,
    geminiImages as never,
    geminiVideos as never,
  );

  const character = {
    id: 'char-1',
    tenantId: 'tenant-1',
    name: 'Luma',
    appearance: 'cabelo ruivo',
    personality: 'calma',
    identityPrompt: 'Personagem canônico: Luma.',
    assets: [
      {
        id: 'a1',
        kind: CHARACTER_ASSET_KIND.UPLOAD,
        localPath: 'storage/characters/char-1/ref.jpg',
        filename: 'ref.jpg',
        mimeType: 'image/jpeg',
        createdAt: new Date('2026-09-17T20:00:00Z'),
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.creativeUgcClip.count.mockResolvedValue(0);
    prisma.creativeMovieShot.count.mockResolvedValue(0);
    prisma.creativeMovieShotCast.count.mockResolvedValue(0);
    prisma.creativeCharacter.findUnique.mockResolvedValue(character);
    prisma.creativeCharacter.update.mockResolvedValue(character);
    prisma.creativeCharacter.create.mockResolvedValue({
      ...character,
      assets: [],
    });
    storage.saveCharacterAsset.mockResolvedValue({
      localPath: 'storage/characters/char-1/sheet.jpg',
      filename: 'sheet.jpg',
      mimeType: 'image/jpeg',
    });
    storage.readStorageFile.mockResolvedValue(Buffer.from('img'));
    geminiImages.generate.mockResolvedValue({
      text: '',
      thoughts: '',
      images: [{ mimeType: 'image/jpeg', buffer: Buffer.from('out') }],
    });
  });

  it('cria personagem, salva upload e gera o retrato da ficha', async () => {
    prisma.creativeCharacter.findUnique
      .mockResolvedValueOnce({ ...character, assets: character.assets })
      .mockResolvedValue({
        ...character,
        assets: [
          ...character.assets,
          {
            id: 'sheet',
            kind: CHARACTER_ASSET_KIND.SHEET,
            localPath: 'storage/characters/char-1/sheet.jpg',
            filename: 'sheet.jpg',
            mimeType: 'image/jpeg',
            createdAt: new Date(),
          },
        ],
      });

    const created = await runWithTenant('tenant-1', () =>
      service.create(
        {
          name: 'Luma',
          appearance: 'cabelo ruivo',
          personality: 'calma',
        },
        [
          {
            buffer: Buffer.from('face'),
            originalname: 'face.jpg',
            mimetype: 'image/jpeg',
            size: 4,
          },
        ],
        'user-1',
      ),
    );

    expect(prisma.creativeCharacter.create).toHaveBeenCalled();
    expect(storage.saveCharacterAsset).toHaveBeenCalled();
    expect(geminiImages.generate).toHaveBeenCalled();
    expect(
      prisma.creativeCharacterAsset.create.mock.calls.some(
        (call) => call[0].data.kind === CHARACTER_ASSET_KIND.SHEET,
      ),
    ).toBe(true);
    expect(created.id).toBe('char-1');
  });

  it('propaga erro do Gemini na geração de foto', async () => {
    geminiImages.generate.mockRejectedValue(new Error('quota'));
    await expect(service.generatePhoto('char-1', { prompt: 'sorrindo' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('recusa excluir personagem usado em UGC Skills', async () => {
    prisma.creativeUgcClip.count.mockResolvedValue(1);
    await expect(service.deleteById('char-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.creativeCharacter.delete).not.toHaveBeenCalled();
  });
});
