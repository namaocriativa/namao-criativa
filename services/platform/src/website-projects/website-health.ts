import axios from 'axios';
import https from 'https';
import { extraHostnames } from './pages-domain';

export type HealthStatus = 'ok' | 'warn' | 'down' | 'idle';

export type WebsiteHealthItem = {
  id: string;
  label: string;
  status: HealthStatus;
  url?: string;
  detail: string;
};

export type WebsiteHealth = {
  overall: HealthStatus;
  summary: string;
  pagesDev: string | null;
  domain: string | null;
  items: WebsiteHealthItem[];
};

export type HostProbe = {
  host: string;
  addresses: string[];
  http: { ok: boolean; status?: number; detail: string };
  attached?: { name: string; status: string } | null;
};

export function pagesDevHost(project: string | null | undefined): string | null {
  const name = project?.trim();
  return name ? `${name}.pages.dev` : null;
}

export function buildWebsiteHealth(input: {
  project: string | null;
  deployType: string | null;
  domain: string | null;
  pagesLive: { ok: boolean; status?: number; detail: string } | null;
  attached: Array<{ name: string; status: string }>;
  hosts: HostProbe[];
}): WebsiteHealth {
  const pagesDev = pagesDevHost(input.project);
  const items: WebsiteHealthItem[] = [];

  if (!input.project) {
    return {
      overall: 'idle',
      summary: 'Vincule um repositório para ver a saúde do site.',
      pagesDev: null,
      domain: input.domain,
      items,
    };
  }

  if (pagesDev && input.pagesLive) {
    items.push({
      id: 'pages-dev',
      label: pagesDev,
      url: `https://${pagesDev}`,
      status: input.pagesLive.ok ? 'ok' : 'down',
      detail: input.pagesLive.ok
        ? `No ar (${input.pagesLive.detail})`
        : input.pagesLive.detail,
    });
  }

  for (const host of input.hosts) {
    items.push(hostItem(host));
  }

  if (input.deployType === 'cloudflare' && input.domain && !input.hosts.length) {
    items.push({
      id: 'domain',
      label: input.domain,
      status: 'warn',
      detail: 'Domínio salvo, mas ainda sem checagem pública.',
    });
  }

  if (input.deployType === 'vercel') {
    items.push({
      id: 'vercel',
      label: 'Vercel',
      status: 'idle',
      detail: 'Saúde detalhada vale para sites no Cloudflare Pages.',
    });
  }

  const rollup = summarizeHealth(items, Boolean(input.domain));
  return {
    ...rollup,
    pagesDev,
    domain: input.domain,
    items,
  };
}

export function summarizeHealth(
  items: WebsiteHealthItem[],
  hasDomain: boolean,
): Pick<WebsiteHealth, 'overall' | 'summary'> {
  if (!items.length) {
    return { overall: 'idle', summary: 'Sem checagens ainda.' };
  }
  const pages = items.find((item) => item.id === 'pages-dev');
  const hosts = items.filter((item) => item.id.startsWith('host:'));
  const down = items.filter((item) => item.status === 'down');
  const warn = items.filter((item) => item.status === 'warn');

  if (pages?.status === 'ok' && (!hasDomain || hosts.every((item) => item.status === 'ok'))) {
    return {
      overall: 'ok',
      summary: hasDomain
        ? 'Site no ar no Pages e no domínio.'
        : 'Site no ar no Pages.',
    };
  }
  if (pages?.status === 'ok' && hasDomain) {
    const liveHost = hosts.find((item) => item.status === 'ok');
    if (liveHost) {
      return {
        overall: 'warn',
        summary: `Pages no ar. Use ${liveHost.label} se o apex ainda não abrir neste computador.`,
      };
    }
    return {
      overall: 'warn',
      summary: 'Pages no ar; o domínio ainda não responde em todos os hostnames.',
    };
  }
  if (down.length && !pages?.status) {
    return { overall: 'down', summary: 'Não foi possível checar o site.' };
  }
  if (pages?.status === 'down') {
    return { overall: 'down', summary: 'O projeto Pages não está respondendo.' };
  }
  if (warn.length) {
    return { overall: 'warn', summary: 'Site parcialmente no ar.' };
  }
  return { overall: 'idle', summary: 'Saúde incompleta.' };
}

function hostItem(host: HostProbe): WebsiteHealthItem {
  const url = `https://${host.host}`;
  const attached = host.attached;
  const pagesOk = !attached || attached.status === 'active';
  if (!host.addresses.length) {
    return {
      id: `host:${host.host}`,
      label: host.host,
      url,
      status: 'down',
      detail: attached
        ? `Anexado no Pages (${attached.status}), sem A/AAAA público.`
        : 'Sem DNS público. Confira nameserver e o CNAME na zona.',
    };
  }
  if (!host.http.ok) {
    return {
      id: `host:${host.host}`,
      label: host.host,
      url,
      status: 'warn',
      detail: pagesOk
        ? `DNS público ok. ${host.http.detail}. Pode ser cache do seu DNS.`
        : `Pages ${attached?.status || 'ausente'}. ${host.http.detail}`,
    };
  }
  return {
    id: `host:${host.host}`,
    label: host.host,
    url,
    status: pagesOk ? 'ok' : 'warn',
    detail: pagesOk
      ? `No ar (${host.http.detail})`
      : `HTTP ok, Pages ainda ${attached?.status || 'pendente'}.`,
  };
}

export async function lookupAddresses(hostname: string): Promise<string[]> {
  const answers = await Promise.all([
    dohAnswers(hostname, 'A'),
    dohAnswers(hostname, 'AAAA'),
  ]);
  return [...new Set(answers.flat())];
}

export async function probeHttps(
  hostname: string,
  addresses?: string[],
): Promise<{ ok: boolean; status?: number; detail: string }> {
  const ips = addresses ?? (await lookupAddresses(hostname));
  if (!ips.length) return { ok: false, detail: 'sem DNS público' };
  return httpsOnIp(hostname, ips[0]);
}

export function wantedHosts(domain: string | null | undefined): string[] {
  return extraHostnames(domain);
}

async function dohAnswers(name: string, type: 'A' | 'AAAA'): Promise<string[]> {
  try {
    const res = await axios.get<{
      Answer?: Array<{ type?: number; data?: string }>;
    }>('https://cloudflare-dns.com/dns-query', {
      params: { name, type },
      headers: { Accept: 'application/dns-json' },
      timeout: 8_000,
    });
    const want = type === 'A' ? 1 : 28;
    return (res.data.Answer || [])
      .filter((item) => item.type === want && typeof item.data === 'string')
      .map((item) => item.data as string);
  } catch {
    return [];
  }
}

function httpsOnIp(
  hostname: string,
  ip: string,
): Promise<{ ok: boolean; status?: number; detail: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: ip,
        servername: hostname,
        path: '/',
        method: 'GET',
        headers: { Host: hostname, 'User-Agent': 'namao-website-health' },
        timeout: 8_000,
      },
      (res) => {
        res.resume();
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 400,
          status,
          detail: `HTTP ${status}`,
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, detail: 'timeout HTTPS' });
    });
    req.on('error', (error) => {
      resolve({ ok: false, detail: error.message || 'falha HTTPS' });
    });
    req.end();
  });
}
