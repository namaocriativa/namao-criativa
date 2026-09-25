import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalWebsiteRedirect,
  isApiPath,
  isHtmlNavigation,
  isSameWebsiteOrigin,
  resolveWebsiteApiOrigin,
} from './proxy-policy.js';

test('isApiPath covers platform routes without swallowing pages', () => {
  assert.equal(isApiPath('/auth/login'), true);
  assert.equal(isApiPath('/auth'), true);
  assert.equal(isApiPath('/namao-chat'), true);
  assert.equal(isApiPath('/namao-chat/session'), true);
  assert.equal(isApiPath('/dashboard/analytics'), true);
  assert.equal(isApiPath('/proposal'), true);
  assert.equal(isApiPath('/proposal/accept'), true);
  assert.equal(isApiPath('/dashboard/analytics?range=7d'.split('?')[0]), true);
  assert.equal(isApiPath('/invite-requests'), true);
  assert.equal(isApiPath('/login'), false);
  assert.equal(isApiPath('/dashboard.html'), false);
  assert.equal(isApiPath('/dashboard'), false);
});

test('isHtmlNavigation only treats GET/HEAD Accept: text/html as navigation', () => {
  const htmlGet = {
    method: 'GET',
    headers: { get: () => 'text/html,application/xhtml+xml' },
  };
  const fetchGet = {
    method: 'GET',
    headers: { get: () => '*/*' },
  };
  const post = {
    method: 'POST',
    headers: { get: () => 'text/html' },
  };
  assert.equal(isHtmlNavigation(htmlGet), true);
  assert.equal(isHtmlNavigation(fetchGet), false);
  assert.equal(isHtmlNavigation(post), false);
});

test('isSameWebsiteOrigin allows missing Origin and www/apex twins', () => {
  const url = 'https://namaocriativa.com.br/auth/login';
  assert.equal(isSameWebsiteOrigin(url, null), true);
  assert.equal(isSameWebsiteOrigin(url, 'https://namaocriativa.com.br'), true);
  assert.equal(
    isSameWebsiteOrigin(url, 'https://www.namaocriativa.com.br'),
    true,
  );
  assert.equal(
    isSameWebsiteOrigin(
      'https://www.namaocriativa.com.br/namao-chat/session',
      'https://namaocriativa.com.br',
    ),
    true,
  );
  assert.equal(
    isSameWebsiteOrigin(url, 'https://studio.namaocriativa.com.br'),
    false,
  );
});

test('canonicalWebsiteRedirect sends www to the apex host', () => {
  assert.equal(
    canonicalWebsiteRedirect('https://www.namaocriativa.com.br/login'),
    'https://namaocriativa.com.br/login',
  );
  assert.equal(
    canonicalWebsiteRedirect(
      'https://www.namaocriativa.com.br/faq?ref=ig#contato',
    ),
    'https://namaocriativa.com.br/faq?ref=ig#contato',
  );
  assert.equal(
    canonicalWebsiteRedirect('https://namaocriativa.com.br/sobre'),
    null,
  );
  assert.equal(
    canonicalWebsiteRedirect('https://namao-website.pages.dev/'),
    null,
  );
  assert.equal(canonicalWebsiteRedirect('http://localhost:5174/'), null);
  assert.equal(canonicalWebsiteRedirect('not-a-url'), null);
});

test('resolveWebsiteApiOrigin falls back to the public API', () => {
  assert.equal(
    resolveWebsiteApiOrigin(''),
    'https://api.namaocriativa.com.br',
  );
  assert.equal(
    resolveWebsiteApiOrigin(' https://api.example.com/ '),
    'https://api.example.com',
  );
});
