import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LlmService } from '../llm/llm.service';
import { buildLeadBrief } from '../owner/lead-brief';
import type { LeadLike } from '../owner/lead-like';
import { CreateCalendarPostDto } from './dto/create-calendar-post.dto';
import { UpdateCalendarPostDto } from './dto/update-calendar-post.dto';
import { CreateCalendarReminderDto } from './dto/create-calendar-reminder.dto';
import { UpdateCalendarReminderDto } from './dto/update-calendar-reminder.dto';
import { AttachStudioAssetDto } from './dto/attach-studio-asset.dto';
import { isCalendarReminderStatus } from './calendar.reminders';
import {
  CalendarIdeasQueryDto,
  CalendarPostsFromIdeasDto,
} from './dto/calendar-ideas.dto';
import {
  buildCalendarIdeasPrompt,
  parseCalendarIdeasSpec,
  type CalendarIdeasSpec,
} from './calendar-ideas.planner';
import {
  CALENDAR_POST_STATUS,
  CALENDAR_TARGET_STATUS,
  uniquePlatforms,
  recomputePostStatus,
  type CalendarPlatform,
} from './calendar.platforms';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

export type CalendarUploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const POST_INCLUDE = {
  targets: { orderBy: { platform: 'asc' as const } },
  assets: { orderBy: { createdAt: 'asc' as const } },
  lead: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
};

const REMINDER_INCLUDE = {
  lead: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
};

export type CalendarOwnerQuery = {
  leadId?: string;
  customerId?: string;
};

const UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly llm: LlmService,
  ) {}

  async findRange(from?: string, to?: string, owner?: CalendarOwnerQuery) {
    const ownerFilter = await this.ownerFilter(owner);
    return this.prisma.contentCalendarPost.findMany({
      where: {
        ...this.scheduledWhere(from, to),
        ...ownerFilter,
        ...tenantWhere(),
      },
      orderBy: { scheduledAt: 'asc' },
      include: POST_INCLUDE,
    });
  }

  async findItems(from?: string, to?: string, owner?: CalendarOwnerQuery) {
    const [posts, reminders] = await Promise.all([
      this.findRange(from, to, owner),
      this.findReminders(from, to, owner),
    ]);
    return { posts, reminders };
  }

  async findReminders(from?: string, to?: string, owner?: CalendarOwnerQuery) {
    const ownerFilter = await this.ownerFilter(owner);
    return this.prisma.contentCalendarReminder.findMany({
      where: {
        ...this.scheduledWhere(from, to),
        ...ownerFilter,
        ...tenantWhere(),
      },
      orderBy: { scheduledAt: 'asc' },
      include: REMINDER_INCLUDE,
    });
  }

  async findReminderById(id: string) {
    const reminder = await this.prisma.contentCalendarReminder.findUnique({
      where: { id },
      include: REMINDER_INCLUDE,
    });
    if (!reminder) throw new NotFoundException('Lembrete não encontrado');
    return assertSameTenant(reminder, 'Lembrete não encontrado');
  }

  async createReminder(dto: CreateCalendarReminderDto, userId: string) {
    const owner = await this.requireOwner(dto.leadId, dto.customerId);
    return this.prisma.contentCalendarReminder.create({
      data: {
        tenantId: requireTenantId(),
        title: dto.title.trim(),
        notes: (dto.notes || '').trim(),
        scheduledAt: this.parseDate(dto.scheduledAt, 'scheduledAt'),
        status: 'open',
        leadId: owner.leadId,
        customerId: owner.customerId,
        createdByUserId: userId,
      },
      include: REMINDER_INCLUDE,
    });
  }

  async updateReminder(id: string, dto: UpdateCalendarReminderDto) {
    await this.requireReminder(id);
    const data: {
      title?: string;
      notes?: string;
      scheduledAt?: Date;
      status?: string;
    } = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.notes !== undefined) data.notes = dto.notes.trim();
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = this.parseDate(dto.scheduledAt, 'scheduledAt');
    }
    if (dto.status !== undefined) {
      if (!isCalendarReminderStatus(dto.status)) {
        throw new BadRequestException('Status do lembrete inválido');
      }
      data.status = dto.status;
    }
    await this.prisma.contentCalendarReminder.update({
      where: { id },
      data,
    });
    return this.findReminderById(id);
  }

  async removeReminder(id: string) {
    await this.requireReminder(id);
    await this.prisma.contentCalendarReminder.delete({ where: { id } });
    return { ok: true };
  }

  async findById(id: string) {
    const post = await this.prisma.contentCalendarPost.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Post do calendário não encontrado');
    return assertSameTenant(post, 'Post do calendário não encontrado');
  }

  async generateIdeas(dto: CalendarIdeasQueryDto): Promise<CalendarIdeasSpec> {
    const owner = await this.requireOwner(dto.leadId, dto.customerId);
    const profile = await this.loadOwnerProfile(owner);
    const notes = dto.notes?.trim() || '';
    const plannerContext = { brief: buildLeadBrief(profile), notes };
    try {
      return await this.llm.generateJson(
        buildCalendarIdeasPrompt(plannerContext),
        (value) => parseCalendarIdeasSpec(value, plannerContext),
        {
          role: 'plan',
          temperature: 0.2,
          expectedShape: 'CalendarIdeasSpec',
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao planejar as ideias';
      throw new BadGatewayException(message);
    }
  }

  async createFromIdeas(dto: CalendarPostsFromIdeasDto, userId: string) {
    const owner = await this.requireOwner(dto.leadId, dto.customerId);
    const platforms = uniquePlatforms(dto.platforms?.length ? dto.platforms : ['instagram']);
    if (!platforms.length) {
      throw new BadRequestException('Escolha pelo menos uma plataforma');
    }
    const start = dto.startAt
      ? this.parseDate(dto.startAt, 'startAt')
      : nextMorning();
    const posts: Awaited<ReturnType<CalendarService['create']>>[] = [];
    for (let i = 0; i < dto.ideas.length; i += 1) {
      const idea = dto.ideas[i];
      const scheduledAt = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      posts.push(
        await this.create(
          {
            title: idea.title.trim(),
            caption: idea.caption.trim(),
            scheduledAt: scheduledAt.toISOString(),
            platforms,
            leadId: owner.leadId || undefined,
            customerId: owner.customerId || undefined,
          },
          userId,
        ),
      );
    }
    return { posts };
  }

  async create(dto: CreateCalendarPostDto, userId: string) {
    const platforms = uniquePlatforms(dto.platforms);
    if (!platforms.length) {
      throw new BadRequestException('Escolha pelo menos uma plataforma');
    }
    const owner = await this.resolveOwner(dto.leadId, dto.customerId);
    const scheduledAt = this.parseDate(dto.scheduledAt, 'scheduledAt');
    return this.prisma.contentCalendarPost.create({
      data: {
        tenantId: requireTenantId(),
        title: dto.title.trim(),
        caption: (dto.caption || '').trim(),
        scheduledAt,
        status: CALENDAR_POST_STATUS.DRAFT,
        leadId: owner.leadId,
        customerId: owner.customerId,
        createdByUserId: userId,
        targets: {
          create: platforms.map((platform) => ({
            platform,
            status: CALENDAR_TARGET_STATUS.PENDING,
          })),
        },
      },
      include: POST_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateCalendarPostDto) {
    const current = await this.requirePost(id);
    if (
      current.status === CALENDAR_POST_STATUS.PUBLISHING
    ) {
      throw new BadRequestException('Espere a publicação terminar para editar');
    }
    const owner =
      dto.leadId !== undefined || dto.customerId !== undefined
        ? await this.resolveOwner(dto.leadId, dto.customerId)
        : {
            leadId: current.leadId,
            customerId: current.customerId,
          };
    const data: {
      title?: string;
      caption?: string;
      scheduledAt?: Date;
      leadId?: string | null;
      customerId?: string | null;
    } = {
      leadId: owner.leadId,
      customerId: owner.customerId,
    };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.caption !== undefined) data.caption = dto.caption.trim();
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = this.parseDate(dto.scheduledAt, 'scheduledAt');
    }
    await this.prisma.contentCalendarPost.update({
      where: { id },
      data,
    });
    if (dto.platforms) {
      await this.replaceTargets(id, uniquePlatforms(dto.platforms));
    }
    return this.findById(id);
  }

  async remove(id: string) {
    await this.requirePost(id);
    await this.prisma.contentCalendarPost.delete({ where: { id } });
    await this.storage.removeCalendarDir(id);
    return { ok: true };
  }

  async addUploads(id: string, files: CalendarUploadFile[]) {
    await this.requirePost(id);
    if (!files.length) {
      throw new BadRequestException('Envie pelo menos um arquivo');
    }
    for (const file of files) {
      const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
      if (!UPLOAD_MIME.has(mime)) {
        throw new BadRequestException(`Tipo não suportado: ${mime || file.originalname}`);
      }
      const saved = await this.storage.saveCalendarAsset(
        id,
        file.buffer,
        file.originalname,
        mime,
        'upload',
      );
      await this.prisma.contentCalendarAsset.create({
        data: {
          postId: id,
          kind: mime.startsWith('video/') ? 'video' : 'image',
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
          source: 'upload',
        },
      });
    }
    return this.findById(id);
  }

  async attachStudioAsset(id: string, dto: AttachStudioAssetDto) {
    await this.requirePost(id);
    if (dto.source === 'image-studio') {
      const asset = await this.prisma.imageAsset.findUnique({
        where: { id: dto.assetId },
      });
      if (!asset) throw new NotFoundException('Imagem do studio não encontrada');
      const buffer = await this.storage.readStorageFile(asset.localPath);
      if (!buffer) throw new BadRequestException('Arquivo da imagem não está no disco');
      const saved = await this.storage.saveCalendarAsset(
        id,
        buffer,
        asset.filename,
        asset.mimeType,
        'studio',
      );
      await this.prisma.contentCalendarAsset.create({
        data: {
          postId: id,
          kind: 'image',
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
          source: 'image-studio',
          sourceId: asset.id,
        },
      });
      return this.findById(id);
    }
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: dto.assetId },
    });
    if (!asset) throw new NotFoundException('Vídeo do studio não encontrado');
    const buffer = await this.storage.readStorageFile(asset.localPath);
    if (!buffer) throw new BadRequestException('Arquivo do vídeo não está no disco');
    const saved = await this.storage.saveCalendarAsset(
      id,
      buffer,
      asset.filename,
      asset.mimeType,
      'studio',
    );
    await this.prisma.contentCalendarAsset.create({
      data: {
        postId: id,
        kind: 'video',
        localPath: saved.localPath,
        filename: saved.filename,
        mimeType: saved.mimeType,
        source: 'video-studio',
        sourceId: asset.id,
      },
    });
    return this.findById(id);
  }

  async removeAsset(id: string, assetId: string) {
    await this.requirePost(id);
    const asset = await this.prisma.contentCalendarAsset.findFirst({
      where: { id: assetId, postId: id },
    });
    if (!asset) throw new NotFoundException('Mídia do post não encontrada');
    await this.prisma.contentCalendarAsset.delete({ where: { id: assetId } });
    await this.storage.removeImageFile(asset.localPath);
    return this.findById(id);
  }

  async schedule(id: string) {
    const post = await this.findById(id);
    if (!post.targets.length) {
      throw new BadRequestException('Escolha pelo menos uma plataforma');
    }
    if (!post.assets.length) {
      throw new BadRequestException('Adicione uma imagem ou vídeo antes de agendar');
    }
    await this.prisma.contentCalendarTarget.updateMany({
      where: {
        postId: id,
        status: {
          notIn: [CALENDAR_TARGET_STATUS.PUBLISHED],
        },
      },
      data: {
        status: CALENDAR_TARGET_STATUS.PENDING,
        error: '',
      },
    });
    return this.prisma.contentCalendarPost.update({
      where: { id },
      data: { status: CALENDAR_POST_STATUS.SCHEDULED },
      include: POST_INCLUDE,
    });
  }

  async markTargetPublished(id: string, targetId: string, permalink?: string) {
    const post = await this.requirePost(id);
    const target = post.targets.find((item) => item.id === targetId);
    if (!target) throw new NotFoundException('Plataforma do post não encontrada');
    await this.prisma.contentCalendarTarget.update({
      where: { id: targetId },
      data: {
        status: CALENDAR_TARGET_STATUS.PUBLISHED,
        error: '',
        permalink: permalink?.trim() || target.permalink,
        publishedAt: new Date(),
      },
    });
    return this.syncPostStatus(id);
  }

  async syncPostStatus(id: string) {
    const post = await this.findById(id);
    const status = recomputePostStatus(post.targets);
    return this.prisma.contentCalendarPost.update({
      where: { id },
      data: { status },
      include: POST_INCLUDE,
    });
  }

  async findDue(now = new Date()) {
    return this.prisma.contentCalendarPost.findMany({
      where: {
        status: CALENDAR_POST_STATUS.SCHEDULED,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      include: POST_INCLUDE,
    });
  }

  async claimForPublish(id: string) {
    const result = await this.prisma.contentCalendarPost.updateMany({
      where: {
        id,
        status: {
          in: [CALENDAR_POST_STATUS.SCHEDULED, CALENDAR_POST_STATUS.DRAFT],
        },
      },
      data: { status: CALENDAR_POST_STATUS.PUBLISHING },
    });
    return result.count > 0;
  }

  private async replaceTargets(postId: string, platforms: CalendarPlatform[]) {
    if (!platforms.length) {
      throw new BadRequestException('Escolha pelo menos uma plataforma');
    }
    const existing = await this.prisma.contentCalendarTarget.findMany({
      where: { postId },
    });
    const keep = new Set(platforms);
    for (const target of existing) {
      if (!keep.has(target.platform as CalendarPlatform)) {
        if (target.status === CALENDAR_TARGET_STATUS.PUBLISHED) continue;
        await this.prisma.contentCalendarTarget.delete({ where: { id: target.id } });
      }
    }
    for (const platform of platforms) {
      const found = existing.find((item) => item.platform === platform);
      if (found) continue;
      await this.prisma.contentCalendarTarget.create({
        data: {
          postId,
          platform,
          status: CALENDAR_TARGET_STATUS.PENDING,
        },
      });
    }
  }

  private scheduledWhere(
    from?: string,
    to?: string,
  ): { scheduledAt?: { gte?: Date; lte?: Date } } {
    if (!from && !to) return {};
    const scheduledAt: { gte?: Date; lte?: Date } = {};
    if (from) scheduledAt.gte = this.parseDate(from, 'from');
    if (to) scheduledAt.lte = this.parseDate(to, 'to');
    return { scheduledAt };
  }

  private async ownerFilter(
    owner?: CalendarOwnerQuery,
  ): Promise<{ leadId?: string; customerId?: string }> {
    const leadId = owner?.leadId?.trim() || '';
    const customerId = owner?.customerId?.trim() || '';
    if (leadId && customerId) {
      throw new BadRequestException('Filtre por lead ou cliente, não os dois');
    }
    if (leadId) {
      await this.requireOwner(leadId, undefined);
      return { leadId };
    }
    if (customerId) {
      await this.requireOwner(undefined, customerId);
      return { customerId };
    }
    return {};
  }

  private async requireOwner(
    leadId?: string | null,
    customerId?: string | null,
  ): Promise<{ leadId: string | null; customerId: string | null }> {
    const owner = await this.resolveOwner(leadId, customerId);
    if (!owner.leadId && !owner.customerId) {
      throw new BadRequestException('Escolha um lead ou um cliente');
    }
    return owner;
  }

  private async loadOwnerProfile(owner: {
    leadId: string | null;
    customerId: string | null;
  }): Promise<LeadLike> {
    if (owner.leadId) {
      const found = await this.prisma.lead.findUnique({
        where: { id: owner.leadId },
      });
      if (!found) throw new NotFoundException('Lead não encontrado');
      return assertSameTenant(found, 'Lead não encontrado') as LeadLike;
    }
    if (owner.customerId) {
      const found = await this.prisma.customer.findUnique({
        where: { id: owner.customerId },
      });
      if (!found) throw new NotFoundException('Cliente não encontrado');
      return assertSameTenant(found, 'Cliente não encontrado') as LeadLike;
    }
    throw new BadRequestException('Escolha um lead ou um cliente');
  }

  private async resolveOwner(
    leadId?: string | null,
    customerId?: string | null,
  ): Promise<{ leadId: string | null; customerId: string | null }> {
    const lead = leadId?.trim() || null;
    const customer = customerId?.trim() || null;
    if (lead && customer) {
      throw new BadRequestException('Vincule um lead ou um cliente, não os dois');
    }
    if (lead) {
      const found = await this.prisma.lead.findUnique({ where: { id: lead } });
      if (!found) throw new NotFoundException('Lead não encontrado');
      assertSameTenant(found, 'Lead não encontrado');
      return { leadId: lead, customerId: null };
    }
    if (customer) {
      const found = await this.prisma.customer.findUnique({
        where: { id: customer },
      });
      if (!found) throw new NotFoundException('Cliente não encontrado');
      assertSameTenant(found, 'Cliente não encontrado');
      return { leadId: null, customerId: customer };
    }
    return { leadId: null, customerId: null };
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Data inválida em ${field}`);
    }
    return date;
  }

  private async requirePost(id: string) {
    return this.findById(id);
  }

  private async requireReminder(id: string) {
    return this.findReminderById(id);
  }
}

function nextMorning(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}
