import { BadRequestException } from '@nestjs/common';
import { runWithTenant } from '../tenant/tenant-context';
import { ContentPlanService } from './content-plan.service';

const igReport = {
  overview: { who: 'Studio Ana', sells: 'Cortes', audience: 'Curitiba', stage: 'marca' },
  pillars: ['rotina'],
  gaps: ['prova'],
  ideas: [],
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
  const llm = { generateJson: jest.fn() };
  const activity = { record: jest.fn() };
  const user = { id: 'user-1' };
  const service = new ContentPlanService(
    prisma as never,
    access as never,
    llm as never,
    activity as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    activity.record.mockResolvedValue({ id: 'act-1' });
    prisma.contentPlan.deleteMany.mockResolvedValue({ count: 0 });
    prisma.contentPlan.findMany.mockResolvedValue([]);
    prisma.aiUsageEvent.updateMany.mockResolvedValue({ count: 0 });
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
            title: 'Plano',
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
            title: 'Plano',
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

  it('abre com todos os planos confirmados', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'ig-1',
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
  });

  it('gera um draft com N itens datados', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({ id: 'conn-1' });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'ig-1',
      report: igReport,
    });
    llm.generateJson.mockImplementation(async (_prompt, parse: (value: unknown) => unknown) =>
      parse({
        items: [
          { title: 'Capa', hook: 'Hook um', caption: 'Salve este post', format: 'carousel' },
        ],
      }),
    );
    prisma.contentPlan.create.mockImplementation(async (args: { data: { items: unknown[] } }) => ({
      id: 'plan-1',
      title: 'Setembro',
      description: '',
      postsPerWeek: 3,
      weeks: 2,
      formats: ['carousel'],
      items: args.data.items,
      status: 'draft',
      sourceIgJobId: 'ig-1',
      createdAt: new Date('2026-09-26T12:00:00.000Z'),
    }));

    const plan = await runWithTenant('tenant-1', () =>
      service.generate(
        {
          leadId: 'lead-1',
          title: 'Setembro',
          postsPerWeek: 3,
          weeks: 2,
          formats: ['carousel'],
        },
        user as never,
      ),
    );

    expect(plan.items).toHaveLength(6);
    expect(plan.status).toBe('draft');
    expect(prisma.contentPlan.deleteMany).toHaveBeenCalled();
    expect(llm.generateJson).toHaveBeenCalled();
    const prompt = llm.generateJson.mock.calls[0][0] as string;
    expect(prompt).toContain('Studio Ana');
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
      items: [],
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
    expect(prisma.contentPlan.deleteMany).not.toHaveBeenCalled();
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
});
