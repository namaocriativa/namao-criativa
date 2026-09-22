import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramGraphClient } from '../instagram/instagram-graph.client';
import {
  CALENDAR_TARGET_STATUS,
} from './calendar.platforms';
import {
  isPubliclyReachableOrigin,
  signCalendarAssetUrl,
} from './calendar.public-url';

type CalendarPost = Awaited<ReturnType<CalendarService['findById']>>;
type CalendarTarget = CalendarPost['targets'][number];
type CalendarAsset = CalendarPost['assets'][number];

const MANUAL_HINT =
  'Na hora, copie a legenda e abra o app. Depois marque como publicado.';

@Injectable()
export class CalendarPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarPublisher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly calendar: CalendarService,
    private readonly prisma: PrismaService,
    private readonly graph: InstagramGraphClient,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.processDue().catch((error) => {
        this.logger.warn(
          `Falha no tick do calendário: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, 30_000);
    void this.processDue();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  capabilities() {
    const origin = this.publicOrigin();
    return {
      instagram: {
        graphConfigured: this.graph.configured(),
        autoPublish: this.graph.configured() && isPubliclyReachableOrigin(origin),
        needsPublicApi: !isPubliclyReachableOrigin(origin),
      },
      youtube: { oauthConfigured: false, autoPublish: false },
      tiktok: { oauthConfigured: false, autoPublish: false },
      publicMediaOrigin: origin,
    };
  }

  async processDue(now = new Date()) {
    if (this.running) return [];
    this.running = true;
    try {
      const due = await this.calendar.findDue(now);
      const results: Awaited<ReturnType<CalendarService['findById']>>[] = [];
      for (const post of due) {
        results.push(await this.publishPost(post.id));
      }
      return results;
    } finally {
      this.running = false;
    }
  }

  async publishPost(id: string) {
    const claimed = await this.calendar.claimForPublish(id);
    if (!claimed) return this.calendar.findById(id);
    const post = await this.calendar.findById(id);
    for (const target of post.targets) {
      if (target.status === CALENDAR_TARGET_STATUS.PUBLISHED) continue;
      await this.publishTarget(post, target);
    }
    return this.calendar.syncPostStatus(id);
  }

  private async publishTarget(post: CalendarPost, target: CalendarTarget) {
    await this.prisma.contentCalendarTarget.update({
      where: { id: target.id },
      data: { status: CALENDAR_TARGET_STATUS.PUBLISHING, error: '' },
    });
    try {
      if (target.platform === 'instagram') {
        await this.publishInstagram(post, target);
        return;
      }
      await this.prisma.contentCalendarTarget.update({
        where: { id: target.id },
        data: {
          status: CALENDAR_TARGET_STATUS.READY_MANUAL,
          error: MANUAL_HINT,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.contentCalendarTarget.update({
        where: { id: target.id },
        data: {
          status: CALENDAR_TARGET_STATUS.FAILED,
          error: message,
        },
      });
    }
  }

  private async publishInstagram(post: CalendarPost, target: CalendarTarget) {
    const ownerId = post.leadId || post.customerId;
    if (!ownerId) {
      await this.prisma.contentCalendarTarget.update({
        where: { id: target.id },
        data: {
          status: CALENDAR_TARGET_STATUS.NEEDS_CONNECTION,
          error:
            'Vincule um lead ou cliente com Instagram autorizado para publicar automaticamente.',
        },
      });
      return;
    }
    const connection = await this.prisma.instagramConnection.findFirst({
      where: post.leadId
        ? { leadId: post.leadId }
        : { customerId: post.customerId },
    });
    if (!connection) {
      await this.prisma.contentCalendarTarget.update({
        where: { id: target.id },
        data: {
          status: CALENDAR_TARGET_STATUS.NEEDS_CONNECTION,
          error:
            'Este perfil ainda não conectou o Instagram. Peça a autorização Graph e tente de novo.',
        },
      });
      return;
    }
    if (!this.hasPublishScope(connection.scopes)) {
      await this.prisma.contentCalendarTarget.update({
        where: { id: target.id },
        data: {
          status: CALENDAR_TARGET_STATUS.NEEDS_CONNECTION,
          error:
            'Reconecte o Instagram do cliente para incluir a permissão de publicação.',
        },
      });
      return;
    }
    const origin = this.publicOrigin();
    if (!isPubliclyReachableOrigin(origin)) {
      throw new Error(
        'O Instagram precisa baixar a mídia numa URL pública. Defina PUBLIC_CHAT_API_ORIGIN com o domínio da API.',
      );
    }
    const media = this.pickPublishAsset(post.assets);
    if (!media) {
      throw new Error('Adicione uma imagem ou vídeo para o Instagram');
    }
    const secret = this.config.get<string>('JWT_SECRET')?.trim() || '';
    if (!secret) throw new Error('JWT_SECRET ausente para assinar a mídia');
    const signed = signCalendarAssetUrl({
      origin,
      assetId: media.id,
      secret,
    });
    const creationId = await this.graph.createMediaContainer({
      igUserId: connection.igUserId,
      accessToken: connection.accessToken,
      caption: post.caption || post.title,
      imageUrl: media.kind === 'video' ? undefined : signed.url,
      videoUrl: media.kind === 'video' ? signed.url : undefined,
    });
    await this.waitForContainer(creationId, connection.accessToken);
    const published = await this.graph.publishContainer({
      igUserId: connection.igUserId,
      accessToken: connection.accessToken,
      creationId,
    });
    await this.prisma.contentCalendarTarget.update({
      where: { id: target.id },
      data: {
        status: CALENDAR_TARGET_STATUS.PUBLISHED,
        error: '',
        externalId: published.id,
        permalink: published.permalink || '',
        publishedAt: new Date(),
      },
    });
  }

  private async waitForContainer(creationId: string, accessToken: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await this.graph.getContainerStatus({
        creationId,
        accessToken,
      });
      if (status.statusCode === 'FINISHED') return;
      if (status.statusCode === 'ERROR') {
        throw new Error(status.status || 'Instagram recusou a mídia');
      }
      await this.delay(3000);
    }
    throw new Error('Timeout aguardando o Instagram processar a mídia');
  }

  private pickPublishAsset(assets: CalendarAsset[]): CalendarAsset | null {
    const video = assets.find((asset) => asset.kind === 'video');
    if (video) return video;
    return assets.find((asset) => asset.kind === 'image') || null;
  }

  private hasPublishScope(scopes: string | null | undefined): boolean {
    return String(scopes || '')
      .split(',')
      .map((item) => item.trim())
      .includes('instagram_content_publish');
  }

  private publicOrigin(): string {
    const origin =
      this.config.get<string>('PUBLIC_CHAT_API_ORIGIN')?.trim() ||
      `http://localhost:${this.config.get<string>('PORT')?.trim() || '4000'}`;
    return origin.replace(/\/$/, '');
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
