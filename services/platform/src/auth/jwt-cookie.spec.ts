import { ForbiddenException } from '@nestjs/common';
import {
  allowedOriginsForCookie,
  assertCookieOrigin,
  cookieSourceForOrigin,
  requestOrigin,
} from './cookie-origin';
import {
  ADMIN_TOKEN_COOKIE,
  CLIENT_TOKEN_COOKIE,
  STUDIO_TOKEN_COOKIE,
} from './roles';
import {
  authCookieOptions,
  extractJwtFromRequest,
  inspectJwtFromRequest,
  readCookie,
  THIRTY_DAYS_MS,
  WEEK_MS,
} from './jwt-cookie';

describe('jwt-cookie', () => {
  it('lê cookie do header cru', () => {
    const token = readCookie(
      { headers: { cookie: `${STUDIO_TOKEN_COOKIE}=abc.def.ghi; other=1` } },
      STUDIO_TOKEN_COOKIE,
    );
    expect(token).toBe('abc.def.ghi');
  });

  it('prefere Bearer ao cookie', () => {
    const token = extractJwtFromRequest({
      headers: {
        authorization: 'Bearer header-token',
        cookie: `${STUDIO_TOKEN_COOKIE}=cookie-token`,
      },
    });
    expect(token).toBe('header-token');
  });

  it('cai no cookie do studio quando não há Bearer', () => {
    const token = extractJwtFromRequest({
      headers: { cookie: `${STUDIO_TOKEN_COOKIE}=cookie-token` },
    });
    expect(token).toBe('cookie-token');
  });

  it('lê cookie do cliente', () => {
    const inspected = inspectJwtFromRequest({
      headers: { cookie: `${CLIENT_TOKEN_COOKIE}=client-token` },
    });
    expect(inspected).toEqual({
      token: 'client-token',
      source: 'client-cookie',
    });
  });

  it('Origin do admin não usa o cookie do studio', () => {
    const inspected = inspectJwtFromRequest({
      headers: {
        origin: 'http://localhost:5175',
        cookie: `${STUDIO_TOKEN_COOKIE}=studio-token; ${ADMIN_TOKEN_COOKIE}=admin-token`,
      },
    });
    expect(inspected).toEqual({
      token: 'admin-token',
      source: 'admin-cookie',
    });
    expect(
      inspectJwtFromRequest({
        headers: {
          origin: 'http://localhost:5175',
          cookie: `${STUDIO_TOKEN_COOKIE}=studio-token`,
        },
      }),
    ).toBeNull();
  });

  it('Origin do studio não usa o cookie do admin', () => {
    const inspected = inspectJwtFromRequest({
      headers: {
        origin: 'http://localhost:5173',
        cookie: `${STUDIO_TOKEN_COOKIE}=studio-token; ${ADMIN_TOKEN_COOKIE}=admin-token`,
      },
    });
    expect(inspected).toEqual({
      token: 'studio-token',
      source: 'studio-cookie',
    });
  });

  it('marca Secure com X-Forwarded-Proto https', () => {
    const options = authCookieOptions({
      headers: { 'x-forwarded-proto': 'https, http' },
    });
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.maxAge).toBe(WEEK_MS);
  });

  it('cookie persistente quando rememberMe é true', () => {
    const options = authCookieOptions({ headers: {} }, { rememberMe: true });
    expect(options.maxAge).toBe(THIRTY_DAYS_MS);
  });

  it('cookie de sessão quando rememberMe é false', () => {
    const options = authCookieOptions({ headers: {} }, { rememberMe: false });
    expect(options.maxAge).toBeUndefined();
  });
});

describe('cookie-origin', () => {
  const studioEnv = {
    studioUrl: 'https://studio.namaocriativa.com.br',
    publicUrl: 'https://namaocriativa.com.br',
  };

  it('lista origens do admin', () => {
    expect(
      allowedOriginsForCookie('admin-cookie', {
        adminUrl: 'https://admin.namaocriativa.com.br',
      }),
    ).toEqual(
      expect.arrayContaining([
        'https://admin.namaocriativa.com.br',
        'https://namao-admin.pages.dev',
        'http://localhost:5175',
      ]),
    );
    expect(cookieSourceForOrigin('http://localhost:5175')).toBe('admin-cookie');
    expect(cookieSourceForOrigin('http://localhost:5173')).toBe('studio-cookie');
  });

  it('lista origens do studio', () => {
    expect(allowedOriginsForCookie('studio-cookie', studioEnv)).toEqual(
      expect.arrayContaining([
        'https://studio.namaocriativa.com.br',
        'https://namao-studio.pages.dev',
        'http://localhost:5173',
      ]),
    );
  });

  it('aceita lista de origens no NAMAO_STUDIO_URL', () => {
    expect(
      allowedOriginsForCookie('studio-cookie', {
        studioUrl:
          'https://studio.namaocriativa.com.br, https://studio.example.dev',
      }),
    ).toEqual(
      expect.arrayContaining([
        'https://studio.namaocriativa.com.br',
        'https://studio.example.dev',
      ]),
    );
  });

  it('aceita Origin do studio em POST com cookie studio', () => {
    expect(() =>
      assertCookieOrigin(
        {
          method: 'POST',
          headers: { origin: 'https://studio.namaocriativa.com.br' },
        },
        'studio-cookie',
        studioEnv,
      ),
    ).not.toThrow();
  });

  it('rejeita Origin do website em POST com cookie studio', () => {
    expect(() =>
      assertCookieOrigin(
        {
          method: 'POST',
          headers: { origin: 'https://namaocriativa.com.br' },
        },
        'studio-cookie',
        studioEnv,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejeita Origin vazio em mutação cookie-auth', () => {
    expect(() =>
      assertCookieOrigin(
        { method: 'POST', headers: {} },
        'client-cookie',
        studioEnv,
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejeita GET do website com cookie studio', () => {
    expect(() =>
      assertCookieOrigin(
        {
          method: 'GET',
          headers: { origin: 'https://namaocriativa.com.br' },
        },
        'studio-cookie',
        studioEnv,
      ),
    ).toThrow(ForbiddenException);
  });

  it('ignora Bearer e GET sem Origin', () => {
    expect(() =>
      assertCookieOrigin(
        { method: 'POST', headers: {} },
        'bearer',
        studioEnv,
      ),
    ).not.toThrow();
    expect(() =>
      assertCookieOrigin(
        { method: 'GET', headers: {} },
        'studio-cookie',
        studioEnv,
      ),
    ).not.toThrow();
  });

  it('aceita www do website em POST com cookie do cliente', () => {
    expect(() =>
      assertCookieOrigin(
        {
          method: 'POST',
          headers: { origin: 'https://www.namaocriativa.com.br' },
        },
        'client-cookie',
        studioEnv,
      ),
    ).not.toThrow();
  });

  it('em desenvolvimento aceita localhost em qualquer porta', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
    expect(() =>
      assertCookieOrigin(
        {
          method: 'POST',
          headers: { origin: 'http://localhost:5175' },
        },
        'studio-cookie',
        studioEnv,
      ),
    ).not.toThrow();
  });

  it('em produção aceita o pages.dev do studio e rejeita o do website', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        assertCookieOrigin(
          {
            method: 'GET',
            headers: { origin: 'https://namao-studio.pages.dev' },
          },
          'studio-cookie',
          studioEnv,
        ),
      ).not.toThrow();
      expect(() =>
        assertCookieOrigin(
          {
            method: 'GET',
            headers: {
              origin: 'https://preview.namao-studio.pages.dev',
            },
          },
          'studio-cookie',
          studioEnv,
        ),
      ).not.toThrow();
      expect(() =>
        assertCookieOrigin(
          {
            method: 'GET',
            headers: { origin: 'https://namao-website.pages.dev' },
          },
          'studio-cookie',
          studioEnv,
        ),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertCookieOrigin(
          {
            method: 'GET',
            headers: { origin: 'https://evil.pages.dev' },
          },
          'studio-cookie',
          studioEnv,
        ),
      ).toThrow(ForbiddenException);
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });

  it('aceita o domínio canônico do studio mesmo sem NAMAO_STUDIO_URL', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        assertCookieOrigin(
          {
            method: 'GET',
            headers: { origin: 'https://studio.namaocriativa.com.br' },
          },
          'studio-cookie',
          { studioUrl: null, publicUrl: 'https://namaocriativa.com.br' },
        ),
      ).not.toThrow();
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });

  it('lê origin do Referer quando Origin falta', () => {
    expect(
      requestOrigin({
        headers: { referer: 'https://namaocriativa.com.br/dashboard.html' },
      }),
    ).toBe('https://namaocriativa.com.br');
  });
});
