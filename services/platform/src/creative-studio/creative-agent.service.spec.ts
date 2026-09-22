import { NotFoundException } from '@nestjs/common';
import { CreativeAgentService } from './creative-agent.service';
import { MESSAGE_KIND, PROPOSAL_STATUS } from './agent.constants';

const admin = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Ana',
  role: 'ADMIN',
  tenantId: 't1',
  leadId: null,
  customerId: null,
  canAccessImages: true,
  canAccessVideos: true,
};

describe('CreativeAgentService', () => {
  const prisma = {
    imageProject: { findUnique: jest.fn() },
    videoProject: { findUnique: jest.fn() },
    imageMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    videoMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const llm = { generateTurn: jest.fn() };
  const tools = { execute: jest.fn(), catalog: jest.fn() };
  const imageStudio = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    generate: jest.fn(),
    addReferences: jest.fn(),
  };
  const videoStudio = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    generate: jest.fn(),
    addFrames: jest.fn(),
  };
  const leads = { findById: jest.fn() };
  const storage = { readStorageFile: jest.fn() };
  const characters = { identityImageFiles: jest.fn() };

  const service = new CreativeAgentService(
    prisma as never,
    llm as never,
    tools as never,
    imageStudio as never,
    videoStudio as never,
    leads as never,
    storage as never,
    characters as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.imageProject.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Nova conversa',
    });
    prisma.videoProject.findUnique.mockResolvedValue(null);
    prisma.imageMessage.findMany.mockResolvedValue([]);
    prisma.imageMessage.create.mockImplementation(async ({ data }) => ({
      id: `msg-${data.kind}-${Math.random().toString(16).slice(2)}`,
      ...data,
    }));
    prisma.imageMessage.updateMany.mockResolvedValue({ count: 0 });
    imageStudio.findById.mockResolvedValue({
      id: 'c1',
      name: 'flyer barbearia',
      messages: [],
    });
    imageStudio.update.mockResolvedValue({});
  });

  it('responde só em texto sem chamar o gerador', async () => {
    llm.generateTurn.mockResolvedValue({
      text: 'Posso montar um flyer. Qual lead?',
      functionCalls: [],
      usage: { promptTokens: 12, candidatesTokens: 8, totalTokens: 20 },
    });

    const result = await service.turn(
      { conversationId: 'c1', text: 'oi, quero um flyer' },
      admin,
    );

    expect(tools.execute).not.toHaveBeenCalled();
    expect(imageStudio.generate).not.toHaveBeenCalled();
    expect(prisma.imageMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'assistant',
          kind: MESSAGE_KIND.CHAT,
        }),
      }),
    );
    expect(result.text).toContain('flyer');
  });

  it('busca lead e cria proposta pendente', async () => {
    llm.generateTurn
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ name: 'search_leads', args: { query: 'barbearia' } }],
        usage: { promptTokens: 10, candidatesTokens: 2, totalTokens: 12 },
      })
      .mockResolvedValueOnce({
        text: 'Proposta pronta',
        functionCalls: [
          {
            name: 'propose_image_generation',
            args: { prompt: 'flyer da Barbearia X', leadId: 'l1' },
          },
        ],
        usage: { promptTokens: 20, candidatesTokens: 6, totalTokens: 26 },
      });
    tools.execute.mockImplementation(async (name: string) => {
      if (name === 'search_leads') return { leads: [{ id: 'l1' }] };
      return {
        kind: 'image',
        prompt: 'flyer da Barbearia X',
        leadId: 'l1',
        estimatedTokens: 12,
      };
    });

    const result = await service.turn(
      { conversationId: 'c1', text: 'gere um flyer da barbearia' },
      admin,
    );

    expect(tools.execute).toHaveBeenCalledWith(
      'search_leads',
      { query: 'barbearia' },
      expect.objectContaining({ conversationId: 'c1' }),
    );
    expect(prisma.imageMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: MESSAGE_KIND.PROPOSAL,
          status: PROPOSAL_STATUS.PENDING,
        }),
      }),
    );
    expect(imageStudio.generate).not.toHaveBeenCalled();
    expect(result.proposal?.kind).toBe(MESSAGE_KIND.PROPOSAL);
  });

  it('confirma a proposta chamando o engine de imagem', async () => {
    prisma.imageMessage.findFirst.mockResolvedValue({
      id: 'p1',
      projectId: 'c1',
      kind: MESSAGE_KIND.PROPOSAL,
      status: PROPOSAL_STATUS.PENDING,
      settings: {
        kind: 'image',
        prompt: 'flyer da Barbearia X',
        estimatedTokens: 10,
      },
    });
    imageStudio.generate.mockResolvedValue({
      assets: [{ id: 'a1' }],
      usage: { promptTokens: 40, candidatesTokens: 10, totalTokens: 50 },
    });
    prisma.imageMessage.update.mockResolvedValue({});

    const result = await service.confirmProposal('c1', 'p1', admin);
    expect(imageStudio.generate).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ prompt: 'flyer da Barbearia X' }),
    );
    expect(result.generated.assets).toHaveLength(1);
  });

  it('copia a ficha do personagem ao confirmar a proposta', async () => {
    prisma.imageMessage.findFirst.mockResolvedValue({
      id: 'p1',
      projectId: 'c1',
      kind: MESSAGE_KIND.PROPOSAL,
      status: PROPOSAL_STATUS.PENDING,
      settings: {
        kind: 'image',
        prompt: 'Luma na chuva',
        characterId: 'ch1',
        estimatedTokens: 10,
      },
    });
    characters.identityImageFiles.mockResolvedValue({
      character: {
        id: 'ch1',
        identityPrompt: 'Personagem canônico: Luma.',
      },
      files: [
        {
          buffer: Buffer.from('face'),
          originalname: 'sheet.jpg',
          mimetype: 'image/jpeg',
          size: 4,
        },
      ],
    });
    imageStudio.addReferences.mockResolvedValue([{ id: 'ref-1' }]);
    imageStudio.generate.mockResolvedValue({ assets: [{ id: 'a1' }] });
    prisma.imageMessage.update.mockResolvedValue({});

    await service.confirmProposal('c1', 'p1', admin);
    expect(imageStudio.addReferences).toHaveBeenCalledWith(
      'c1',
      expect.arrayContaining([expect.objectContaining({ originalname: 'sheet.jpg' })]),
    );
    expect(imageStudio.generate).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        prompt: 'Luma na chuva',
        referenceAssetIds: ['ref-1'],
        systemInstruction: 'Personagem canônico: Luma.',
      }),
    );
  });

  it('copia o quadro inicial do personagem ao confirmar vídeo', async () => {
    prisma.imageProject.findUnique.mockResolvedValue(null);
    prisma.videoProject.findUnique.mockResolvedValue({
      id: 'v1',
      name: 'Nova conversa',
    });
    prisma.videoMessage.findFirst.mockResolvedValue({
      id: 'p1',
      projectId: 'v1',
      kind: MESSAGE_KIND.PROPOSAL,
      status: PROPOSAL_STATUS.PENDING,
      settings: {
        kind: 'video',
        prompt: 'Luma acena',
        characterId: 'ch1',
        estimatedTokens: 10,
      },
    });
    characters.identityImageFiles.mockResolvedValue({
      character: {
        id: 'ch1',
        identityPrompt: 'Personagem canônico: Luma.',
      },
      files: [
        {
          buffer: Buffer.from('face'),
          originalname: 'sheet.jpg',
          mimetype: 'image/jpeg',
          size: 4,
        },
      ],
    });
    videoStudio.addFrames.mockResolvedValue([{ id: 'frame-1' }]);
    videoStudio.generate.mockResolvedValue({ assets: [{ id: 'vid-1' }] });
    prisma.videoMessage.update.mockResolvedValue({});

    await service.confirmProposal('v1', 'p1', admin);
    expect(videoStudio.addFrames).toHaveBeenCalledWith(
      'v1',
      'first-frame',
      expect.arrayContaining([expect.objectContaining({ originalname: 'sheet.jpg' })]),
    );
    expect(videoStudio.generate).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        prompt: 'Luma acena\nPersonagem canônico: Luma.',
        firstFrameAssetId: 'frame-1',
      }),
    );
  });

  it('bloqueia get_lead via tool quando o acesso falha', async () => {
    llm.generateTurn.mockResolvedValue({
      text: '',
      functionCalls: [{ name: 'get_lead', args: { leadId: 'hidden' } }],
      usage: null,
    });
    tools.execute.mockRejectedValue(new NotFoundException('Perfil hidden não encontrado'));

    await expect(
      service.turn({ conversationId: 'c1', text: 'abre o lead hidden' }, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(imageStudio.generate).not.toHaveBeenCalled();
  });
});
