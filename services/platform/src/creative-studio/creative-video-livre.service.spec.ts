import { BadRequestException } from '@nestjs/common';
import { runWithTenant } from '../tenant/tenant-context';
import { CreativeVideoLivreService } from './creative-video-livre.service';
import { VIDEO_LIVRE_CLIP_STATUS } from './video-livre.planner';

describe('CreativeVideoLivreService', () => {
  const prisma = {
    creativeVideoLivreClip: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const llm = { generateJson: jest.fn() };
  const videoStudio = {
    create: jest.fn(),
    addFrames: jest.fn(),
    generate: jest.fn(),
  };
  const characters = { heroImageFile: jest.fn() };
  const service = new CreativeVideoLivreService(
    prisma as never,
    llm as never,
    videoStudio as never,
    characters as never,
  );

  const clip = {
    id: 'vl-1',
    tenantId: 'tenant-1',
    title: 'Reel',
    brief: 'brief',
    prompt: 'Prompt base',
    characterId: null as string | null,
    characterAssetId: '',
    videoHookId: '',
    duration: '8s',
    aspectRatio: '9:16',
    resolution: '360p',
    model: 'gemini-omni-1.1-flash',
    status: VIDEO_LIVRE_CLIP_STATUS.DRAFT,
    error: '',
    videoProjectId: '',
    localPath: '',
    filename: '',
    mimeType: null as string | null,
    createdByUserId: 'user-1',
    updatedAt: new Date(),
    character: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.creativeVideoLivreClip.findUnique.mockResolvedValue(clip);
    prisma.creativeVideoLivreClip.update.mockImplementation(async ({ data }) => ({
      ...clip,
      ...data,
    }));
    prisma.creativeVideoLivreClip.create.mockImplementation(async ({ data }) => ({
      ...clip,
      ...data,
      id: 'vl-new',
    }));
    videoStudio.create.mockResolvedValue({ id: 'vid-1' });
    videoStudio.generate.mockResolvedValue({
      assets: [
        {
          id: 'a1',
          kind: 'generated',
          localPath: 'storage/video-projects/vid-1/out.mp4',
          filename: 'out.mp4',
          mimeType: 'video/mp4',
        },
      ],
    });
  });

  it('refine chama a LLM com o briefing', async () => {
    llm.generateJson.mockImplementation(async (prompt, validate) =>
      validate({
        title: 'Clareamento',
        productionPrompt: String(prompt).includes('brief')
          ? 'Close-up explicando clareamento.'
          : '',
      }),
    );
    const result = await runWithTenant('tenant-1', () =>
      service.refine({ brief: 'brief do dentista', note: 'mais direto' }, 'user-1'),
    );
    expect(result.productionPrompt).toContain('clareamento');
    expect(llm.generateJson).toHaveBeenCalled();
  });

  it('generate sem personagem é text-to-video', async () => {
    await runWithTenant('tenant-1', () =>
      service.generate('vl-1', { prompt: 'Câmera gira no produto' }, 'user-1'),
    );
    expect(characters.heroImageFile).not.toHaveBeenCalled();
    expect(videoStudio.addFrames).not.toHaveBeenCalled();
    expect(videoStudio.generate).toHaveBeenCalledWith(
      'vid-1',
      expect.objectContaining({
        prompt: 'Câmera gira no produto',
        aspectRatio: '9:16',
      }),
    );
  });

  it('generate com characterAssetId anexa first-frame e identidade', async () => {
    characters.heroImageFile.mockResolvedValue({
      character: { identityPrompt: 'Mesmo rosto da ficha.' },
      file: {
        buffer: Buffer.from('face'),
        originalname: 'face.jpg',
        mimetype: 'image/jpeg',
        size: 4,
      },
    });
    videoStudio.addFrames.mockResolvedValue([{ id: 'frame-1' }]);
    await runWithTenant('tenant-1', () =>
      service.generate(
        'vl-1',
        {
          prompt: 'Acena para a câmera',
          characterId: 'ch-1',
          characterAssetId: 'asset-9',
        },
        'user-1',
      ),
    );
    expect(characters.heroImageFile).toHaveBeenCalledWith('ch-1', 'asset-9');
    expect(videoStudio.addFrames).toHaveBeenCalled();
    expect(videoStudio.generate).toHaveBeenCalledWith(
      'vid-1',
      expect.objectContaining({
        firstFrameAssetId: 'frame-1',
        prompt: expect.stringContaining('Mesmo rosto da ficha.'),
      }),
    );
  });

  it('generate com hook injeta a linguagem visual no prompt', async () => {
    await runWithTenant('tenant-1', () =>
      service.generate(
        'vl-1',
        {
          prompt: 'Título: Reel',
          videoHookId: 'stunt-cinematic',
        },
        'user-1',
      ),
    );
    const generatePrompt = String(videoStudio.generate.mock.calls[0][1].prompt);
    expect(generatePrompt).toContain('Título: Reel');
    expect(generatePrompt).toContain('cinematic FPV');
  });

  it('generate com noCharacterVoice injeta a instrução no prompt', async () => {
    await runWithTenant('tenant-1', () =>
      service.generate(
        'vl-1',
        { prompt: 'Câmera gira no produto', noCharacterVoice: true },
        'user-1',
      ),
    );
    expect(videoStudio.generate).toHaveBeenCalledWith(
      'vid-1',
      expect.objectContaining({
        prompt: expect.stringContaining('Sem fala do personagem'),
      }),
    );
  });

  it('recusa hook inválido', async () => {
    await expect(
      runWithTenant('tenant-1', () =>
        service.generate('vl-1', { videoHookId: 'nope' }, 'user-1'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('break parte o roteiro em N takes', async () => {
    llm.generateJson.mockImplementation(async (prompt, validate) =>
      validate({
        takes: [
          {
            id: 'take-1',
            label: 'Take 1 · Hook',
            beat: 'abre',
            productionPrompt: String(prompt).includes('CONTINUIDADE')
              ? 'Abre com o gancho.'
              : '',
          },
          {
            id: 'take-2',
            label: 'Take 2',
            beat: 'meio',
            productionPrompt: 'Desenvolve o assunto.',
          },
          {
            id: 'take-3',
            label: 'Take 3 · CTA',
            beat: 'fecha',
            productionPrompt: 'Fecha com CTA.',
          },
        ],
      }),
    );
    const result = await runWithTenant('tenant-1', () =>
      service.breakTakes(
        { script: 'Roteiro do dentista sobre clareamento', takeCount: 3 },
        'user-1',
      ),
    );
    expect(result.takes).toHaveLength(3);
    expect(result.takes[0].productionPrompt).toContain('gancho');
    expect(llm.generateJson).toHaveBeenCalled();
  });

  it('break com takeCount fora da faixa é clamped', async () => {
    llm.generateJson.mockImplementation(async (prompt, validate) => {
      expect(String(prompt)).toContain('EXATAMENTE 5 takes');
      return validate({
        takes: Array.from({ length: 5 }, (_, i) => ({
          id: `take-${i + 1}`,
          label: `Take ${i + 1}`,
          beat: `beat ${i + 1}`,
          productionPrompt: `Prompt ${i + 1}`,
        })),
      });
    });
    const result = await runWithTenant('tenant-1', () =>
      service.breakTakes(
        { script: 'Roteiro longo o bastante', takeCount: 99 as never },
        'user-1',
      ),
    );
    expect(result.takes).toHaveLength(5);
  });
});
