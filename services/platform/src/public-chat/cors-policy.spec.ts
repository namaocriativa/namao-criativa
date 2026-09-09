import { isPreviewOrigin, originAllowedForLead } from './cors-policy';

describe('cors-policy', () => {
  it('libera preview Nest e origens locais', () => {
    expect(isPreviewOrigin(undefined)).toBe(true);
    expect(isPreviewOrigin('http://localhost:3000')).toBe(true);
    expect(isPreviewOrigin('http://localhost:5173')).toBe(true);
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
});
