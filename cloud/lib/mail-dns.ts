import { CloudflareClient, CloudflareError } from './cloudflare-client.js';
import { log } from './config.js';
import { findZoneForHost, parseHostname } from './pages-custom-domains.js';

type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
};

/** DKIM TXT published in the Resend dashboard for namaocriativa.com.br. */
export const RESEND_DKIM_HOST = 'resend._domainkey';
export const RESEND_DKIM_TXT =
  'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDh4sdZkqVFOHeRCqRFCSNFLci/HiGEIf1y3vQLZk1WRoYEPksFyAABBUOwPoiRlesqYxStdM5b0fWHEJgygiynB9Q8IaYmIrl8ib+ll2hPJppakM0LKLNvUWQCPu70Ti99i1/9qcUq5ysKVr2LeEmaJHrlk13/lVSOfNahd+QuUQIDAQAB';

/** Resend bounce/inbound CNAMEs — must stay DNS-only (grey cloud). */
export const RESEND_CNAME_RECORDS = [
  { name: 'rsend', target: 'rsend-sae1.forge.rmta.net' },
  { name: 'send', target: 'send.forge.rmta.net' },
] as const;

export const RESEND_SPF_INCLUDE = '_spf.resend.com';

export function unwrapTxt(content: string): string {
  return content
    .replace(/^"+|"+$/g, '')
    .replace(/"\s+"/g, '')
    .trim();
}

export function mergeSpfIncludes(
  existing: string | null | undefined,
  include: string,
): string {
  const token = `include:${include}`;
  const trimmed = unwrapTxt(existing || '');
  if (!trimmed || !/^v=spf1\b/i.test(trimmed)) {
    return `v=spf1 ${token} ~all`;
  }
  if (trimmed.toLowerCase().includes(token.toLowerCase())) return trimmed;
  return trimmed.replace(/^v=spf1\s*/i, `v=spf1 ${token} `);
}

export function defaultDmarc(ruaEmail: string): string {
  return `v=DMARC1; p=quarantine; rua=mailto:${ruaEmail}; fo=1`;
}

function fqdn(host: string, apex: string): string {
  return `${host}.${apex}`;
}

export async function ensureMailDns(opts: {
  client: CloudflareClient;
  apex: string;
  dryRun?: boolean;
}): Promise<void> {
  const apex = parseHostname(opts.apex);
  if (!apex) {
    log('mail-dns', 'skip: WEBSITE_DOMAIN / website.domain is empty');
    return;
  }

  const zone = await findZoneForHost(opts.client, apex);
  if (!zone) {
    throw new Error(
      `zona de ${apex} não está nesta conta Cloudflare (ou o token não lê DNS)`,
    );
  }

  const rua = `contato@${apex}`;
  log(
    'mail-dns',
    opts.dryRun
      ? `would upsert Resend DNS on ${apex} (${zone.name})`
      : `upsert Resend DNS on ${apex} (${zone.name})`,
  );

  if (opts.dryRun) {
    log(
      'mail-dns',
      `TXT ${RESEND_DKIM_HOST}.${apex} + CNAME send/rsend (DNS-only) + SPF include:${RESEND_SPF_INCLUDE} + DMARC se ausente`,
    );
    return;
  }

  await upsertTxt({
    client: opts.client,
    zoneId: zone.id,
    name: fqdn(RESEND_DKIM_HOST, apex),
    content: RESEND_DKIM_TXT,
  });

  for (const record of RESEND_CNAME_RECORDS) {
    await upsertDnsOnlyCname({
      client: opts.client,
      zoneId: zone.id,
      name: fqdn(record.name, apex),
      target: record.target,
    });
  }

  await ensureSpfInclude({
    client: opts.client,
    zoneId: zone.id,
    name: apex,
    include: RESEND_SPF_INCLUDE,
  });

  await ensureDmarcIfMissing({
    client: opts.client,
    zoneId: zone.id,
    name: `_dmarc.${apex}`,
    content: defaultDmarc(rua),
  });
}

async function listByName(
  client: CloudflareClient,
  zoneId: string,
  name: string,
): Promise<DnsRecord[]> {
  const listed = await client.get<DnsRecord[]>(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&per_page=100`,
  );
  return Array.isArray(listed) ? listed : [];
}

async function upsertTxt(opts: {
  client: CloudflareClient;
  zoneId: string;
  name: string;
  content: string;
}): Promise<void> {
  const records = await listByName(opts.client, opts.zoneId, opts.name);
  const existing = records.find((record) => record.type === 'TXT');
  if (existing && unwrapTxt(existing.content) === unwrapTxt(opts.content)) {
    log('mail-dns', `TXT ${opts.name} already set`);
    return;
  }
  if (existing) {
    await opts.client.put(`/zones/${opts.zoneId}/dns_records/${existing.id}`, {
      type: 'TXT',
      name: opts.name,
      content: opts.content,
      ttl: 1,
    });
    log('mail-dns', `TXT ${opts.name} updated`);
    return;
  }
  await opts.client.post(`/zones/${opts.zoneId}/dns_records`, {
    type: 'TXT',
    name: opts.name,
    content: opts.content,
    ttl: 1,
  });
  log('mail-dns', `TXT ${opts.name} created`);
}

async function upsertDnsOnlyCname(opts: {
  client: CloudflareClient;
  zoneId: string;
  name: string;
  target: string;
}): Promise<void> {
  const target = opts.target.replace(/\.$/, '');
  const records = await listByName(opts.client, opts.zoneId, opts.name);
  for (const record of records.filter(
    (item) => item.type === 'A' || item.type === 'AAAA',
  )) {
    await opts.client.delete(`/zones/${opts.zoneId}/dns_records/${record.id}`);
    log('mail-dns', `removed ${record.type} ${opts.name}`);
  }

  const cname = records.find((record) => record.type === 'CNAME');
  if (cname) {
    const sameTarget = cname.content.replace(/\.$/, '') === target;
    const grey = cname.proxied === false;
    if (sameTarget && grey) {
      log('mail-dns', `CNAME ${opts.name} already → ${target} (DNS-only)`);
      return;
    }
    await opts.client.put(`/zones/${opts.zoneId}/dns_records/${cname.id}`, {
      type: 'CNAME',
      name: opts.name,
      content: target,
      proxied: false,
      ttl: 1,
    });
    log('mail-dns', `CNAME ${opts.name} updated → ${target} (DNS-only)`);
    return;
  }

  await opts.client.post(`/zones/${opts.zoneId}/dns_records`, {
    type: 'CNAME',
    name: opts.name,
    content: target,
    proxied: false,
    ttl: 1,
  });
  log('mail-dns', `CNAME ${opts.name} created → ${target} (DNS-only)`);
}

async function ensureSpfInclude(opts: {
  client: CloudflareClient;
  zoneId: string;
  name: string;
  include: string;
}): Promise<void> {
  const records = await listByName(opts.client, opts.zoneId, opts.name);
  const spfRecords = records.filter(
    (record) =>
      record.type === 'TXT' && /^v=spf1\b/i.test(unwrapTxt(record.content)),
  );
  if (spfRecords.length > 1) {
    log(
      'mail-dns',
      `WARN: ${opts.name} has ${spfRecords.length} SPF TXT records; updating the first`,
    );
  }
  const existing = spfRecords[0];
  const next = mergeSpfIncludes(existing?.content, opts.include);
  if (existing && unwrapTxt(existing.content) === unwrapTxt(next)) {
    log('mail-dns', `SPF ${opts.name} already includes ${opts.include}`);
    return;
  }
  if (existing) {
    await opts.client.put(`/zones/${opts.zoneId}/dns_records/${existing.id}`, {
      type: 'TXT',
      name: opts.name,
      content: next,
      ttl: 1,
    });
    log('mail-dns', `SPF ${opts.name} updated → ${next}`);
    return;
  }
  await opts.client.post(`/zones/${opts.zoneId}/dns_records`, {
    type: 'TXT',
    name: opts.name,
    content: next,
    ttl: 1,
  });
  log('mail-dns', `SPF ${opts.name} created → ${next}`);
}

async function ensureDmarcIfMissing(opts: {
  client: CloudflareClient;
  zoneId: string;
  name: string;
  content: string;
}): Promise<void> {
  const records = await listByName(opts.client, opts.zoneId, opts.name);
  const existing = records.find((record) => record.type === 'TXT');
  if (existing) {
    log('mail-dns', `DMARC ${opts.name} already set (left unchanged)`);
    return;
  }
  await opts.client.post(`/zones/${opts.zoneId}/dns_records`, {
    type: 'TXT',
    name: opts.name,
    content: opts.content,
    ttl: 1,
  });
  log('mail-dns', `DMARC ${opts.name} created → ${opts.content}`);
}

export function isMailDnsDenied(err: unknown): boolean {
  return (
    err instanceof CloudflareError &&
    (err.status === 401 || err.status === 403)
  );
}
