import { CreativeStudioService } from './creative-studio.service';
import {
  CAROUSEL_INSTAGRAM_ID,
  FLYER_VENDA_LANDING_ID,
  PLAYGROUND_IMAGEM_ID,
} from './creative-features';
import { CAROUSEL_SYSTEM_INSTRUCTION } from './carousel-instagram.planner';
import { FLYER_SYSTEM_INSTRUCTION } from './flyer-venda.planner';

describe('CreativeStudioService', () => {
  const llm = { generateJson: jest.fn() };
  const leads = { findById: jest.fn() };
  const packages = { findById: jest.fn() };
  const access = { assertCanAccess: jest.fn() };
  const imageStudio = {
    create: jest.fn(),
    addReferences: jest.fn(),
    generate: jest.fn(),
    update: jest.fn(),
  };
  const storage = { readStorageFile: jest.fn() };

  const service = new CreativeStudioService(
    llm as never,
    leads as never,
    packages as never,
    access as never,
    imageStudio as never,
    storage as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lista a feature de flyer no catálogo', () => {
    const payload = service.listFeatures();
    expect(payload.defaultFeatureId).toBe(PLAYGROUND_IMAGEM_ID);
    expect(payload.features.some((item) => item.id === FLYER_VENDA_LANDING_ID)).toBe(
      true,
    );
  });

  it('planeja, cria o projeto com featureId e gera com referências', async () => {
    access.assertCanAccess.mockResolvedValue({ id: 'lead-1' });
    leads.findById.mockResolvedValue({
      id: 'lead-1',
      name: 'Dra. Nicole Barbosa',
      category: 'Clínica odontológica',
      description: 'Dentista',
      city: 'São Paulo',
      state: 'SP',
      images: [
        {
          filename: 'nicole.jpg',
          localPath: 'storage/leads/lead-1/images/nicole.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    });
    packages.findById.mockImplementation(async (id: string) => {
      if (id === 'pkg-1') {
        return {
          id: 'pkg-1',
          name: 'Site Estratégico',
          summary: 'Para conversão',
          description: null,
          price: 1200,
          currency: 'BRL',
          benefits: ['Site profissional'],
        };
      }
      return {
        id: 'pkg-2',
        name: 'Atendimento & Gestão',
        summary: null,
        description: null,
        price: 2500,
        currency: 'BRL',
        benefits: ['Agenda'],
      };
    });
    llm.generateJson.mockImplementation(async (_prompt, validate) =>
      validate({
        kicker: 'DRA. NICOLE BARBOSA',
        headline: 'Sua presença digital pode trabalhar por você.',
        audienceNoun: 'pacientes',
        packages: [
          {
            title: 'SITE ESTRATÉGICO',
            priceFrom: 'R$ 1.200',
            priceTo: 'R$ 800',
          },
        ],
      }),
    );
    imageStudio.create.mockResolvedValue({
      id: 'proj-1',
      name: 'Flyer · Dra. Nicole Barbosa',
    });
    storage.readStorageFile.mockResolvedValue(Buffer.from('photo'));
    imageStudio.addReferences.mockResolvedValue([
      { id: 'ref-logo' },
      { id: 'ref-photo' },
    ]);
    imageStudio.generate.mockResolvedValue({
      settings: { featureId: FLYER_VENDA_LANDING_ID, aspectRatio: '2:3' },
      userMessage: { id: 'u1' },
      modelMessage: { id: 'm1' },
      assets: [{ id: 'gen-1' }],
    });

    const result = await service.generateFlyer(
      {
        leadId: 'lead-1',
        packageIds: ['pkg-1', 'pkg-2'],
        notes: 'Pacote I de R$ 1.200 por R$ 800',
      },
      { id: 'user-1', email: 'a@b.c', name: 'Ana', role: 'ADMIN', leadId: null, customerId: null },
    );

    expect(access.assertCanAccess).toHaveBeenCalled();
    expect(llm.generateJson).toHaveBeenCalled();
    expect(imageStudio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        featureId: FLYER_VENDA_LANDING_ID,
        aspectRatio: '2:3',
        imageSize: '2K',
        systemInstruction: FLYER_SYSTEM_INSTRUCTION,
        name: 'Flyer · Dra. Nicole Barbosa',
        skillRun: expect.objectContaining({
          leadId: 'lead-1',
          leadLabel: 'Dra. Nicole Barbosa',
          packageIds: ['pkg-1', 'pkg-2'],
          notes: 'Pacote I de R$ 1.200 por R$ 800',
        }),
      }),
      'user-1',
    );
    expect(imageStudio.addReferences).toHaveBeenCalled();
    expect(imageStudio.generate).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        referenceAssetIds: ['ref-logo', 'ref-photo'],
        aspectRatio: '2:3',
      }),
    );
    const generateDto = imageStudio.generate.mock.calls[0][1] as {
      prompt: string;
    };
    expect(generateDto.prompt).toContain(
      'Sua presença digital pode trabalhar por você.',
    );
    expect(generateDto.prompt).toContain('R$ 800');
    expect(result.projectId).toBe('proj-1');
    expect(result.spec.audienceNoun).toBe('pacientes');
    expect(result.spec.packages[0].priceTo).toBe('R$ 800');
  });

  it('planeja o carrossel, gera cada slide em 4:5 e usa o anterior como referência', async () => {
    llm.generateJson.mockImplementation(async (_prompt, validate) =>
      validate({
        caption: 'Hidrate-se. Salve o post.',
        artDirection: 'Feed escuro',
        palette: 'preto e lima',
        slides: [
          { role: 'cover', headline: 'Água agora', visual: 'capa' },
          { role: 'tip', headline: '500 ml', visual: 'garrafa' },
          { role: 'cta', headline: 'Salve', visual: 'cta' },
        ],
      }),
    );
    imageStudio.create.mockResolvedValue({ id: 'carousel-1' });
    imageStudio.update.mockResolvedValue({});
    imageStudio.generate
      .mockResolvedValueOnce({
        assets: [{ id: 'slide-1', kind: 'generated' }],
      })
      .mockResolvedValueOnce({
        assets: [{ id: 'slide-2', kind: 'generated' }],
      })
      .mockResolvedValueOnce({
        assets: [{ id: 'slide-3', kind: 'generated' }],
      });

    const result = await service.generateCarousel(
      {
        prompt: 'Hábitos de hidratação para treino de manhã',
        slideCount: 3,
        notes: 'Tom direto',
      },
      {
        id: 'user-1',
        email: 'a@b.c',
        name: 'Ana',
        role: 'ADMIN',
        leadId: null,
        customerId: null,
      },
    );

    expect(imageStudio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        featureId: CAROUSEL_INSTAGRAM_ID,
        aspectRatio: '4:5',
        imageSize: '2K',
        systemInstruction: CAROUSEL_SYSTEM_INSTRUCTION,
        skillRun: expect.objectContaining({
          prompt: 'Hábitos de hidratação para treino de manhã',
          slideCount: 3,
        }),
      }),
      'user-1',
    );
    expect(imageStudio.generate).toHaveBeenCalledTimes(3);
    expect(imageStudio.generate.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        aspectRatio: '4:5',
        referenceAssetIds: [],
      }),
    );
    expect(imageStudio.generate.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        referenceAssetIds: ['slide-1'],
      }),
    );
    expect(imageStudio.generate.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        referenceAssetIds: ['slide-2'],
      }),
    );
    expect(imageStudio.generate.mock.calls[0][1].prompt).toContain('Água agora');
    expect(result.projectId).toBe('carousel-1');
    expect(result.completedSlides).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it('mantém os slides já gerados se um generate falhar no meio', async () => {
    llm.generateJson.mockImplementation(async (_prompt, validate) =>
      validate({
        caption: 'Salve',
        slides: [
          { role: 'cover', headline: 'Capa' },
          { role: 'tip', headline: 'Meio' },
          { role: 'cta', headline: 'Fim' },
        ],
      }),
    );
    imageStudio.create.mockResolvedValue({ id: 'carousel-2' });
    imageStudio.update.mockResolvedValue({});
    imageStudio.generate
      .mockResolvedValueOnce({
        assets: [{ id: 'slide-1', kind: 'generated' }],
      })
      .mockRejectedValueOnce(new Error('Gemini timeout'));

    const result = await service.generateCarousel(
      { prompt: 'Carrossel parcial', slideCount: 3 },
      {
        id: 'user-1',
        email: 'a@b.c',
        name: 'Ana',
        role: 'ADMIN',
        leadId: null,
        customerId: null,
      },
    );

    expect(result.completedSlides).toBe(1);
    expect(result.error).toBe('Gemini timeout');
    expect(imageStudio.update).toHaveBeenCalledWith(
      'carousel-2',
      expect.objectContaining({
        skillRun: expect.objectContaining({
          completedSlides: 1,
          error: 'Gemini timeout',
        }),
      }),
    );
  });
});
