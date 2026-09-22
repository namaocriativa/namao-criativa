import { CreativeStudioService } from './creative-studio.service';
import {
  FLYER_VENDA_LANDING_ID,
  PLAYGROUND_IMAGEM_ID,
} from './creative-features';
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
});
