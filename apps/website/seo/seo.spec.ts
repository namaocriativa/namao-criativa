import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSeoHead } from './head.js';
import { matchSeoPage, SEO_PAGES } from './pages.js';
import { buildSitemapXml } from './sitemap.js';
import { gtmContainerId } from './site.js';

test('indexable pages have unique titles and descriptions', () => {
  const publicPages = SEO_PAGES.filter((page) => !page.noindex);
  const titles = new Set(publicPages.map((page) => page.title));
  const descriptions = new Set(publicPages.map((page) => page.description));
  assert.equal(titles.size, publicPages.length);
  assert.equal(descriptions.size, publicPages.length);
});

test('sitemap lists only indexable canonical URLs', () => {
  const xml = buildSitemapXml('2026-09-14');
  assert.match(xml, /https:\/\/namaocriativa\.com\.br\/servicos/);
  assert.match(xml, /https:\/\/namaocriativa\.com\.br\/faq/);
  assert.doesNotMatch(xml, /login/);
  assert.doesNotMatch(xml, /dashboard/);
  assert.doesNotMatch(xml, /conectar/);
  assert.doesNotMatch(xml, /register/);
  assert.doesNotMatch(xml, /proposta/);
});

test('home SEO head uses absolute OG and JSON-LD', () => {
  const home = matchSeoPage('index.html');
  assert.ok(home);
  const head = renderSeoHead(home, 'GTM-TEST1');
  assert.match(head, /rel="canonical" href="https:\/\/namaocriativa\.com\.br\/"/);
  assert.match(head, /og:image" content="https:\/\/namaocriativa\.com\.br\/og.jpg"/);
  assert.match(head, /application\/ld\+json/);
  assert.match(head, /Namão Criativa/);
  assert.match(head, /GTM-TEST1/);
  assert.doesNotMatch(head, /noindex/);
});

test('auth pages are noindex and skip GTM', () => {
  const login = matchSeoPage('/login.html');
  assert.ok(login);
  const head = renderSeoHead(login, 'GTM-TEST1');
  assert.match(head, /noindex, nofollow/);
  assert.doesNotMatch(head, /gtm\.js/);
});

test('matchSeoPage prefers nested index.html over the home file', () => {
  assert.equal(matchSeoPage('servicos/index.html')?.path, '/servicos');
  assert.equal(
    matchSeoPage('/Users/x/apps/website/servicos/marketing/index.html')?.path,
    '/servicos/marketing',
  );
  assert.equal(matchSeoPage('faq/index.html', '/faq/index.html')?.path, '/faq');
  assert.equal(matchSeoPage('index.html')?.path, '/');
  assert.equal(matchSeoPage('/Users/x/apps/website/index.html')?.path, '/');
  assert.equal(matchSeoPage('login.html')?.path, '/login.html');
});

test('gtmContainerId rejects invalid ids', () => {
  assert.equal(gtmContainerId('GTM-AAAA1'), 'GTM-AAAA1');
  assert.equal(gtmContainerId(' gtm-aaaa1 '), 'GTM-AAAA1');
  assert.equal(gtmContainerId('UA-1'), null);
  assert.equal(gtmContainerId(''), null);
});
