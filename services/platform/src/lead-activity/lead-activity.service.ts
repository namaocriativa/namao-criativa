import { Injectable, NotFoundException } from '@nestjs/common';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerCreateData, ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  dayKey,
  historyItem,
  joinLabels,
  sortHistory,
  type LeadHistoryItem,
} from './lead-history';

export type LeadActivityChannel = 'email' | 'whatsapp' | 'system' | string;

export type { LeadHistoryItem } from './lead-history';

export type RecordLeadActivityInput = {
  leadId: string;
  channel: LeadActivityChannel;
  kind: string;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class LeadActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
  ) {}

  async record(input: RecordLeadActivityInput) {
    const kind = await this.owners.requireKind(input.leadId);
    return this.prisma.leadActivity.create({
      data: {
        ...ownerCreateData(kind, input.leadId),
        channel: input.channel,
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        ...(input.payload ? { payload: input.payload as object } : {}),
      },
    });
  }

  async listHistory(leadId: string) {
    const lead = await this.owners.findProfile(leadId);
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    const where = ownerWhere(leadId);
    const [
      activities,
      connections,
      siteJobs,
      igJobs,
      invites,
      accounts,
      shares,
      posts,
      reminders,
      images,
      sources,
      chats,
    ] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.instagramConnection.findMany({
        where,
        select: {
          id: true,
          username: true,
          igUserId: true,
          scopes: true,
          tokenExpiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.siteSkillJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          stage: true,
          slug: true,
          repo: true,
          model: true,
          error: true,
          createdByUserId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.instagramSkillJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          stage: true,
          days: true,
          model: true,
          error: true,
          createdByUserId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.invite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          phone: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.clientAccount.findMany({
        where,
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      this.prisma.studioLeadShare.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.contentCalendarPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
          createdByUserId: true,
        },
      }),
      this.prisma.contentCalendarReminder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
          createdByUserId: true,
        },
      }),
      this.prisma.leadImage.findMany({
        where,
        select: {
          id: true,
          source: true,
          filename: true,
          createdAt: true,
        },
      }),
      this.prisma.leadSource.findMany({
        where,
        select: { id: true, provider: true, url: true, createdAt: true },
      }),
      this.prisma.chatSession.findMany({
        where,
        select: {
          id: true,
          channel: true,
          status: true,
          messageCount: true,
          createdAt: true,
        },
      }),
    ]);

    const items: LeadHistoryItem[] = [
      ...activities.map((activity) => {
        const payload =
          activity.payload &&
          typeof activity.payload === 'object' &&
          !Array.isArray(activity.payload)
            ? (activity.payload as Record<string, unknown>)
            : null;
        return historyItem({
          id: activity.id,
          at: activity.createdAt,
          kind: activity.kind,
          channel: activity.channel,
          title: activity.title,
          summary: activity.summary || null,
          payload,
          source: 'lead_activity',
        });
      }),
      ...connections.map((connection) =>
        historyItem({
          id: `instagram:${connection.id}`,
          at: connection.createdAt,
          kind: 'instagram.connected',
          channel: 'instagram',
          title: 'Instagram conectado',
          summary: connection.username
            ? `@${connection.username.replace(/^@/, '')}`
            : connection.igUserId,
          actor: { type: lead.kind },
          payload: {
            igUserId: connection.igUserId,
            username: connection.username,
            scopes: connection.scopes,
            tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
          },
          source: 'instagram_connection',
        }),
      ),
      ...siteJobs.map((job) =>
        historyItem({
          id: `site-skill:${job.id}`,
          at: job.status === 'queued' ? job.createdAt : job.updatedAt,
          kind: 'skill.site',
          channel: 'skill',
          title: 'Skill site lead',
          summary: joinLabels([job.status, job.slug, job.repo, job.error]),
          actor: job.createdByUserId
            ? { type: 'studio', id: job.createdByUserId }
            : { type: 'studio' },
          payload: {
            jobId: job.id,
            status: job.status,
            stage: job.stage,
            slug: job.slug,
            repo: job.repo,
            model: job.model,
            error: job.error,
          },
          source: 'site_skill_job',
        }),
      ),
      ...igJobs.map((job) =>
        historyItem({
          id: `ig-skill:${job.id}`,
          at: job.status === 'queued' ? job.createdAt : job.updatedAt,
          kind: 'skill.instagram',
          channel: 'skill',
          title: 'Skill Instagram',
          summary: joinLabels([
            job.status,
            job.days ? `${job.days} dias` : null,
            job.error,
          ]),
          actor: job.createdByUserId
            ? { type: 'studio', id: job.createdByUserId }
            : { type: 'studio' },
          payload: {
            jobId: job.id,
            status: job.status,
            stage: job.stage,
            days: job.days,
            model: job.model,
            error: job.error,
          },
          source: 'instagram_skill_job',
        }),
      ),
      ...invites.map((invite) =>
        historyItem({
          id: `invite:${invite.id}`,
          at: invite.createdAt,
          kind: 'invite.created',
          channel: 'invite',
          title: 'Convite gerado',
          summary: joinLabels([invite.status, invite.phone]),
          payload: {
            inviteId: invite.id,
            status: invite.status,
            phone: invite.phone,
            expiresAt: invite.expiresAt.toISOString(),
          },
          source: 'invite',
        }),
      ),
      ...accounts.map((account) =>
        historyItem({
          id: `account:${account.id}`,
          at: account.createdAt,
          kind: 'account.created',
          channel: 'account',
          title: 'Conta do lead criada',
          summary: account.email || account.name,
          payload: {
            accountId: account.id,
            email: account.email,
            name: account.name,
          },
          source: 'client_account',
        }),
      ),
      ...shares.map((share) =>
        historyItem({
          id: `share:${share.id}`,
          at: share.createdAt,
          kind: 'lead.shared',
          channel: 'studio',
          title: 'Perfil compartilhado',
          summary: share.user.name || share.user.email,
          actor: {
            type: 'studio',
            id: share.user.id,
            name: share.user.name || share.user.email,
          },
          payload: {
            userId: share.user.id,
            name: share.user.name,
            email: share.user.email,
          },
          source: 'studio_share',
        }),
      ),
      ...posts.map((post) =>
        historyItem({
          id: `calendar:${post.id}`,
          at: post.createdAt,
          kind: 'calendar.post',
          channel: 'calendar',
          title: 'Post na agenda',
          summary: joinLabels([post.title, post.status]),
          actor: post.createdByUserId
            ? { type: 'studio', id: post.createdByUserId }
            : { type: 'studio' },
          payload: {
            postId: post.id,
            title: post.title,
            status: post.status,
            scheduledAt: post.scheduledAt.toISOString(),
          },
          source: 'calendar_post',
        }),
      ),
      ...reminders.map((reminder) =>
        historyItem({
          id: `reminder:${reminder.id}`,
          at: reminder.createdAt,
          kind: 'calendar.reminder',
          channel: 'calendar',
          title: 'Lembrete na agenda',
          summary: joinLabels([reminder.title, reminder.status]),
          actor: reminder.createdByUserId
            ? { type: 'studio', id: reminder.createdByUserId }
            : { type: 'studio' },
          payload: {
            reminderId: reminder.id,
            title: reminder.title,
            status: reminder.status,
            scheduledAt: reminder.scheduledAt.toISOString(),
          },
          source: 'calendar_reminder',
        }),
      ),
      ...this.groupedImages(images),
      ...this.groupedSources(sources),
      ...chats.map((session) =>
        historyItem({
          id: `chat:${session.id}`,
          at: session.createdAt,
          kind: 'chat.session',
          channel: session.channel || 'chat',
          title: 'Chat no site',
          summary: joinLabels([
            session.status,
            session.messageCount
              ? `${session.messageCount} mensagem(ns)`
              : null,
          ]),
          payload: {
            sessionId: session.id,
            channel: session.channel,
            status: session.status,
            messageCount: session.messageCount,
          },
          source: 'chat_session',
        }),
      ),
      historyItem({
        id: 'system:created',
        at: lead.createdAt,
        kind: lead.kind === 'customer' ? 'customer.created' : 'lead.created',
        channel: 'system',
        title: lead.kind === 'customer' ? 'Cliente criado' : 'Lead criado',
        payload: { name: lead.name },
        source: 'profile',
      }),
    ];

    return { items: sortHistory(items) };
  }

  private groupedImages(
    images: Array<{
      id: string;
      source: string;
      filename: string;
      createdAt: Date;
    }>,
  ): LeadHistoryItem[] {
    const groups = new Map<string, typeof images>();
    for (const image of images) {
      const key = `${image.source || 'upload'}|${dayKey(image.createdAt)}`;
      const list = groups.get(key) ?? [];
      list.push(image);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([key, list]) => {
      const [source] = key.split('|');
      const fromInstagram = source === 'instagram';
      return historyItem({
        id: `images:${key}`,
        at: list[0].createdAt,
        kind: fromInstagram ? 'image.instagram' : 'image.imported',
        channel: fromInstagram ? 'instagram' : 'media',
        title: fromInstagram
          ? `Fotos do Instagram (${list.length})`
          : `Fotos importadas (${list.length})`,
        summary: source && source !== 'upload' ? source : null,
        payload: {
          source,
          count: list.length,
          imageIds: list.map((image) => image.id),
          filenames: list.map((image) => image.filename),
        },
        source: 'lead_image',
      });
    });
  }

  private groupedSources(
    sources: Array<{
      id: string;
      provider: string;
      url: string | null;
      createdAt: Date;
    }>,
  ): LeadHistoryItem[] {
    const groups = new Map<string, typeof sources>();
    for (const source of sources) {
      const key = dayKey(source.createdAt);
      const list = groups.get(key) ?? [];
      list.push(source);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([day, list]) =>
      historyItem({
        id: `sources:${day}`,
        at: list[0].createdAt,
        kind: 'enrichment.sources',
        channel: 'enrichment',
        title: 'Dados buscados',
        summary: list.map((item) => item.provider).join(', '),
        payload: {
          providers: list.map((item) => item.provider),
          urls: list.map((item) => item.url).filter(Boolean),
          sourceIds: list.map((item) => item.id),
        },
        source: 'lead_source',
      }),
    );
  }
}
