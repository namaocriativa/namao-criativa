import { ForbiddenException } from '@nestjs/common';
import {
  allowedOriginsForCookie,
  assertCookieOrigin,
  requestOrigin,
} from './cookie-origin';
import { CLIENT_TOKEN_COOKIE, STUDIO_TOKEN_COOKIE } from './roles';
import {
  authCookieOptions,
  extractJwtFromRequest,
  inspectJwtFromRequest,
  readCookie,
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

  it('marca Secure com X-Forwarded-Proto https', () => {
    const options = authCookieOptions({
      headers: { 'x-forwarded-proto': 'https, http' },
    });
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
  });
});

describe('cookie-origin', () => {
  const studioEnv = {
    studioUrl: 'https://studio.namaocriativa.com.br',
    publicUrl: 'https://namaocriativa.com.br',
  };

  it('lista origens do studio', () => {
    expect(
      allowedOriginsForCookie('studio-cookie', studioEnv),
    ).toEqual(
      expect.arrayContaining([
        'https://studio.namaocriativa.com.br',
        'http://localhost:5173',
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

  it('lê origin do Referer quando Origin falta', () => {
    expect(
      requestOrigin({
        headers: { referer: 'https://namaocriativa.com.br/dashboard.html' },
      }),
    ).toBe('https://namaocriativa.com.br');
  });
});
