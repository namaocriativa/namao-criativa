import { isPreviewOrigin, originAllowedForLead, staticCorsOrigins } from './cors-policy';

describe('cors-policy', () => {
  it('libera preview Nest e origens locais', () => {
    expect(isPreviewOrigin(undefined)).toBe(true);
    expect(isPreviewOrigin('http://localhost:3000')).toBe(true);
    expect(isPreviewOrigin('http://localhost:5173')).toBe(true);
    expect(isPreviewOrigin('http://localhost:4000')).toBe(true);
    expect(isPreviewOrigin('http://127.0.0.1:4000')).toBe(true);
  });

  it('exige publishedOrigin compatível quando definido', () => {
    expect(
      originAllowedForLead('https://evil.example', 'https://foo.vercel.app'),
    ).toBe(false);
    expect(
      originAllowedForLead('https://foo.vercel.app', 'https://foo.vercel.app'),
    ).toBe(true);
    expect(
      originAllowedForLead('http://localhost:3000', 'https://foo.vercel.app'),
    ).toBe(true);
  });

  it('inclui NAMAO_STUDIO_URL nas origens estáticas', () => {
    const prev = process.env.NAMAO_STUDIO_URL;
    process.env.NAMAO_STUDIO_URL = 'https://studio.example.com';
    try {
      expect(staticCorsOrigins()).toContain('https://studio.example.com');
      expect(isPreviewOrigin('https://studio.example.com')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.NAMAO_STUDIO_URL;
      else process.env.NAMAO_STUDIO_URL = prev;
    }
  });
});
