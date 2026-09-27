import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../auth/identity';
import { LlmService } from '../llm/llm.service';
import { InstagramGraphClient } from '../instagram/instagram-graph.client';
import { LeadActivityService } from '../lead-activity/lead-activity.service';
import { buildLeadBrief } from '../owner/lead-brief';
import type { LeadLike } from '../owner/lead-like';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { runWithAiUsage } from '../ai-usage/ai-usage.context';
import { AI_FEATURES } from '../ai-usage/ai-usage.features';
import { requireTenantId, tenantWhere } from '../tenant/tenant.util';
import { compactIgCorpus } from './ig-corpus';
import { estimateIgSkillUsd } from './ig-cost';
import { buildIgPlanPrompt, parseIgReport } from './ig-report';
import { publicIgJob, type IgSkillLogItem, type IgSkillStage } from './ig-skill.jobs';

@Injectable()
export class IgSkillService {
  private readonly logger = new Logger(IgSkillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
    private readonly access: StudioLeadAccessService,
    private readonly llm: LlmService,
    private readonly graph: InstagramGraphClient,
    private readonly activity: LeadActivityService,
  ) {}

  estimate(model?: string) {
    const chosen = model?.trim() || this.llm.modelFor('plan');
    return estimateIgSkillUsd(chosen);
  }

  async findJob(id: string) {
    const row = await this.prisma.instagramSkillJob.findUnique({ where: { id } });
    if (!row || row.tenantId !== requireTenantId()) {
      throw new NotFoundException('Job não encontrado');
    }
    return publicIgJob(row);
  }

  async latest(leadId?: string, customerId?: string) {
    const ownerId = (leadId || customerId || '').trim();
    if (!ownerId) throw new BadRequestException('Informe leadId ou customerId');
    const row = await this.prisma.instagramSkillJob.findFirst({
      where: tenantWhere({
        status: 'done',
        ...ownerWhere(ownerId),
      }),
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { job: null };
    return { job: publicIgJob(row) };
  }

  async start(opts: {
    user: JwtUser;
    leadId?: string;
    customerId?: string;
    model?: string;
    notes?: string;
    days?: number;
  }) {
    const leadId = opts.leadId?.trim() || '';
    const customerId = opts.customerId?.trim() || '';
    if ((leadId && customerId) || (!leadId && !customerId)) {
      throw new BadRequestException('Informe leadId ou customerId');
    }
    const ownerId = leadId || customerId;
    await this.access.assertCanAccess(opts.user, ownerId);
    const conn = await this.prisma.instagramConnection.findFirst({
      where: ownerWhere(ownerId),
    });
    if (!conn) {
      throw new BadRequestException('Conecte o Instagram deste perfil para analisar');
    }
    const days = opts.days === 90 ? 90 : 30;
    const model = opts.model?.trim() || this.llm.modelFor('plan');
    const row = await this.prisma.instagramSkillJob.create({
      data: {
        tenantId: requireTenantId(),
        leadId: leadId || null,
        customerId: customerId || null,
        status: 'queued',
        stage: 'queued',
        model,
        notes: (opts.notes || '').trim(),
        days,
        createdByUserId: opts.user.id,
        log: [
          { stage: 'queued', message: 'Na fila', at: new Date().toISOString() },
        ],
      },
    });
    await this.trace(ownerId, {
      title: 'Skill Instagram iniciada',
      summary: `${days} dias`,
      payload: { jobId: row.id, status: 'queued', days },
    });
    void this.run(row.id, ownerId).catch((error) => {
      this.logger.error(
        error instanceof Error ? error.stack || error.message : String(error),
      );
    });
    return publicIgJob(row);
  }

  private async run(jobId: string, ownerId: string) {
    const meta = await this.prisma.instagramSkillJob.findUnique({
      where: { id: jobId },
      select: { createdByUserId: true, leadId: true, customerId: true },
    });
    return runWithAiUsage(
      {
        feature: AI_FEATURES.igSkill,
        userId: meta?.createdByUserId,
        leadId: meta?.leadId,
        customerId: meta?.customerId,
        jobId,
      },
      () => this.execute(jobId, ownerId),
    );
  }

  private async execute(jobId: string, ownerId: string) {
    try {
      const job = await this.requireJob(jobId);
      const conn = await this.prisma.instagramConnection.findFirst({
        where: ownerWhere(ownerId),
      });
      if (!conn) {
        throw new BadRequestException('Instagram desconectado');
      }
      const detail = (await this.owners.requireDetail(ownerId)) as LeadLike;
      const brief = buildLeadBrief(detail);

      await this.mark(jobId, 'media', 'Lendo o feed…');
      const since = new Date(Date.now() - job.days * 24 * 60 * 60 * 1000);
      const media = await this.graph.listMedia({
        igUserId: conn.igUserId,
        accessToken: conn.accessToken,
        limit: 40,
        since,
      });

      await this.mark(jobId, 'compact', 'Compactando o corpus…');
      const corpus = compactIgCorpus(media, {
        username: conn.username,
        windowDays: job.days,
      });

      await this.mark(jobId, 'plan', 'Escrevendo o relatório…');
      const report = await this.llm.generateJson(
        buildIgPlanPrompt({ brief, notes: job.notes, corpus }),
        (value) => parseIgReport(value, { brief, notes: job.notes, corpus }),
        { role: 'plan', model: job.model || undefined, expectedShape: '{overview,ideas}' },
      );

      await this.prisma.instagramSkillJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          stage: 'done',
          report: report as object,
          error: null,
        },
      });
      await this.trace(ownerId, {
        title: 'Skill Instagram concluída',
        summary: `${corpus.postCount} posts analisados`,
        payload: { jobId, status: 'done' },
      });
      await this.appendLog(jobId, 'done', `Pronto · ${corpus.postCount} posts`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao analisar o Instagram';
      await this.prisma.instagramSkillJob.update({
        where: { id: jobId },
        data: { status: 'error', stage: 'error', error: message },
      });
      await this.trace(ownerId, {
        title: 'Skill Instagram falhou',
        summary: message,
        payload: { jobId, status: 'error', error: message },
      });
      await this.appendLog(jobId, 'error', message);
    }
  }

  private async trace(
    ownerId: string,
    input: {
      title: string;
      summary: string;
      payload: Record<string, unknown>;
    },
  ) {
    try {
      await this.activity.record({
        leadId: ownerId,
        channel: 'skill',
        kind: 'skill.instagram',
        title: input.title,
        summary: input.summary,
        payload: input.payload,
      });
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Falha ao gravar histórico da skill Instagram',
      );
    }
  }

  private async requireJob(id: string) {
    const row = await this.prisma.instagramSkillJob.findFirst({
      where: tenantWhere({ id }),
    });
    if (!row) throw new NotFoundException('Job não encontrado');
    return row;
  }

  private async mark(id: string, stage: IgSkillStage, message: string) {
    await this.prisma.instagramSkillJob.update({
      where: { id },
      data: { status: 'running', stage },
    });
    await this.appendLog(id, stage, message);
  }

  private async appendLog(id: string, stage: IgSkillStage, message: string) {
    const row = await this.prisma.instagramSkillJob.findUnique({ where: { id } });
    const log = (Array.isArray(row?.log) ? row.log : []) as IgSkillLogItem[];
    log.push({ stage, message, at: new Date().toISOString() });
    await this.prisma.instagramSkillJob.update({
      where: { id },
      data: { log },
    });
  }
}
