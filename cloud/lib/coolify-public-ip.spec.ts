import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveCoolifyPublicIp,
  sslipPublicIpv4,
} from './coolify-public-ip.js';

test('sslipPublicIpv4 reads Coolify wildcard hosts', () => {
  assert.equal(
    sslipPublicIpv4('http://g1t47wiunk50nz7l99k4djjj.169.58.59.253.sslip.io'),
    '169.58.59.253',
  );
  assert.equal(sslipPublicIpv4('namao.10.0.0.1.sslip.io'), '10.0.0.1');
  assert.equal(sslipPublicIpv4('https://api.namaocriativa.com.br'), null);
  assert.equal(sslipPublicIpv4(''), null);
});

test('resolveCoolifyPublicIp prefers explicit env IP', () => {
  assert.equal(
    resolveCoolifyPublicIp({
      envIp: '1.2.3.4',
      appFqdn: 'x.9.9.9.9.sslip.io',
    }),
    '1.2.3.4',
  );
  assert.equal(
    resolveCoolifyPublicIp({
      envIp: '  ',
      appFqdn: 'x.9.9.9.9.sslip.io',
    }),
    '9.9.9.9',
  );
});
