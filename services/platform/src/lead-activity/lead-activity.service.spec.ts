import { NotFoundException } from '@nestjs/common';
import { LeadActivityService } from './lead-activity.service';

describe('LeadActivityService', () => {
  const empty = [] as never[];
  const prisma = {
    leadActivity: { create: jest.fn(), findMany: jest.fn() },
    instagramConnection: { findMany: jest.fn() },
    siteSkillJob: { findMany: jest.fn() },
    instagramSkillJob: { findMany: jest.fn() },
    invite: { findMany: jest.fn() },
    clientAccount: { findMany: jest.fn() },
    studioLeadShare: { findMany: jest.fn() },
    contentCalendarPost: { findMany: jest.fn() },
    contentCalendarReminder: { findMany: jest.fn() },
    leadImage: { findMany: jest.fn() },
    leadSource: { findMany: jest.fn() },
    chatSession: { findMany: jest.fn() },
  };
  const owners = {
    requireKind: jest.fn().mockResolvedValue('lead'),
    findProfile: jest.fn(),
  };
  const service = new LeadActivityService(prisma as never, owners as never);

  beforeEach(() => {
    jest.resetAllMocks();
    owners.requireKind.mockResolvedValue('lead');
    prisma.leadActivity.findMany.mockResolvedValue(empty);
    prisma.instagramConnection.findMany.mockResolvedValue(empty);
    prisma.siteSkillJob.findMany.mockResolvedValue(empty);
    prisma.instagramSkillJob.findMany.mockResolvedValue(empty);
    prisma.invite.findMany.mockResolvedValue(empty);
    prisma.clientAccount.findMany.mockResolvedValue(empty);
    prisma.studioLeadShare.findMany.mockResolvedValue(empty);
    prisma.contentCalendarPost.findMany.mockResolvedValue(empty);
    prisma.contentCalendarReminder.findMany.mockResolvedValue(empty);
    prisma.leadImage.findMany.mockResolvedValue(empty);
    prisma.leadSource.findMany.mockResolvedValue(empty);
    prisma.chatSession.findMany.mockResolvedValue(empty);
  });

  it('grava uma atividade', async () => {
    prisma.leadActivity.create.mockResolvedValue({ id: 'act-1' });
    await service.record({
      leadId: 'lead-1',
      channel: 'email',
      kind: 'site-introduction',
      title: 'E-mail enviado: Apresentação do site',
      summary: 'Enviado para ana@loja.com',
      payload: { to: 'ana@loja.com' },
    });
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: {
        leadId: 'lead-1',
        customerId: null,
        channel: 'email',
        kind: 'site-introduction',
        title: 'E-mail enviado: Apresentação do site',
        summary: 'Enviado para ana@loja.com',
        payload: { to: 'ana@loja.com' },
      },
    });
  });

  it('404 se o lead não existe', async () => {
    owners.findProfile.mockResolvedValue(null);
    await expect(service.listHistory('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('monta timeline com atividades, Instagram, skills e criação', async () => {
    owners.findProfile.mockResolvedValue({
      id: 'lead-1',
      kind: 'lead',
      name: 'Firma',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-03T10:00:00.000Z'),
    });
    prisma.leadActivity.findMany.mockResolvedValue([
      {
        id: 'act-1',
        title: 'WhatsApp enviado: Acesso ao painel',
        summary: 'Enviado para +5511999999999',
        channel: 'whatsapp',
        kind: 'credentials',
        payload: { to: '+5511999999999' },
        createdAt: new Date('2026-01-04T10:00:00.000Z'),
      },
    ]);
    prisma.instagramConnection.findMany.mockResolvedValue([
      {
        id: 'ig-1',
        username: 'firma',
        igUserId: '1784',
        scopes: 'instagram_business_basic',
        tokenExpiresAt: null,
        createdAt: new Date('2026-01-05T10:00:00.000Z'),
      },
    ]);
    prisma.instagramSkillJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'done',
        stage: 'report',
        days: 30,
        model: 'gpt',
        error: null,
        createdByUserId: 'op-1',
        createdAt: new Date('2026-01-06T09:00:00.000Z'),
        updatedAt: new Date('2026-01-06T10:00:00.000Z'),
      },
    ]);
    prisma.leadImage.findMany.mockResolvedValue([
      {
        id: 'img-1',
        source: 'instagram',
        filename: 'a.jpg',
        createdAt: new Date('2026-01-05T11:00:00.000Z'),
      },
    ]);

    const result = await service.listHistory('lead-1');
    expect(result.items.map((item) => item.kind)).toEqual([
      'skill.instagram',
      'image.instagram',
      'instagram.connected',
      'credentials',
      'lead.created',
    ]);
    expect(result.items[0]).toMatchObject({
      channel: 'skill',
      source: 'instagram_skill_job',
      payload: { jobId: 'job-1', status: 'done' },
    });
    expect(result.items.find((item) => item.kind === 'instagram.connected')).toMatchObject({
      summary: '@firma',
      payload: { igUserId: '1784' },
    });
    expect(result.items[0]).toMatchObject({
      title: 'Skill Instagram concluída',
      summary: 'Relatório pronto · 30 dias',
    });
  });

  it('não duplica skill Instagram quando já existe o job', async () => {
    owners.findProfile.mockResolvedValue({
      id: 'lead-1',
      kind: 'lead',
      name: 'Firma',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-03T10:00:00.000Z'),
    });
    prisma.leadActivity.findMany.mockResolvedValue([
      {
        id: 'act-ig',
        title: 'Skill Instagram concluída',
        summary: '12 posts analisados',
        channel: 'skill',
        kind: 'skill.instagram',
        payload: { jobId: 'job-1', status: 'done' },
        createdAt: new Date('2026-01-06T10:00:00.000Z'),
      },
    ]);
    prisma.instagramSkillJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'done',
        stage: 'done',
        days: 30,
        model: 'gpt',
        error: null,
        createdByUserId: 'op-1',
        createdAt: new Date('2026-01-06T09:00:00.000Z'),
        updatedAt: new Date('2026-01-06T10:00:00.000Z'),
      },
    ]);

    const result = await service.listHistory('lead-1');
    expect(result.items.filter((item) => item.kind === 'skill.instagram')).toHaveLength(1);
    expect(result.items[0].source).toBe('instagram_skill_job');
  });

  it('mantém a atividade da skill se o job não vier na query', async () => {
    owners.findProfile.mockResolvedValue({
      id: 'lead-1',
      kind: 'lead',
      name: 'Firma',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-03T10:00:00.000Z'),
    });
    prisma.leadActivity.findMany.mockResolvedValue([
      {
        id: 'act-ig',
        title: 'Skill Instagram concluída',
        summary: '12 posts analisados',
        channel: 'skill',
        kind: 'skill.instagram',
        payload: { jobId: 'job-1', status: 'done' },
        createdAt: new Date('2026-01-06T10:00:00.000Z'),
      },
    ]);
    prisma.instagramSkillJob.findMany.mockRejectedValue(new Error('missing table'));

    const result = await service.listHistory('lead-1');
    expect(result.items[0]).toMatchObject({
      kind: 'skill.instagram',
      source: 'lead_activity',
      payload: { jobId: 'job-1' },
    });
  });
});
