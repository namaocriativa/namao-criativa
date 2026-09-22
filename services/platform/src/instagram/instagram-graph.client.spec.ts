import {
  INSTAGRAM_OAUTH_SCOPES,
  InstagramGraphClient,
} from './instagram-graph.client';

describe('InstagramGraphClient', () => {
  it('inclui permissão de publicação no OAuth', () => {
    expect(INSTAGRAM_OAUTH_SCOPES).toContain('instagram_content_publish');
    const client = new InstagramGraphClient({
      get: (key: string) => {
        if (key === 'META_APP_ID') return 'app';
        if (key === 'META_APP_SECRET') return 'secret';
        if (key === 'META_REDIRECT_URI') return 'http://localhost:4000/cb';
        if (key === 'META_GRAPH_VERSION') return 'v21.0';
        return undefined;
      },
    } as never);
    const url = client.oauthUrl('state-1');
    expect(url).toContain('instagram_content_publish');
  });
});
