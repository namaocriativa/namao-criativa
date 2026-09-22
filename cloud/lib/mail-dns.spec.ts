import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultDmarc,
  mergeSpfIncludes,
  RESEND_CNAME_RECORDS,
  RESEND_DKIM_TXT,
  unwrapTxt,
} from './mail-dns.js';

test('mergeSpfIncludes cria SPF Resend quando não existe', () => {
  assert.equal(
    mergeSpfIncludes(null, '_spf.resend.com'),
    'v=spf1 include:_spf.resend.com ~all',
  );
});

test('mergeSpfIncludes adiciona include sem apagar Google', () => {
  assert.equal(
    mergeSpfIncludes('v=spf1 include:_spf.google.com ~all', '_spf.resend.com'),
    'v=spf1 include:_spf.resend.com include:_spf.google.com ~all',
  );
});

test('mergeSpfIncludes é idempotente', () => {
  const value = 'v=spf1 include:_spf.resend.com include:_spf.google.com ~all';
  assert.equal(mergeSpfIncludes(value, '_spf.resend.com'), value);
});

test('unwrapTxt remove aspas do Cloudflare', () => {
  assert.equal(unwrapTxt('"p=abc"'), 'p=abc');
});

test('DKIM e CNAMEs Resend estão no formato esperado', () => {
  assert.match(RESEND_DKIM_TXT, /^p=MIGf/);
  assert.equal(RESEND_CNAME_RECORDS[0]?.name, 'rsend');
  assert.equal(RESEND_CNAME_RECORDS[1]?.name, 'send');
  assert.equal(defaultDmarc('contato@namaocriativa.com.br'),
    'v=DMARC1; p=quarantine; rua=mailto:contato@namaocriativa.com.br; fo=1');
});
