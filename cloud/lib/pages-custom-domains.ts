import {
  CloudflareClient,
  CloudflareError,
} from './cloudflare-client.js';
import { log } from './config.js';

type PagesDomain = {
  id?: string;
  name?: string;
  status?: string;
};

type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
};

type Zone = {
  id: string;
  name: string;
  status?: string;
};

export function parseHostname(apex: string): string {
  return apex
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
}

export function extraHostnames(
  apex: string,
  opts?: { includeWww?: boolean },
): string[] {
  const host = parseHostname(apex);
  if (!host) return [];
  const includeWww = opts?.includeWww !== false;
  if (host.startsWith('www.')) {
    return includeWww ? [host, host.slice(4)] : [host];
  }
  return includeWww ? [host, `www.${host}`] : [host];
}

export async function findZoneForHost(
  client: CloudflareClient,
  hostname: string,
): Promise<Zone | null> {
  const labels = hostname.split('.').filter(Boolean);
  for (let i = 0; i < labels.length - 1; i += 1) {
    const name = labels.slice(i).join('.');
    try {
      const listed = await client.get<Zone[]>(
        `/zones?name=${encodeURIComponent(name)}`,
      );
      const match = (Array.isArray(listed) ? listed : []).find(
        (zone) => zone.name === name,
      );
      if (match) return match;
    } catch (err) {
      const denied =
        err instanceof CloudflareError &&
        (err.status === 403 || err.status === 401);
      if (denied) {
        log(
          'dns',
          'token cannot list zones (add Zone.Zone Read + Zone.DNS Edit)',
        );
        return null;
      }
      throw err;
    }
  }
  return null;
}

async function ensureCname(opts: {
  client: CloudflareClient;
  hostname: string;
  target: string;
  step: string;
}): Promise<void> {
  const { client, hostname, step } = opts;
  const target = opts.target.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const zone = await findZoneForHost(client, hostname);
  if (!zone) {
    log(
      step,
      `DNS: zona de ${hostname} não está nesta conta (ou o token não lê DNS). CNAME ${hostname} → ${target} (proxied)`,
    );
    return;
  }

  let listed: DnsRecord[];
  try {
    listed = await client.get<DnsRecord[]>(
      `/zones/${zone.id}/dns_records?name=${encodeURIComponent(hostname)}`,
    );
  } catch (err) {
    const denied =
      err instanceof CloudflareError &&
      (err.status === 403 || err.status === 401);
    if (denied) {
      log(
        step,
        `DNS 403 em ${hostname}: o token lista a zona, mas não edita records. Em API Tokens → Edit, adicione Zone → DNS → Edit (não só Zone Read) e Zone Resources → Include → ${zone.name}`,
      );
      return;
    }
    throw err;
  }
  const records = Array.isArray(listed) ? listed : [];
  const cname = records.find((record) => record.type === 'CNAME');
  if (cname) {
    const same =
      cname.content.replace(/\.$/, '') === target && cname.proxied !== false;
    if (same) {
      log(step, `DNS CNAME ${hostname} already → ${target}`);
      return;
    }
    await client.put(`/zones/${zone.id}/dns_records/${cname.id}`, {
      type: 'CNAME',
      name: hostname,
      content: target,
      proxied: true,
      ttl: 1,
    });
    log(step, `DNS CNAME ${hostname} updated → ${target}`);
    return;
  }

  for (const record of records.filter(
    (item) => item.type === 'A' || item.type === 'AAAA',
  )) {
    await client.delete(`/zones/${zone.id}/dns_records/${record.id}`);
    log(step, `DNS removed ${record.type} ${hostname}`);
  }

  await client.post(`/zones/${zone.id}/dns_records`, {
    type: 'CNAME',
    name: hostname,
    content: target,
    proxied: true,
    ttl: 1,
  });
  log(step, `DNS CNAME ${hostname} created → ${target}`);
}

/** A record for Coolify origins. DNS-only so Let's Encrypt HTTP-01 can reach Traefik. */
export async function ensureAddressRecord(opts: {
  client: CloudflareClient;
  hostname: string;
  ip: string;
  proxied?: boolean;
  step: string;
}): Promise<void> {
  const { client, hostname, ip, step } = opts;
  const proxied = opts.proxied === true;
  const zone = await findZoneForHost(client, hostname);
  if (!zone) {
    log(
      step,
      `DNS: zona de ${hostname} não está nesta conta (ou o token não lê DNS). A ${hostname} → ${ip}`,
    );
    return;
  }

  let listed: DnsRecord[];
  try {
    listed = await client.get<DnsRecord[]>(
      `/zones/${zone.id}/dns_records?name=${encodeURIComponent(hostname)}`,
    );
  } catch (err) {
    const denied =
      err instanceof CloudflareError &&
      (err.status === 403 || err.status === 401);
    if (denied) {
      log(
        step,
        `DNS 403 em ${hostname}: o token lista a zona, mas não edita records. Em API Tokens → Edit, adicione Zone → DNS → Edit e Zone Resources → Include → ${zone.name}`,
      );
      return;
    }
    throw err;
  }

  const records = Array.isArray(listed) ? listed : [];
  for (const record of records.filter((item) => item.type === 'CNAME')) {
    await client.delete(`/zones/${zone.id}/dns_records/${record.id}`);
    log(step, `DNS removed CNAME ${hostname}`);
  }

  const address = records.find((record) => record.type === 'A');
  if (address) {
    const same = address.content === ip && Boolean(address.proxied) === proxied;
    if (same) {
      log(step, `DNS A ${hostname} already → ${ip}`);
      return;
    }
    await client.put(`/zones/${zone.id}/dns_records/${address.id}`, {
      type: 'A',
      name: hostname,
      content: ip,
      proxied,
      ttl: 1,
    });
    log(step, `DNS A ${hostname} updated → ${ip} (proxied=${proxied})`);
    return;
  }

  await client.post(`/zones/${zone.id}/dns_records`, {
    type: 'A',
    name: hostname,
    content: ip,
    proxied,
    ttl: 1,
  });
  log(step, `DNS A ${hostname} created → ${ip} (proxied=${proxied})`);
}

export async function attachPagesDomains(opts: {
  client: CloudflareClient;
  projectPath: string;
  hostnames: string[];
  pagesDev: string;
  step: string;
  dryRun: boolean;
}): Promise<void> {
  const { client, projectPath, hostnames, pagesDev, step, dryRun } = opts;
  if (!hostnames.length) {
    log(step, 'no custom domain');
    return;
  }
  if (dryRun) {
    log(step, `would ensure domains + DNS: ${hostnames.join(', ')}`);
    return;
  }

  const listed = await client.get<PagesDomain[]>(`${projectPath}/domains`);
  const have = new Set(
    (Array.isArray(listed) ? listed : [])
      .map((domain) => domain.name)
      .filter(Boolean),
  );

  for (const host of hostnames) {
    if (have.has(host)) {
      log(step, `domain ${host} already attached`);
    } else {
      try {
        await client.post(`${projectPath}/domains`, { name: host });
        log(
          step,
          `domain ${host} attached — CNAME automático se a zona for desta conta`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(step, `WARN: could not attach ${host}: ${msg}`);
      }
    }

    try {
      await ensureCname({
        client,
        hostname: host,
        target: pagesDev,
        step,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(step, `WARN: DNS ${host}: ${msg}`);
    }
  }
}
