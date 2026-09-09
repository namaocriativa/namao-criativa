import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { injectGtmIntoHtml, normalizeGtmContainerId } from './gtm-snippet';
import {
  collectDistFiles,
  sha1Buffer,
  type DistFile,
  vercelProjectName,
} from './vercel-files';

const VERCEL_API = 'https://api.vercel.com';

export type VercelPublishResult = {
  url: string;
  deploymentId: string;
  projectId: string;
  projectName: string;
};

type DeploymentPayload = {
  id?: string;
  url?: string;
  alias?: string[];
  readyState?: string;
  projectId?: string;
  name?: string;
  error?: { message?: string };
};

@Injectable()
export class VercelService {
  private readonly logger = new Logger(VercelService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly owners: OwnerLookup,
  ) {}

  get token(): string {
    return this.config.get<string>('VERCEL_TOKEN')?.trim() || '';
  }

  get configured(): boolean {
    return Boolean(this.token);
  }

  get teamId(): string {
    return (
      this.config.get<string>('VERCEL_TEAM_ID')?.trim() ||
      this.config.get<string>('VERCEL_ORG_ID')?.trim() ||
      ''
    );
  }

  get autoDeploy(): boolean {
    const raw = this.config.get<string>('VERCEL_AUTO_DEPLOY')?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    return this.configured;
  }

  status() {
    return {
      configured: this.configured,
      autoDeploy: this.autoDeploy,
      team: Boolean(this.teamId),
    };
  }

  async publishProject(opts: {
    leadId: string;
    slug: string;
    projectDir: string;
    existingProjectId?: string | null;
  }): Promise<VercelPublishResult> {
    if (!this.configured) {
      throw new BadRequestException(
        'VERCEL_TOKEN não configurado. Crie um token em vercel.com/account/tokens e coloque no .env.',
      );
    }
    const distDir = path.join(opts.projectDir, 'dist');
    const files = await this.withGtmInjection(
      await collectDistFiles(distDir),
      distDir,
      opts,
    );
    if (!files.some((item) => item.file === 'index.html')) {
      throw new BadRequestException(
        'dist/index.html ausente. Gere o site e aguarde o build antes de publicar.',
      );
    }

    const projectName = vercelProjectName(opts.slug);
    await this.uploadFiles(files);

    const created = await this.createDeployment({
      name: projectName,
      projectId: opts.existingProjectId,
      files: files.map((item) => ({
        file: item.file,
        sha: item.sha,
        size: item.size,
      })),
    });
    const ready = await this.waitUntilReady(created.id || '');
    const url = publicUrl(ready);
    const projectId = ready.projectId || opts.existingProjectId || '';
    const deploymentId = ready.id || created.id || '';
    if (!url) {
      throw new ServiceUnavailableException('Vercel não retornou URL do deploy');
    }

    await this.owners.update(opts.leadId, {
      publishedOrigin: url,
      vercelProjectId: projectId || null,
      vercelDeploymentId: deploymentId || null,
    });

    return { url, deploymentId, projectId, projectName };
  }

  private async withGtmInjection(
    files: DistFile[],
    distDir: string,
    opts: { leadId: string; slug: string },
  ): Promise<DistFile[]> {
    const containerId = normalizeGtmContainerId(
      this.config.get<string>('GTM_CONTAINER_ID'),
    );
    if (!containerId) return files;

    const index = files.find((item) => item.file === 'index.html');
    if (!index) return files;

    const lead = await this.owners.findProfile(opts.leadId);
    const html = injectGtmIntoHtml(index.data.toString('utf8'), {
      containerId,
      leadId: opts.leadId,
      siteId: lead?.publicSiteId,
      landingSlug: lead?.landingSlug || opts.slug,
    });
    const data = Buffer.from(html, 'utf8');
    if (data.equals(index.data)) return files;

    index.data = data;
    index.sha = sha1Buffer(data);
    index.size = data.byteLength;
    try {
      await fs.writeFile(path.join(distDir, 'index.html'), data);
    } catch (error) {
      this.logger.warn(
        `Não foi possível gravar dist/index.html com GTM: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return files;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  private teamQuery(): { teamId?: string } {
    return this.teamId ? { teamId: this.teamId } : {};
  }

  private async uploadFiles(files: DistFile[]) {
    const concurrency = 4;
    let index = 0;
    const run = async () => {
      while (index < files.length) {
        const current = files[index];
        index += 1;
        await this.uploadFile(current);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, files.length) }, () => run()),
    );
  }

  private async uploadFile(file: DistFile) {
    try {
      await axios.post(`${VERCEL_API}/v2/files`, file.data, {
        headers: {
          ...this.headers(),
          'Content-Type': 'application/octet-stream',
          'x-vercel-digest': file.sha,
          'Content-Length': String(file.size),
        },
        params: this.teamQuery(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60_000,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        return;
      }
      throw new Error(`Upload ${file.file}: ${vercelError(error)}`);
    }
  }

  private async createDeployment(opts: {
    name: string;
    projectId?: string | null;
    files: Array<{ file: string; sha: string; size: number }>;
  }): Promise<DeploymentPayload> {
    try {
      const res = await axios.post<DeploymentPayload>(
        `${VERCEL_API}/v13/deployments`,
        {
          name: opts.name,
          files: opts.files,
          target: 'production',
          ...(opts.projectId ? { project: opts.projectId } : {}),
          projectSettings: {
            framework: null,
          },
          routes: [
            { handle: 'filesystem' },
            { src: '/(.*)', dest: '/index.html' },
          ],
        },
        {
          headers: {
            ...this.headers(),
            'Content-Type': 'application/json',
          },
          params: this.teamQuery(),
          timeout: 60_000,
        },
      );
      return res.data;
    } catch (error) {
      throw new Error(`Deploy Vercel falhou: ${vercelError(error)}`);
    }
  }

  private async waitUntilReady(
    deploymentId: string,
    timeoutMs = 120_000,
  ): Promise<DeploymentPayload> {
    if (!deploymentId) {
      throw new Error('Vercel não retornou id do deployment');
    }
    const started = Date.now();
    let last: DeploymentPayload = { id: deploymentId };
    while (Date.now() - started < timeoutMs) {
      const res = await axios.get<DeploymentPayload>(
        `${VERCEL_API}/v13/deployments/${encodeURIComponent(deploymentId)}`,
        {
          headers: this.headers(),
          params: this.teamQuery(),
          timeout: 15_000,
        },
      );
      last = res.data;
      const state = String(last.readyState || '').toUpperCase();
      if (state === 'READY') return last;
      if (state === 'ERROR' || state === 'CANCELED') {
        throw new Error(
          last.error?.message || `Deploy Vercel ${state.toLowerCase()}`,
        );
      }
      await sleep(2000);
    }
    throw new Error(
      `Timeout esperando deploy Vercel (${last.readyState || 'desconhecido'})`,
    );
  }
}

function publicUrl(deployment: DeploymentPayload): string {
  const alias = Array.isArray(deployment.alias) ? deployment.alias[0] : '';
  const host = String(alias || deployment.url || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  return host ? `https://${host}` : '';
}

function vercelError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return (
      data?.error?.message ||
      data?.message ||
      error.message ||
      `HTTP ${error.response?.status || '?'}`
    );
  }
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
