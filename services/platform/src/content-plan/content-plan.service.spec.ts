import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { runWithTenant } from '../tenant/tenant-context';
import { ContentPlanService } from './content-plan.service';

const igReport = {
  overview: { who: 'Studio Ana', sells: 'Cortes', audience: 'Curitiba', stage: 'marca' },
  pillars: ['rotina'],
  gaps: ['prova'],
  ideas: [],
  corpus: { username: 'studio.ana', postCount: 8, postsPerWeek: 2, mix: { image: 5, video: 3, carousel: 0, other: 0 } },
};

describe('ContentPlanService', () => {
  const prisma = {
    instagramConnection: { findFirst: jest.fn() },
    instagramSkillJob: { findFirst: jest.fn() },
    contentPlan: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    aiUsageEvent: { updateMany: jest.fn() },
  };
  const access = { assertCanAccess: jest.fn() };
  const llm = { generateJson: jest.fn(), modelFor: jest.fn(() => 'gemini-2.5-flash') };
  const activity = { record: jest.fn() };
  const owners = { requireDetail: jest.fn() };
  const creativeStudio = { generateCarousel: jest.fn() };
  const imageStudio = { create: jest.fn(), generate: jest.fn(), addReferences: jest.fn() };
  const videoStudio = { create: jest.fn(), generate: jest.fn(), addFrames: jest.fn() };
  const characters = { heroImageFile: jest.fn() };
  const calendar = {
    create: jest.fn(),
    attachStudioAsset: jest.fn(),
    schedule: jest.fn(),
  };
  const brandIdentity = {
    get: jest.fn(),
    resolveLogoFile: jest.fn(),
  };
  const user = { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-1' };
  const service = new ContentPlanService(
    prisma as never,
    access as never,
    llm as never,
    activity as never,
    owners as never,
    creativeStudio as never,
    imageStudio as never,
    videoStudio as never,
    characters as never,
    calendar as never,
    brandIdentity as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    activity.record.mockResolvedValue({ id: 'act-1' });
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Studio Ana',
      category: 'salão',
      city: 'Curitiba',
    });
    prisma.contentPlan.deleteMany.mockResolvedValue({ count: 0 });
    prisma.contentPlan.findMany.mockResolvedValue([]);
    prisma.aiUsageEvent.updateMany.mockResolvedValue({ count: 0 });
    calendar.attachStudioAsset.mockResolvedValue({});
    calendar.schedule.mockResolvedValue({});
  });

  it('abre o gate sem conexão e não chama a LLM', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue(null);
    const opened = await runWithTenant('tenant-1', () =>
      service.open(user as never, 'lead-1'),
    );
    expect(opened).toEqual({
      ready: false,
      reason: 'instagram_disconnected',
      plans: [],
    });
    await expect(
      runWithTenant('tenant-1', () =>
        service.generate(
          {
            leadId: 'lead-1',
            objectives: ['leads'],
            postsPerWeek: 3,
            weeks: 4,
            formats: ['carousel'],
          },
          user as never,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('abre o gate sem relatório da Skill Instagram', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    prisma.instagramSkillJob.findFirst.mockResolvedValue(null);
    const opened = await runWithTenant('tenant-1', () =>
      service.open(user as never, 'lead-1'),
    );
    expect(opened.reason).toBe('ig_skill_required');
    await expect(
      runWithTenant('tenant-1', () =>
        service.generate(
          {
            leadId: 'lead-1',
            objectives: ['brand'],
            postsPerWeek: 3,
            weeks: 4,
            formats: ['reel'],
          },
          user as never,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('abre com contexto do diagnóstico e planos confirmados', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'ig-1',
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      report: igReport,
    });
    prisma.contentPlan.findMany.mockResolvedValue([
      {
        id: 'plan-2',
        title: 'Outubro',
        description: '',
        postsPerWeek: 3,
        weeks: 4,
        formats: ['reel'],
        items: [],
        status: 'confirmed',
        sourceIgJobId: 'ig-1',
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
      },
      {
        id: 'plan-1',
        title: 'Setembro',
        description: '',
        postsPerWeek: 2,
        weeks: 4,
        formats: ['carousel'],
        items: [],
        status: 'confirmed',
        sourceIgJobId: 'ig-1',
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    ]);
    const opened = await runWithTenant('tenant-1', () =>
      service.open(user as never, 'lead-1'),
    );
    expect(opened.ready).toBe(true);
    expect(opened.plans).toHaveLength(2);
    expect(opened.plans.map((item) => item.title)).toEqual(['Outubro', 'Setembro']);
    expect(opened.previousPlan?.id).toBe('plan-2');
    expect(opened.draft).toBeNull();
    expect(opened.context?.username).toBe('studio.ana');
    expect(opened.context?.inferred.segment).toBe('Cortes');
    expect(opened.context?.identified.postCount).toBe(8);
  });

  it('abre o rascunho pendente na frente dos confirmados', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'ig-1',
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      report: igReport,
    });
    prisma.contentPlan.findMany.mockResolvedValue([
      {
        id: 'plan-draft',
        title: 'Rascunho novembro',
        description: '',
        postsPerWeek: 3,
        weeks: 4,
        formats: ['reel'],
        items: [],
        status: 'draft',
        sourceIgJobId: 'ig-1',
        createdAt: new Date('2026-10-02T12:00:00.000Z'),
      },
      {
        id: 'plan-2',
        title: 'Outubro',
        description: '',
        postsPerWeek: 3,
        weeks: 4,
        formats: ['reel'],
        items: [],
        status: 'confirmed',
        sourceIgJobId: 'ig-1',
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
      },
    ]);
    const opened = await runWithTenant('tenant-1', () =>
      service.open(user as never, 'lead-1'),
    );
    expect(opened.ready).toBe(true);
    expect(opened.draft?.id).toBe('plan-draft');
    expect(opened.plans.map((item) => item.id)).toEqual(['plan-draft', 'plan-2']);
    expect(opened.previousPlan?.id).toBe('plan-2');
  });

  it('gera um draft com estratégia e N briefings datados', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'ig-1',
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      report: igReport,
    });
    llm.generateJson.mockImplementation(async (_prompt, parse: (value: unknown) => unknown) =>
      parse({
        strategy: { summary: 'Gerar agenda.', sequence: 'Dor e convite.' },
        items: [
          { title: 'Capa', hook: 'Hook um', caption: 'Salve este post', format: 'carousel' },
        ],
      }),
    );
    prisma.contentPlan.create.mockImplementation(async (args: { data: { items: unknown[]; strategy: unknown } }) => ({
      id: 'plan-1',
      title: 'Setembro',
      description: '',
      postsPerWeek: 3,
      weeks: 2,
      formats: ['carousel'],
      items: args.data.items,
      strategy: args.data.strategy,
      brief: {},
      status: 'draft',
      sourceIgJobId: 'ig-1',
      createdAt: new Date('2026-09-26T12:00:00.000Z'),
    }));

    const plan = await runWithTenant('tenant-1', () =>
      service.generate(
        {
          leadId: 'lead-1',
          objectives: ['leads', 'brand'],
          postsPerWeek: 3,
          weeks: 2,
          formats: ['carousel'],
        },
        user as never,
      ),
    );

    expect(plan.items).toHaveLength(6);
    expect(plan.status).toBe('draft');
    expect(plan.strategy?.summary).toContain('agenda');
    expect(plan.items[0].structure?.length).toBeGreaterThan(0);
    expect(prisma.contentPlan.deleteMany).toHaveBeenCalled();
    expect(llm.generateJson).toHaveBeenCalled();
    const prompt = llm.generateJson.mock.calls[0][0] as string;
    expect(prompt).toContain('Studio Ana');
    expect(prompt).toContain('Gerar leads');
  });

  it('confirma o draft e descarta o rascunho', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      customerId: null,
      status: 'draft',
      title: 'Setembro',
      description: '',
      postsPerWeek: 3,
      weeks: 4,
      formats: ['reel'],
      items: [
        {
          id: 'cp-1',
          week: 1,
          scheduledAt: '2026-09-29T12:00:00.000Z',
          format: 'carousel',
          title: 'Capa',
          hook: 'Hook',
          caption: 'Salve',
          structure: ['A', 'B', 'C'],
          status: 'draft',
        },
      ],
      sourceIgJobId: 'ig-1',
      createdAt: new Date(),
    });
    prisma.contentPlan.update.mockResolvedValue({
      id: 'plan-1',
      title: 'Setembro',
      description: '',
      postsPerWeek: 3,
      weeks: 4,
      formats: ['reel'],
      items: [],
      status: 'confirmed',
      sourceIgJobId: 'ig-1',
      createdAt: new Date(),
    });

    const confirmed = await runWithTenant('tenant-1', () =>
      service.confirm('plan-1', user as never),
    );
    expect(confirmed.status).toBe('confirmed');
    expect(prisma.contentPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'confirmed',
          items: [
            expect.objectContaining({ id: 'cp-1', status: 'selected' }),
          ],
        }),
      }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'skill.content-plan',
        title: 'Plano de conteúdo confirmado',
      }),
    );

    prisma.contentPlan.findFirst.mockResolvedValue({
      id: 'plan-2',
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      status: 'draft',
    });
    await runWithTenant('tenant-1', () => service.discard('plan-2', user as never));
    expect(prisma.contentPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan-2' } });
  });

  it('recusa confirmar plano já confirmado', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      status: 'confirmed',
    });
    await expect(
      runWithTenant('tenant-1', () => service.confirm('plan-1', user as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  const produceItem = {
    id: 'cp-1',
    week: 1,
    scheduledAt: '2026-09-29T12:00:00.000Z',
    format: 'carousel' as const,
    objective: 'Leads',
    pillar: 'prova',
    journeyStage: 'educate' as const,
    title: 'Capa',
    hook: 'Sua agenda vazia?',
    caption: 'Salve este post',
    structure: ['Abra', 'Mostre', 'Convide'],
    visualDirection: 'Fotos reais',
    cta: 'Salve',
    status: 'selected',
  };

  const confirmedPlan = {
    id: 'plan-1',
    tenantId: 'tenant-1',
    leadId: 'lead-1',
    customerId: null,
    status: 'confirmed',
    title: 'Setembro',
    description: '',
    postsPerWeek: 3,
    weeks: 4,
    formats: ['carousel'],
    items: [produceItem],
    sourceIgJobId: 'ig-1',
    createdAt: new Date(),
  };

  it('marca peças fora da seleção como dropped', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [
        produceItem,
        { ...produceItem, id: 'cp-2', title: 'Reel', format: 'reel', status: 'selected' },
      ],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.selectItems('plan-1', { keepIds: ['cp-1'] }, user as never),
    );
    expect(plan.items.find((item) => item.id === 'cp-1')?.status).toBe('selected');
    expect(plan.items.find((item) => item.id === 'cp-2')?.status).toBe('dropped');
  });

  it('recusa produzir um rascunho', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      status: 'draft',
    });
    await expect(
      runWithTenant('tenant-1', () =>
        service.selectItems('plan-1', { keepIds: ['cp-1'] }, user as never),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gera o carrossel e grava os assets da peça', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    creativeStudio.generateCarousel.mockResolvedValue({
      projectId: 'img-1',
      assets: [
        { id: 'asset-1', localPath: 'storage/image-projects/img-1/a.png' },
        { id: 'asset-2', localPath: 'storage/image-projects/img-1/b.png' },
      ],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never),
    );
    const item = plan.items[0];
    expect(creativeStudio.generateCarousel).toHaveBeenCalled();
    expect(item.status).toBe('created');
    expect(item.studioAssetIds).toEqual(['asset-1', 'asset-2']);
    expect(item.studioSource).toBe('image-studio');
    expect(item.previewUrls?.[0]).toBe('/storage/image-projects/img-1/a.png');
  });

  it('agenda a peça criada no calendário', async () => {
    const created = {
      ...produceItem,
      status: 'created',
      tool: 'carousel' as const,
      studioSource: 'image-studio' as const,
      studioProjectId: 'img-1',
      studioAssetIds: ['asset-1'],
      previewUrls: ['/storage/image-projects/img-1/a.png'],
    };
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [created],
    });
    calendar.create.mockResolvedValue({ id: 'cal-1' });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.scheduleItem('plan-1', 'cp-1', user as never),
    );
    expect(calendar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Capa',
        platforms: ['instagram'],
        leadId: 'lead-1',
      }),
      'user-1',
    );
    expect(calendar.attachStudioAsset).toHaveBeenCalledWith('cal-1', {
      source: 'image-studio',
      assetId: 'asset-1',
    });
    expect(calendar.schedule).toHaveBeenCalledWith('cal-1');
    expect(plan.items[0].status).toBe('scheduled');
    expect(plan.items[0].calendarPostId).toBe('cal-1');
  });

  it('recusa gerar imagem sem permissão', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    await expect(
      runWithTenant('tenant-1', () =>
        service.createItem('plan-1', 'cp-1', {
          id: 'user-2',
          role: 'OPERATOR',
          tenantId: 'tenant-1',
          canAccessImages: false,
          canAccessVideos: false,
        } as never),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('estima o custo do carrossel com o modelo de plano', () => {
    const estimate = service.estimate({ format: 'carousel', slides: 5 });
    expect(llm.modelFor).toHaveBeenCalledWith('plan');
    expect(estimate.stages[0]?.model).toBe('gemini-2.5-flash');
    expect(estimate.label).toMatch(/US\$/);
  });

  it('repassa o modelo da imagem na geração do carrossel', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    creativeStudio.generateCarousel.mockResolvedValue({
      projectId: 'img-1',
      assets: [{ id: 'asset-1' }],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, {
        imageModel: 'gemini-3.1-flash-image',
        imageSize: '1K',
        planModel: 'gemini-2.5-pro',
      }),
    );
    expect(creativeStudio.generateCarousel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.1-flash-image',
        imageSize: '1K',
        planModel: 'gemini-2.5-pro',
      }),
      user,
    );
  });

  it('usa o personagem como quadro inicial do vídeo', async () => {
    const reelPlan = {
      ...confirmedPlan,
      items: [{ ...produceItem, format: 'reel' as const, title: 'Reel' }],
    };
    prisma.contentPlan.findFirst.mockResolvedValue(reelPlan);
    videoStudio.create.mockResolvedValue({ id: 'vid-1' });
    characters.heroImageFile.mockResolvedValue({
      character: { identityPrompt: 'Mesmo rosto da ficha.' },
      file: {
        buffer: Buffer.from('frame'),
        originalname: 'hero.jpg',
        mimetype: 'image/jpeg',
        size: 5,
      },
    });
    videoStudio.addFrames.mockResolvedValue([{ id: 'frame-1' }]);
    videoStudio.generate.mockResolvedValue({
      assets: [{ id: 'clip-1', localPath: 'storage/video-projects/vid-1/gen.mp4' }],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...reelPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, { characterId: 'ch-1' }),
    );
    expect(characters.heroImageFile).toHaveBeenCalledWith('ch-1', undefined);
    expect(videoStudio.addFrames).toHaveBeenCalledWith(
      'vid-1',
      'first-frame',
      expect.any(Array),
    );
    expect(videoStudio.generate).toHaveBeenCalledWith(
      'vid-1',
      expect.objectContaining({
        firstFrameAssetId: 'frame-1',
        aspectRatio: '9:16',
      }),
    );
    expect(String(videoStudio.generate.mock.calls[0][1].prompt)).toContain(
      'Mesmo rosto da ficha.',
    );
    expect(plan.items[0].characterId).toBe('ch-1');
    expect(plan.items[0].previewUrls?.[0]).toBe('/storage/video-projects/vid-1/gen.mp4');
    expect(plan.items[0].selectedStudioAssetId).toBe('clip-1');
  });

  it('regera o vídeo no mesmo projeto e mantém takes anteriores', async () => {
    const created = {
      ...produceItem,
      format: 'reel' as const,
      title: 'Reel',
      status: 'created' as const,
      tool: 'video' as const,
      studioSource: 'video-studio' as const,
      studioProjectId: 'vid-keep',
      studioAssetIds: ['clip-old'],
      previewUrls: ['/storage/video-projects/vid-keep/old.mp4'],
      selectedStudioAssetId: 'clip-old',
    };
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [created],
    });
    videoStudio.generate.mockResolvedValue({
      assets: [{ id: 'clip-new', localPath: 'storage/video-projects/vid-keep/new.mp4' }],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, {}),
    );
    expect(videoStudio.create).not.toHaveBeenCalled();
    expect(videoStudio.generate).toHaveBeenCalledWith(
      'vid-keep',
      expect.objectContaining({ aspectRatio: '9:16' }),
    );
    expect(plan.items[0].studioAssetIds).toEqual(['clip-old', 'clip-new']);
    expect(plan.items[0].previewUrls).toEqual([
      '/storage/video-projects/vid-keep/old.mp4',
      '/storage/video-projects/vid-keep/new.mp4',
    ]);
    expect(plan.items[0].selectedStudioAssetId).toBe('clip-new');
    expect(plan.items[0].studioProjectId).toBe('vid-keep');
  });

  it('parte o reel em takes e gera uma take pelo id', async () => {
    const reel = {
      ...produceItem,
      format: 'reel' as const,
      title: 'Reel',
      status: 'selected' as const,
      tool: 'video' as const,
    };
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [reel],
    });
    llm.generateJson.mockImplementation(async (_prompt: string, parse: (v: unknown) => unknown) =>
      parse({
        takes: [
          {
            id: 'take-1',
            label: 'Take 1 · Hook',
            beat: 'Abre na pista',
            productionPrompt: 'FPV da pista',
          },
          {
            id: 'take-2',
            label: 'Take 2 · CTA',
            beat: 'Fecha com CTA',
            productionPrompt: 'Close do CTA',
          },
        ],
      }),
    );
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const broken = await runWithTenant('tenant-1', () =>
      service.breakItemTakes(
        'plan-1',
        'cp-1',
        { takeCount: 2, videoHookId: '' },
        user as never,
      ),
    );
    expect(broken.items[0].videoTakes).toHaveLength(2);
    expect(broken.items[0].structure).toEqual(['Abre na pista', 'Fecha com CTA']);

    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: broken.items,
    });
    videoStudio.create.mockResolvedValue({ id: 'vid-break' });
    videoStudio.generate.mockResolvedValue({
      assets: [{ id: 'clip-t1', localPath: 'storage/video-projects/vid-break/t1.mp4' }],
    });
    const created = await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, { takeId: 'take-1' }),
    );
    expect(String(videoStudio.generate.mock.calls[0][1].prompt)).toContain('FPV da pista');
    expect(created.items[0].videoTakes?.[0].studioAssetId).toBe('clip-t1');
    expect(created.items[0].selectedStudioAssetId).toBe('clip-t1');
    expect(created.items[0].studioAssetIds).toEqual(['clip-t1']);
  });

  it('escolhe a take do vídeo para a agenda', async () => {
    const created = {
      ...produceItem,
      format: 'reel' as const,
      status: 'created' as const,
      tool: 'video' as const,
      studioSource: 'video-studio' as const,
      studioProjectId: 'vid-1',
      studioAssetIds: ['clip-a', 'clip-b'],
      previewUrls: [
        '/storage/video-projects/vid-1/a.mp4',
        '/storage/video-projects/vid-1/b.mp4',
      ],
      selectedStudioAssetId: 'clip-b',
    };
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [created],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.selectItemMedia(
        'plan-1',
        'cp-1',
        { selectedStudioAssetId: 'clip-a' },
        user as never,
      ),
    );
    expect(plan.items[0].selectedStudioAssetId).toBe('clip-a');
  });

  it('agenda só a take de vídeo selecionada', async () => {
    const created = {
      ...produceItem,
      format: 'reel' as const,
      status: 'created' as const,
      tool: 'video' as const,
      studioSource: 'video-studio' as const,
      studioProjectId: 'vid-1',
      studioAssetIds: ['clip-a', 'clip-b'],
      previewUrls: [
        '/storage/video-projects/vid-1/a.mp4',
        '/storage/video-projects/vid-1/b.mp4',
      ],
      selectedStudioAssetId: 'clip-a',
    };
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [created],
    });
    calendar.create.mockResolvedValue({ id: 'cal-2' });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    await runWithTenant('tenant-1', () =>
      service.scheduleItem('plan-1', 'cp-1', user as never),
    );
    expect(calendar.attachStudioAsset).toHaveBeenCalledTimes(1);
    expect(calendar.attachStudioAsset).toHaveBeenCalledWith('cal-2', {
      source: 'video-studio',
      assetId: 'clip-a',
    });
  });

  it('recusa personagem sem foto no vídeo', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [{ ...produceItem, format: 'reel' as const }],
    });
    videoStudio.create.mockResolvedValue({ id: 'vid-2' });
    characters.heroImageFile.mockResolvedValue({
      character: { identityPrompt: '' },
      file: null,
    });
    await expect(
      runWithTenant('tenant-1', () =>
        service.createItem('plan-1', 'cp-1', user as never, { characterId: 'ch-1' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(videoStudio.generate).not.toHaveBeenCalled();
  });

  it('reescreve o roteiro da peça com o pedido do operador', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    llm.generateJson.mockImplementation(async (_prompt, parse: (value: unknown) => unknown) =>
      parse({
        title: 'Presença estratégica',
        hook: 'Sua presença é estratégica?',
        caption: 'Salve este reel',
        structure: ['Cena 1', 'Cena 2'],
        visualDirection: 'Close no criador',
        cta: 'Comenta PRESENÇA',
      }),
    );
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.rewriteItem(
        'plan-1',
        'cp-1',
        { note: 'mais direto, fale da presença digital' },
        user as never,
      ),
    );
    expect(llm.generateJson).toHaveBeenCalled();
    expect(String(llm.generateJson.mock.calls[0][0])).toContain(
      'mais direto, fale da presença digital',
    );
    expect(plan.items[0].title).toMatch(/Presença/);
    expect(plan.items[0].structure).toEqual(['Cena 1', 'Cena 2']);
    expect(plan.items[0].format).toBe('carousel');
  });

  it('reescreve o roteiro de uma peça já gerada e mantém a mídia', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [
        {
          ...produceItem,
          status: 'created',
          studioAssetIds: ['clip-1'],
          videoTakes: [
            {
              id: 'take-1',
              label: 'Take 1 · Hook',
              beat: 'Abre na pista',
              productionPrompt: 'FPV da pista',
              studioAssetId: 'clip-1',
            },
          ],
        },
      ],
    });
    llm.generateJson.mockImplementation(async (_prompt, parse: (value: unknown) => unknown) =>
      parse({
        title: 'Presença estratégica',
        hook: 'Sua presença é estratégica?',
        caption: 'Salve este reel',
        structure: ['Cena nova', 'CTA novo'],
        visualDirection: 'Close no criador',
        cta: 'Comenta PRESENÇA',
      }),
    );
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.rewriteItem('plan-1', 'cp-1', { note: 'mudar o tom' }, user as never),
    );
    expect(plan.items[0].title).toMatch(/Presença/);
    expect(plan.items[0].status).toBe('created');
    expect(plan.items[0].studioAssetIds).toEqual(['clip-1']);
    expect(plan.items[0].videoTakes).toHaveLength(1);
  });

  it('recusa reescrever peça já na agenda', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [{ ...produceItem, status: 'scheduled' }],
    });
    await expect(
      runWithTenant('tenant-1', () =>
        service.rewriteItem('plan-1', 'cp-1', { note: 'mudar o tom' }, user as never),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('reescreve o roteiro pensando no hook visual', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue({
      ...confirmedPlan,
      items: [{ ...produceItem, format: 'reel' as const }],
    });
    llm.generateJson.mockImplementation(async (_prompt, parse: (value: unknown) => unknown) =>
      parse({
        title: 'Cadeira no céu',
        hook: 'Sua presença voa?',
        caption: 'Salve este reel',
        structure: ['Cena 1 no céu', 'CTA'],
        visualDirection: 'FPV cinematográfico',
        cta: 'Comenta PRESENÇA',
      }),
    );
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.rewriteItem(
        'plan-1',
        'cp-1',
        { note: 'encaixe no stunt', videoHookId: 'stunt-cinematic' },
        user as never,
      ),
    );
    expect(String(llm.generateJson.mock.calls[0][0])).toContain('cinematic FPV');
    expect(String(llm.generateJson.mock.calls[0][0])).toMatch(
      /NÃO uma cena travada/i,
    );
    expect(plan.items[0].videoHookId).toBe('stunt-cinematic');
  });

  it('gera o reel com personagem e hook visual juntos', async () => {
    const reelPlan = {
      ...confirmedPlan,
      items: [{ ...produceItem, format: 'reel' as const, title: 'Reel' }],
    };
    prisma.contentPlan.findFirst.mockResolvedValue(reelPlan);
    videoStudio.create.mockResolvedValue({ id: 'vid-3' });
    characters.heroImageFile.mockResolvedValue({
      character: { identityPrompt: 'Mesmo rosto da ficha.' },
      file: {
        buffer: Buffer.from('frame'),
        originalname: 'hero.jpg',
        mimetype: 'image/jpeg',
        size: 5,
      },
    });
    videoStudio.addFrames.mockResolvedValue([{ id: 'frame-2' }]);
    videoStudio.generate.mockResolvedValue({
      assets: [{ id: 'clip-2', localPath: 'storage/video-projects/vid-3/gen.mp4' }],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...reelPlan,
      items: args.data.items,
    }));
    const plan = await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, {
        characterId: 'ch-1',
        videoHookId: 'stunt-cinematic',
      }),
    );
    expect(videoStudio.addFrames).toHaveBeenCalled();
    const generatePrompt = String(videoStudio.generate.mock.calls[0][1].prompt);
    expect(generatePrompt).toContain('Mesmo rosto da ficha.');
    expect(generatePrompt).toContain('cinematic FPV');
    expect(generatePrompt).toContain('Do NOT reproduce the famous office-chair');
    expect(plan.items[0].characterId).toBe('ch-1');
    expect(plan.items[0].videoHookId).toBe('stunt-cinematic');
  });

  it('injeta identidade e logo no carrossel quando as flags estão ligadas', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    brandIdentity.get.mockResolvedValue({
      logoImageId: 'logo-1',
      primaryColor: '#112233',
      voice: 'direto',
      logoAppearance: 'salvo',
    });
    brandIdentity.resolveLogoFile.mockResolvedValue({
      buffer: Buffer.from('logo'),
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: 4,
    });
    creativeStudio.generateCarousel.mockResolvedValue({
      projectId: 'img-brand',
      assets: [{ id: 'asset-1', localPath: 'storage/image-projects/img-brand/a.png' }],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, {
        useBrandIdentity: true,
        useBrandLogo: true,
        logoAppearance: 'canto inferior direito, 8%',
      }),
    );
    expect(creativeStudio.generateCarousel).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringMatching(/Identidade da marca[\s\S]*#112233[\s\S]*canto inferior direito/),
        brandReferences: [
          expect.objectContaining({ originalname: 'logo.png' }),
        ],
      }),
      user,
    );
  });

  it('não anexa logo quando só a identidade está ligada', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    brandIdentity.get.mockResolvedValue({
      logoImageId: 'logo-1',
      primaryColor: '#445566',
    });
    creativeStudio.generateCarousel.mockResolvedValue({
      projectId: 'img-2',
      assets: [{ id: 'asset-1', localPath: 'storage/image-projects/img-2/a.png' }],
    });
    prisma.contentPlan.update.mockImplementation(async (args: { data: { items: unknown } }) => ({
      ...confirmedPlan,
      items: args.data.items,
    }));
    await runWithTenant('tenant-1', () =>
      service.createItem('plan-1', 'cp-1', user as never, {
        useBrandIdentity: true,
        useBrandLogo: false,
      }),
    );
    expect(brandIdentity.resolveLogoFile).not.toHaveBeenCalled();
    expect(creativeStudio.generateCarousel).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('#445566'),
      }),
      user,
    );
    expect(creativeStudio.generateCarousel.mock.calls[0][0].brandReferences).toBeUndefined();
  });

  it('exige aparência do logo quando Usar logo está ligado', async () => {
    prisma.contentPlan.findFirst.mockResolvedValue(confirmedPlan);
    brandIdentity.get.mockResolvedValue({ logoImageId: 'logo-1' });
    await expect(
      runWithTenant('tenant-1', () =>
        service.createItem('plan-1', 'cp-1', user as never, {
          useBrandLogo: true,
          logoAppearance: '',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
