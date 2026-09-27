import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../auth/identity';
import { LeadActivityService } from '../lead-activity/lead-activity.service';
import { LlmService } from '../llm/llm.service';
import { ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { runWithAiUsage } from '../ai-usage/ai-usage.context';
import { AI_FEATURES } from '../ai-usage/ai-usage.features';
import { requireTenantId, tenantWhere } from '../tenant/tenant.util';
import {
  buildContentPlanPrompt,
  buildScheduleDates,
  clampPostsPerWeek,
  clampWeeks,
  parseContentPlanSpec,
  parseFormats,
  summarizeIgReport,
} from './content-plan.planner';
import { GenerateContentPlanDto } from './dto/generate-content-plan.dto';
import {
  CONTENT_PLAN_STATUS,
  publicContentPlan,
  type ContentPlanReason,
} from './content-plan.public';

@Injectable()
export class ContentPlanService {
  private readonly logger = new Logger(ContentPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioLeadAccessService,
    private readonly llm: LlmService,
    private readonly activity: LeadActivityService,
  ) {}

  async open(user: JwtUser, leadId?: string, customerId?: string) {
    const owner = await this.requireOwner(user, leadId, customerId);
    const gate = await this.gate(owner.ownerId);
    if (!gate.ready) {
      return { ready: false as const, reason: gate.reason, plans: [] };
    }
    const plans = await this.prisma.contentPlan.findMany({
      where: tenantWhere({
        status: CONTENT_PLAN_STATUS.CONFIRMED,
        ...ownerWhere(owner.ownerId),
      }),
      orderBy: { updatedAt: 'desc' },
    });
    return {
      ready: true as const,
      igJobId: gate.igJobId,
      plans: plans.map(publicContentPlan),
    };
  }

  async generate(dto: GenerateContentPlanDto, user: JwtUser) {
    const owner = await this.requireOwner(user, dto.leadId, dto.customerId);
    const gate = await this.gate(owner.ownerId);
    if (!gate.ready || !gate.igJob || !gate.report) {
      throw new BadRequestException(this.gateMessage(gate.reason));
    }
    const formats = parseFormats(dto.formats);
    if (!formats.length) {
      throw new BadRequestException('Escolha ao menos um tipo de post');
    }
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Informe o título do plano');
    const postsPerWeek = clampPostsPerWeek(dto.postsPerWeek);
    const weeks = clampWeeks(dto.weeks);
    const dates = buildScheduleDates(postsPerWeek, weeks).map((date) =>
      date.toISOString(),
    );
    const description = dto.description?.trim() || '';
    const context = {
      title,
      description,
      postsPerWeek,
      weeks,
      formats,
      dates,
      report: gate.report,
    };
    let spec: ReturnType<typeof parseContentPlanSpec>;
    const jobId = `content-plan:${owner.ownerId}:${Date.now()}`;
    try {
      spec = await runWithAiUsage(
        {
          feature: AI_FEATURES.contentPlan,
          userId: user.id,
          leadId: owner.leadId,
          customerId: owner.customerId,
          jobId,
        },
        () =>
          this.llm.generateJson(
            buildContentPlanPrompt(context),
            (value) => parseContentPlanSpec(value, context),
            {
              role: 'plan',
              temperature: 0.2,
              expectedShape: 'ContentPlanSpec',
            },
          ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o plano';
      throw new BadGatewayException(message);
    }
    await this.prisma.contentPlan.deleteMany({
      where: tenantWhere({
        status: CONTENT_PLAN_STATUS.DRAFT,
        ...ownerWhere(owner.ownerId),
      }),
    });
    const row = await this.prisma.contentPlan.create({
      data: {
        tenantId: requireTenantId(),
        leadId: owner.leadId,
        customerId: owner.customerId,
        title,
        description,
        postsPerWeek,
        weeks,
        formats,
        items: spec.items,
        status: CONTENT_PLAN_STATUS.DRAFT,
        sourceIgJobId: gate.igJob.id,
        createdByUserId: user.id,
      },
    });
    await this.prisma.aiUsageEvent.updateMany({
      where: { jobId },
      data: { jobId: row.id },
    });
    return publicContentPlan(row);
  }

  async confirm(id: string, user: JwtUser) {
    const row = await this.requirePlan(id);
    const ownerId = row.leadId || row.customerId;
    if (!ownerId) throw new BadRequestException('Plano sem perfil');
    await this.access.assertCanAccess(user, ownerId);
    if (row.status !== CONTENT_PLAN_STATUS.DRAFT) {
      throw new BadRequestException('Só dá para confirmar um rascunho');
    }
    const confirmed = await this.prisma.contentPlan.update({
      where: { id: row.id },
      data: { status: CONTENT_PLAN_STATUS.CONFIRMED },
    });
    await this.trace(ownerId, {
      title: 'Plano de conteúdo confirmado',
      summary: `${confirmed.title} · ${confirmed.postsPerWeek} posts/semana`,
      payload: { planId: confirmed.id, status: 'confirmed' },
    });
    return publicContentPlan(confirmed);
  }

  async discard(id: string, user: JwtUser) {
    const row = await this.requirePlan(id);
    const ownerId = row.leadId || row.customerId;
    if (!ownerId) throw new BadRequestException('Plano sem perfil');
    await this.access.assertCanAccess(user, ownerId);
    if (row.status !== CONTENT_PLAN_STATUS.DRAFT) {
      throw new BadRequestException('Só dá para descartar um rascunho');
    }
    await this.prisma.contentPlan.delete({ where: { id: row.id } });
    return { ok: true };
  }

  private async gate(ownerId: string): Promise<{
    ready: boolean;
    reason?: ContentPlanReason;
    igJobId?: string;
    igJob?: { id: string };
    report?: ReturnType<typeof summarizeIgReport>;
  }> {
    const conn = await this.prisma.instagramConnection.findFirst({
      where: ownerWhere(ownerId),
    });
    if (!conn) {
      return { ready: false, reason: 'instagram_disconnected' };
    }
    const igJob = await this.prisma.instagramSkillJob.findFirst({
      where: tenantWhere({
        status: 'done',
        ...ownerWhere(ownerId),
      }),
      orderBy: { createdAt: 'desc' },
    });
    const report = summarizeIgReport(igJob?.report);
    if (!igJob || !report) {
      return { ready: false, reason: 'ig_skill_required' };
    }
    return { ready: true, igJobId: igJob.id, igJob: { id: igJob.id }, report };
  }

  private gateMessage(reason?: ContentPlanReason): string {
    if (reason === 'instagram_disconnected') {
      return 'Conecte o Instagram deste perfil.';
    }
    return 'Rode a Skill Instagram e espere o relatório.';
  }

  private async requireOwner(
    user: JwtUser,
    leadId?: string,
    customerId?: string,
  ): Promise<{
    ownerId: string;
    leadId: string | null;
    customerId: string | null;
  }> {
    const lead = leadId?.trim() || '';
    const customer = customerId?.trim() || '';
    if ((lead && customer) || (!lead && !customer)) {
      throw new BadRequestException('Informe leadId ou customerId');
    }
    const ownerId = lead || customer;
    await this.access.assertCanAccess(user, ownerId);
    return {
      ownerId,
      leadId: lead || null,
      customerId: customer || null,
    };
  }

  private async requirePlan(id: string) {
    const row = await this.prisma.contentPlan.findFirst({
      where: tenantWhere({ id }),
    });
    if (!row) throw new NotFoundException('Plano não encontrado');
    return row;
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
        kind: 'skill.content-plan',
        title: input.title,
        summary: input.summary,
        payload: input.payload,
      });
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? error.message
          : 'Falha ao gravar histórico do plano',
      );
    }
  }
}
