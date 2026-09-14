import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type IgMediaItem = {
  id: string;
  mediaType: string;
  url: string;
  permalink?: string;
  caption?: string;
};

@Injectable()
export class InstagramGraphClient {
  private readonly logger = new Logger(InstagramGraphClient.name);

  constructor(private readonly config: ConfigService) {}

  get version(): string {
    return this.config.get<string>('META_GRAPH_VERSION')?.trim() || 'v21.0';
  }

  get appId(): string {
    return this.config.get<string>('META_APP_ID')?.trim() || '';
  }

  get appSecret(): string {
    return this.config.get<string>('META_APP_SECRET')?.trim() || '';
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
      scope: [
        'instagram_basic',
        'pages_show_list',
        'pages_read_engagement',
        'instagram_manage_insights',
      ].join(','),
    });
    return `https://www.facebook.com/${this.version}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{
    accessToken: string;
    expiresAt: Date | null;
  }> {
    const shortRes = await axios.get(
      `https://graph.facebook.com/${this.version}/oauth/access_token`,
      {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: this.redirectUri,
          code,
        },
        timeout: 15000,
      },
    );
    const shortToken = String(shortRes.data?.access_token || '');
    if (!shortToken) {
      throw new Error('Meta não retornou access_token');
    }

    try {
      const longRes = await axios.get(
        `https://graph.facebook.com/${this.version}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortToken,
          },
          timeout: 15000,
        },
      );
      const accessToken = String(longRes.data?.access_token || shortToken);
      const expiresIn = Number(longRes.data?.expires_in || 0);
      return {
        accessToken,
        expiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      this.logger.warn(
        `Long-lived token exchange failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { accessToken: shortToken, expiresAt: null };
    }
  }

  async findInstagramAccount(accessToken: string): Promise<{
    igUserId: string;
    username: string | null;
  } | null> {
    const pages = await axios.get(
      `https://graph.facebook.com/${this.version}/me/accounts`,
      {
        params: {
          fields: 'id,name,instagram_business_account{id,username}',
          access_token: accessToken,
        },
        timeout: 15000,
      },
    );
    const data = Array.isArray(pages.data?.data) ? pages.data.data : [];
    for (const page of data) {
      const ig = page?.instagram_business_account;
      if (ig?.id) {
        return {
          igUserId: String(ig.id),
          username: ig.username ? String(ig.username) : null,
        };
      }
    }
    return null;
  }

  async listMedia(opts: {
    igUserId: string;
    accessToken: string;
    limit?: number;
  }): Promise<IgMediaItem[]> {
    const res = await axios.get(
      `https://graph.facebook.com/${this.version}/${opts.igUserId}/media`,
      {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
          limit: opts.limit ?? 12,
          access_token: opts.accessToken,
        },
        timeout: 20000,
      },
    );
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    const items: IgMediaItem[] = [];
    for (const item of data) {
      const mediaType = String(item.media_type || '');
      const url =
        mediaType === 'VIDEO'
          ? String(item.thumbnail_url || item.media_url || '')
          : String(item.media_url || item.thumbnail_url || '');
      if (!url) continue;
      items.push({
        id: String(item.id),
        mediaType,
        url,
        permalink: item.permalink ? String(item.permalink) : undefined,
        caption: item.caption ? String(item.caption) : undefined,
      });
    }
    return items;
  }
}
