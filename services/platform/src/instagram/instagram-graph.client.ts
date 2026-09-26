import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/** Instagram Login — lê mídia sem Facebook Page. */
export const INSTAGRAM_OAUTH_SCOPES = ['instagram_business_basic'] as const;

export const INSTAGRAM_PUBLISH_SCOPE = 'instagram_business_content_publish';

export type IgMediaItem = {
  id: string;
  mediaType: string;
  url: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
};

export type IgAccountFound = {
  found: true;
  igUserId: string;
  username: string | null;
};

export type IgAccountLookup =
  | IgAccountFound
  | { found: false; reason: 'no_instagram_account' | 'not_professional' };

export type IgContainerStatus = {
  statusCode: string;
  status?: string;
};

export type IgTokenExchange = {
  accessToken: string;
  expiresAt: Date | null;
  igUserId: string | null;
};

@Injectable()
export class InstagramGraphClient {
  private readonly logger = new Logger(InstagramGraphClient.name);

  constructor(private readonly config: ConfigService) {}

  get version(): string {
    return this.config.get<string>('META_GRAPH_VERSION')?.trim() || 'v21.0';
  }

  get appId(): string {
    return (
      this.config.get<string>('META_INSTAGRAM_APP_ID')?.trim() ||
      this.config.get<string>('META_APP_ID')?.trim() ||
      ''
    );
  }

  get appSecret(): string {
    return (
      this.config.get<string>('META_INSTAGRAM_APP_SECRET')?.trim() ||
      this.config.get<string>('META_APP_SECRET')?.trim() ||
      ''
    );
  }

  get redirectUri(): string {
    return (
      this.config.get<string>('META_REDIRECT_URI')?.trim() ||
      `http://localhost:${process.env.PLATFORM_PORT || process.env.PORT || '3000'}/auth/instagram/callback`
    );
  }

  configured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  oauthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      response_type: 'code',
      scope: INSTAGRAM_OAUTH_SCOPES.join(','),
      enable_fb_login: 'false',
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<IgTokenExchange> {
    const cleanCode = code.replace(/#_$/, '');
    const shortRes = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code: cleanCode,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      },
    );
    const short = this.readTokenPayload(shortRes.data);
    if (!short.accessToken) {
      throw new Error('Instagram não retornou access_token');
    }

    try {
      const longRes = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.appSecret,
          access_token: short.accessToken,
        },
        timeout: 15000,
      });
      const longToken = String(longRes.data?.access_token || short.accessToken);
      const expiresIn = Number(longRes.data?.expires_in || 0);
      return {
        accessToken: longToken,
        expiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        igUserId: short.igUserId,
      };
    } catch (error) {
      this.logger.warn(
        `Long-lived Instagram token failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        accessToken: short.accessToken,
        expiresAt: null,
        igUserId: short.igUserId,
      };
    }
  }

  async findInstagramAccount(accessToken: string): Promise<IgAccountLookup> {
    const res = await axios.get(`https://graph.instagram.com/${this.version}/me`, {
      params: {
        fields: 'user_id,id,username,account_type',
        access_token: accessToken,
      },
      timeout: 15000,
    });
    const igUserId = String(res.data?.user_id || res.data?.id || '');
    if (!igUserId) {
      return { found: false, reason: 'no_instagram_account' };
    }
    const accountType = String(res.data?.account_type || '').toUpperCase();
    if (accountType === 'PERSONAL') {
      return { found: false, reason: 'not_professional' };
    }
    return {
      found: true,
      igUserId,
      username: res.data?.username ? String(res.data.username) : null,
    };
  }

  async listMedia(opts: {
    igUserId: string;
    accessToken: string;
    limit?: number;
    since?: Date;
  }): Promise<IgMediaItem[]> {
    const max = Math.min(Math.max(opts.limit ?? 12, 1), 40);
    const items: IgMediaItem[] = [];
    let after: string | undefined;
    let olderThanWindow = false;
    while (items.length < max && !olderThanWindow) {
      const pageSize = Math.min(25, max - items.length);
      const res = await axios.get(
        `https://graph.instagram.com/${this.version}/${opts.igUserId}/media`,
        {
          params: {
            fields:
              'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
            limit: pageSize,
            after,
            access_token: opts.accessToken,
          },
          timeout: 20000,
        },
      );
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      if (!data.length) break;
      for (const item of data) {
        const parsed = parseMediaItem(item as Record<string, unknown>);
        if (!parsed) continue;
        if (opts.since && parsed.timestamp) {
          const at = Date.parse(parsed.timestamp);
          if (!Number.isNaN(at) && at < opts.since.getTime()) {
            olderThanWindow = true;
            break;
          }
        }
        items.push(parsed);
        if (items.length >= max) break;
      }
      const nextAfter = pagingAfter(res.data?.paging);
      if (!nextAfter || nextAfter === after) break;
      after = nextAfter;
    }
    return items;
  }

  async createMediaContainer(opts: {
    igUserId: string;
    accessToken: string;
    caption: string;
    imageUrl?: string;
    videoUrl?: string;
  }): Promise<string> {
    const params: Record<string, string> = {
      caption: opts.caption,
      access_token: opts.accessToken,
    };
    if (opts.videoUrl) {
      params.media_type = 'REELS';
      params.video_url = opts.videoUrl;
      params.share_to_feed = 'true';
    } else if (opts.imageUrl) {
      params.image_url = opts.imageUrl;
    } else {
      throw new Error('Mídia obrigatória para publicar no Instagram');
    }
    try {
      const res = await axios.post(
        `https://graph.instagram.com/${this.version}/${opts.igUserId}/media`,
        null,
        { params, timeout: 30000 },
      );
      const id = String(res.data?.id || '');
      if (!id) throw new Error('Instagram não criou o container');
      return id;
    } catch (error) {
      throw new Error(this.graphError(error, 'Falha ao criar mídia no Instagram'));
    }
  }

  async getContainerStatus(opts: {
    creationId: string;
    accessToken: string;
  }): Promise<IgContainerStatus> {
    try {
      const res = await axios.get(
        `https://graph.instagram.com/${this.version}/${opts.creationId}`,
        {
          params: {
            fields: 'status_code,status',
            access_token: opts.accessToken,
          },
          timeout: 15000,
        },
      );
      return {
        statusCode: String(res.data?.status_code || ''),
        status: res.data?.status ? String(res.data.status) : undefined,
      };
    } catch (error) {
      throw new Error(
        this.graphError(error, 'Falha ao consultar o container do Instagram'),
      );
    }
  }

  async publishContainer(opts: {
    igUserId: string;
    accessToken: string;
    creationId: string;
  }): Promise<{ id: string; permalink?: string }> {
    try {
      const res = await axios.post(
        `https://graph.instagram.com/${this.version}/${opts.igUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: opts.creationId,
            access_token: opts.accessToken,
          },
          timeout: 30000,
        },
      );
      const id = String(res.data?.id || '');
      if (!id) throw new Error('Instagram não publicou a mídia');
      let permalink: string | undefined;
      try {
        const media = await axios.get(
          `https://graph.instagram.com/${this.version}/${id}`,
          {
            params: {
              fields: 'permalink',
              access_token: opts.accessToken,
            },
            timeout: 15000,
          },
        );
        if (media.data?.permalink) permalink = String(media.data.permalink);
      } catch {
        // permalink is optional
      }
      return { id, permalink };
    } catch (error) {
      throw new Error(this.graphError(error, 'Falha ao publicar no Instagram'));
    }
  }

  private readTokenPayload(data: unknown): {
    accessToken: string;
    igUserId: string | null;
  } {
    const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const nested = Array.isArray(root.data) ? root.data[0] : null;
    const payload =
      nested && typeof nested === 'object'
        ? (nested as Record<string, unknown>)
        : root;
    const accessToken = String(payload.access_token || '');
    const igUserId = payload.user_id ? String(payload.user_id) : null;
    return { accessToken, igUserId };
  }

  private graphError(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as
        | { error?: { message?: string }; error_message?: string }
        | undefined;
      const message = body?.error?.message || body?.error_message;
      if (typeof message === 'string' && message.trim()) return message;
      if (error.message) return error.message;
    }
    return error instanceof Error ? error.message : fallback;
  }
}

function parseMediaItem(item: Record<string, unknown>): IgMediaItem | null {
  const id = String(item.id || '');
  if (!id) return null;
  const mediaType = String(item.media_type || '');
  const url =
    mediaType === 'VIDEO'
      ? String(item.thumbnail_url || item.media_url || '')
      : String(item.media_url || item.thumbnail_url || '');
  return {
    id,
    mediaType,
    url,
    permalink: item.permalink ? String(item.permalink) : undefined,
    caption: item.caption ? String(item.caption) : undefined,
    timestamp: item.timestamp ? String(item.timestamp) : undefined,
  };
}

function pagingAfter(paging: unknown): string {
  if (!paging || typeof paging !== 'object') return '';
  const cursors = (paging as { cursors?: { after?: unknown } }).cursors;
  return typeof cursors?.after === 'string' ? cursors.after : '';
}
