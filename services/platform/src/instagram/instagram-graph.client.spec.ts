import axios from 'axios';
import {
  INSTAGRAM_OAUTH_SCOPES,
  InstagramGraphClient,
} from './instagram-graph.client';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;
const mockedPost = axios.post as jest.Mock;

describe('InstagramGraphClient', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  const client = () =>
    new InstagramGraphClient({
      get: (key: string) => {
        if (key === 'META_APP_ID') return 'app';
        if (key === 'META_APP_SECRET') return 'secret';
        if (key === 'META_REDIRECT_URI') return 'http://localhost:4000/cb';
        if (key === 'META_GRAPH_VERSION') return 'v21.0';
        return undefined;
      },
    } as never);

  it('autoriza no Instagram Login sem Facebook Page', () => {
    expect(INSTAGRAM_OAUTH_SCOPES).toEqual(['instagram_business_basic']);
    const url = client().oauthUrl('state-1');
    expect(url).toContain('https://www.instagram.com/oauth/authorize');
    expect(url).toContain('instagram_business_basic');
    expect(url).toContain('enable_fb_login=false');
    expect(url).not.toContain('facebook.com');
    expect(url).not.toContain('pages_show_list');
  });

  it('troca o code por token longo do Instagram', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { access_token: 'short', user_id: '1784' },
    });
    mockedGet.mockResolvedValueOnce({
      data: { access_token: 'long', expires_in: 3600 },
    });
    await expect(client().exchangeCode('abc#_')).resolves.toEqual({
      accessToken: 'long',
      expiresAt: expect.any(Date),
      igUserId: '1784',
    });
    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.instagram.com/oauth/access_token',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
  });

  it('lê o perfil Instagram direto, sem Páginas', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { user_id: 'ig-9', username: 'loja.ana', account_type: 'BUSINESS' },
    });
    await expect(client().findInstagramAccount('user-token')).resolves.toEqual({
      found: true,
      igUserId: 'ig-9',
      username: 'loja.ana',
    });
    expect(mockedGet.mock.calls[0][0]).toContain('graph.instagram.com');
  });

  it('lista mídia com timestamp e pagina', async () => {
    mockedGet
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: '1',
              media_type: 'IMAGE',
              media_url: 'https://img/1.jpg',
              caption: 'Olá #clinica',
              timestamp: '2026-09-20T10:00:00+0000',
            },
          ],
          paging: { cursors: { after: 'c2' } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: '2',
              media_type: 'VIDEO',
              thumbnail_url: 'https://img/2.jpg',
              caption: 'Reel',
              timestamp: '2026-09-10T10:00:00+0000',
            },
          ],
        },
      });
    const media = await client().listMedia({
      igUserId: 'ig-9',
      accessToken: 'tok',
      limit: 40,
    });
    expect(media).toHaveLength(2);
    expect(media[0].timestamp).toBe('2026-09-20T10:00:00+0000');
    expect(media[1].mediaType).toBe('VIDEO');
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('recusa conta pessoal', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { id: '1', username: 'ana', account_type: 'PERSONAL' },
    });
    await expect(client().findInstagramAccount('user-token')).resolves.toEqual({
      found: false,
      reason: 'not_professional',
    });
  });
});
