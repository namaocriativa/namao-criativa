import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import type { PagesDomainApi } from './pages-domain';

const CF_API = 'https://api.cloudflare.com/client/v4';

type CfEnvelope<T> = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: T;
};

type PagesDomain = { name?: string };
type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
};
type Zone = { id: string; name: string };

@Injectable()
export class CloudflarePagesClient implements PagesDomainApi {
  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(this.accountId() && this.token());
  }

  requireConfigured() {
    if (!this.configured()) {
      throw new ServiceUnavailableException(
        'CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID são necessários para sincronizar o domínio no Pages.',
      );
    }
  }

  async listDomains(project: string): Promise<string[]> {
    return (await this.listDomainDetails(project)).map((item) => item.name);
  }

  async listDomainDetails(
    project: string,
  ): Promise<Array<{ name: string; status: string }>> {
    const listed = await this.request<Array<PagesDomain & { status?: string }>>(
      'GET',
      this.projectPath(project, '/domains'),
    );
    return (Array.isArray(listed) ? listed : [])
      .map((item) => ({
        name: item.name || '',
        status: item.status || 'unknown',
      }))
      .filter((item) => item.name);
  }

  async attachDomain(project: string, hostname: string): Promise<void> {
    try {
      await this.request('POST', this.projectPath(project, '/domains'), {
        name: hostname,
      });
    } catch (error) {
      if (isAlreadyExists(error)) return;
      throw error;
    }
  }

  async detachDomain(project: string, hostname: string): Promise<void> {
    try {
      await this.request(
        'DELETE',
        this.projectPath(project, `/domains/${encodeURIComponent(hostname)}`),
      );
    } catch (error) {
      if (statusOf(error) === 404) return;
      throw error;
    }
  }

  async ensureCname(hostname: string, target: string): Promise<void> {
    const zone = await this.findZone(hostname);
    if (!zone) return;
    const listed = await this.request<DnsRecord[]>(
      'GET',
      `/zones/${zone.id}/dns_records?name=${encodeURIComponent(hostname)}`,
    );
    const records = Array.isArray(listed) ? listed : [];
    const dest = target.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const cname = records.find((record) => record.type === 'CNAME');
    if (cname) {
      const same =
        cname.content.replace(/\.$/, '') === dest && cname.proxied !== false;
      if (same) return;
      await this.request('PUT', `/zones/${zone.id}/dns_records/${cname.id}`, {
        type: 'CNAME',
        name: hostname,
        content: dest,
        proxied: true,
        ttl: 1,
      });
      return;
    }
    for (const record of records.filter(
      (item) => item.type === 'A' || item.type === 'AAAA',
    )) {
      await this.request('DELETE', `/zones/${zone.id}/dns_records/${record.id}`);
    }
    await this.request('POST', `/zones/${zone.id}/dns_records`, {
      type: 'CNAME',
      name: hostname,
      content: dest,
      proxied: true,
      ttl: 1,
    });
  }

  private async findZone(hostname: string): Promise<Zone | null> {
    const labels = hostname.split('.').filter(Boolean);
    for (let i = 0; i < labels.length - 1; i += 1) {
      const name = labels.slice(i).join('.');
      try {
        const listed = await this.request<Zone[]>(
          'GET',
          `/zones?name=${encodeURIComponent(name)}`,
        );
        const match = (Array.isArray(listed) ? listed : []).find(
          (zone) => zone.name === name,
        );
        if (match) return match;
      } catch (error) {
        const status = statusOf(error);
        if (status === 401 || status === 403) return null;
        throw error;
      }
    }
    return null;
  }

  private projectPath(project: string, suffix: string) {
    const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `/accounts/${this.accountId()}/pages/projects/${encodeURIComponent(project)}${s}`;
  }

  private accountId() {
    return this.config.get<string>('CLOUDFLARE_ACCOUNT_ID')?.trim() || '';
  }

  private token() {
    return this.config.get<string>('CLOUDFLARE_API_TOKEN')?.trim() || '';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    this.requireConfigured();
    try {
      const res = await axios.request<CfEnvelope<T>>({
        method,
        url: `${CF_API}${path}`,
        data: body,
        headers: {
          Authorization: `Bearer ${this.token()}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        timeout: 20_000,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const envelope = res.data;
      if (envelope && envelope.success === false) {
        throw new Error(cfMessage(envelope, `${method} ${path}`));
      }
      return (envelope?.result ?? envelope) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const status = statusOf(error);
      const msg =
        axios.isAxiosError(error) && error.response?.data
          ? cfMessage(error.response.data, error.message)
          : error instanceof Error
            ? error.message
            : `${method} ${path}`;
      const wrapped = new Error(msg);
      (wrapped as Error & { status?: number }).status = status ?? undefined;
      throw wrapped;
    }
  }
}

function cfMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const errors = (body as CfEnvelope<unknown>).errors;
  if (Array.isArray(errors) && errors[0]?.message) {
    return errors.map((item) => item.message).filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

function statusOf(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return (error as AxiosError).response?.status ?? null;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

function isAlreadyExists(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /already|exist/i.test(msg);
}
