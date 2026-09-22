import assert from 'node:assert/strict';
import test from 'node:test';
import {
  headersForStudioApiProxy,
  isHtmlNavigation,
  isUnauthenticatedApiAllowed,
  studioProxyStatus,
} from './proxy-policy';

test('isHtmlNavigation ignora fetch/XHR mesmo com Accept text/html', () => {
  const nav = {
    method: 'GET',
    headers: {
      get(name: string) {
        if (name === 'accept') return 'text/html,application/xhtml+xml';
        if (name === 'sec-fetch-dest') return 'document';
        return null;
      },
    },
  };
  const xhr = {
    method: 'GET',
    headers: {
      get(name: string) {
        if (name === 'accept') return 'text/html,application/xhtml+xml,*/*;q=0.8';
        if (name === 'sec-fetch-dest') return 'empty';
        return null;
      },
    },
  };
  assert.equal(isHtmlNavigation(nav), true);
  assert.equal(isHtmlNavigation(xhr), false);
});

test('headersForStudioApiProxy remove Accept-Encoding e headers hop-by-hop', () => {
  const headers = headersForStudioApiProxy(
    {
      headers: new Headers({
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        cookie: 'namao_studio_token=abc',
        host: 'studio.namaocriativa.com.br',
        origin: 'https://studio.namaocriativa.com.br',
        'cf-ray': 'abc',
      }),
    },
    'https://studio.namaocriativa.com.br',
  );
  assert.equal(headers.get('accept-encoding'), null);
  assert.equal(headers.get('host'), null);
  assert.equal(headers.get('cf-ray'), null);
  assert.equal(headers.get('cookie'), 'namao_studio_token=abc');
  assert.equal(headers.get('origin'), 'https://studio.namaocriativa.com.br');
});

test('studioProxyStatus não deixa 502/504 vazar para a página HTML da Cloudflare', () => {
  assert.equal(studioProxyStatus(200), 200);
  assert.equal(studioProxyStatus(400), 400);
  assert.equal(studioProxyStatus(401), 401);
  assert.equal(studioProxyStatus(502), 400);
  assert.equal(studioProxyStatus(504), 400);
  assert.equal(studioProxyStatus(503), 400);
});

test('mídia pública do calendário não exige cookie do studio', () => {
  assert.equal(
    isUnauthenticatedApiAllowed('GET', '/public/calendar-assets/abc'),
    true,
  );
  assert.equal(isUnauthenticatedApiAllowed('GET', '/calendar/posts'), false);
});
