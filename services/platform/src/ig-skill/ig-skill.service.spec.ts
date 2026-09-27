import { BadRequestException } from '@nestjs/common';
import { runWithTenant } from '../tenant/tenant-context';
import { IgSkillService } from './ig-skill.service';

describe('IgSkillService', () => {
  const prisma = {
    instagramConnection: { findFirst: jest.fn() },
    instagramSkillJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const owners = { requireDetail: jest.fn() };
  const access = { assertCanAccess: jest.fn() };
  const llm = { modelFor: jest.fn(() => 'gemini-2.5-flash'), generateJson: jest.fn() };
  const graph = { listMedia: jest.fn() };
  const activity = { record: jest.fn() };
  const service = new IgSkillService(
    prisma as never,
    owners as never,
    access as never,
    llm as never,
    graph as never,
    activity as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    llm.modelFor.mockReturnValue('gemini-2.5-flash');
    activity.record.mockResolvedValue({ id: 'act-1' });
  });

  it('recusa sem Instagram conectado', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue(null);
    await expect(
      runWithTenant('tenant-1', () =>
        service.start({
          user: { id: 'u1' } as never,
          leadId: 'lead-1',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.instagramSkillJob.create).not.toHaveBeenCalled();
  });

  it('cria o job quando há conexão', async () => {
    const runSpy = jest
      .spyOn(service as never, 'run' as never)
      .mockResolvedValue(undefined as never);
    prisma.instagramConnection.findFirst.mockResolvedValue({
      igUserId: 'ig-1',
      accessToken: 'tok',
      username: 'loja.ana',
    });
    prisma.instagramSkillJob.create.mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      stage: 'queued',
      log: [],
      error: null,
      model: 'gemini-2.5-flash',
      notes: '',
      days: 30,
      report: null,
    });
    const job = await runWithTenant('tenant-1', () =>
      service.start({
        user: { id: 'u1' } as never,
        leadId: 'lead-1',
        notes: 'foco em avaliação',
        days: 30,
      }),
    );
    expect(job.id).toBe('job-1');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        kind: 'skill.instagram',
        title: 'Skill Instagram iniciada',
        payload: expect.objectContaining({ jobId: 'job-1', status: 'queued' }),
      }),
    );
    expect(prisma.instagramSkillJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          days: 30,
          tenantId: 'tenant-1',
        }),
      }),
    );
    runSpy.mockRestore();
  });

  it('lê o feed mockado e grava o relatório', async () => {
    prisma.instagramConnection.findFirst.mockResolvedValue({
      igUserId: 'ig-1',
      accessToken: 'tok',
      username: 'loja.ana',
    });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'job-1',
      days: 30,
      model: 'gemini-2.5-flash',
      notes: '',
    });
    prisma.instagramSkillJob.findUnique.mockResolvedValue({ id: 'job-1', log: [] });
    prisma.instagramSkillJob.update.mockResolvedValue({});
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      category: 'advocacia',
    });
    graph.listMedia.mockResolvedValue([
      {
        id: '1',
        mediaType: 'IMAGE',
        url: 'https://x/1.jpg',
        caption: 'Atendimento em Campinas #advocacia',
        timestamp: '2026-09-20T10:00:00.000Z',
      },
    ]);
    llm.generateJson.mockResolvedValue({
      overview: { who: 'Firma', sells: 'advocacia', audience: 'SP', stage: 'marca' },
      ideas: [],
    });

    await runWithTenant('tenant-1', () =>
      (service as unknown as { run: (id: string, ownerId: string) => Promise<void> }).run(
        'job-1',
        'lead-1',
      ),
    );

    expect(graph.listMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        igUserId: 'ig-1',
        accessToken: 'tok',
        limit: 40,
      }),
    );
    expect(llm.generateJson).toHaveBeenCalled();
    expect(prisma.instagramSkillJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'done', stage: 'done' }),
      }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        kind: 'skill.instagram',
        title: 'Skill Instagram concluída',
        payload: expect.objectContaining({ jobId: 'job-1', status: 'done' }),
      }),
    );
  });
});
