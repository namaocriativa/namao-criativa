import {
  isPreviewOrigin,
  isPublicChatPath,
  originAllowedForLead,
  staticCorsOrigins,
} from './cors-policy';

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

  it('aceita www como gêmeo de NAMAO_PUBLIC_URL', () => {
    const prev = process.env.NAMAO_PUBLIC_URL;
    process.env.NAMAO_PUBLIC_URL = 'https://namaocriativa.com.br';
    try {
      expect(staticCorsOrigins()).toEqual(
        expect.arrayContaining([
          'https://namaocriativa.com.br',
          'https://www.namaocriativa.com.br',
        ]),
      );
      expect(isPreviewOrigin('https://www.namaocriativa.com.br')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.NAMAO_PUBLIC_URL;
      else process.env.NAMAO_PUBLIC_URL = prev;
    }
  });

  it('em produção não libera loopback', () => {
    const prevPublic = process.env.NAMAO_PUBLIC_URL;
    const prevStudio = process.env.NAMAO_STUDIO_URL;
    process.env.NAMAO_PUBLIC_URL = 'https://namaocriativa.com.br';
    process.env.NAMAO_STUDIO_URL = 'https://studio.namaocriativa.com.br';
    try {
      expect(staticCorsOrigins('production')).not.toContain(
        'http://localhost:5173',
      );
      expect(isPreviewOrigin('http://localhost:5173', 'production')).toBe(
        false,
      );
      expect(
        isPreviewOrigin('https://namaocriativa.com.br', 'production'),
      ).toBe(true);
      expect(
        isPreviewOrigin('https://studio.namaocriativa.com.br', 'production'),
      ).toBe(true);
    } finally {
      if (prevPublic === undefined) delete process.env.NAMAO_PUBLIC_URL;
      else process.env.NAMAO_PUBLIC_URL = prevPublic;
      if (prevStudio === undefined) delete process.env.NAMAO_STUDIO_URL;
      else process.env.NAMAO_STUDIO_URL = prevStudio;
    }
  });

  it('reconhece só o prefixo /public/chat', () => {
    expect(isPublicChatPath('/public/chat')).toBe(true);
    expect(isPublicChatPath('/public/chat/session')).toBe(true);
    expect(isPublicChatPath('/public/chat/events?x=1')).toBe(true);
    expect(isPublicChatPath('/auth/login')).toBe(false);
    expect(isPublicChatPath('/public')).toBe(false);
    expect(isPublicChatPath('/public/chatbot')).toBe(false);
  });
});
