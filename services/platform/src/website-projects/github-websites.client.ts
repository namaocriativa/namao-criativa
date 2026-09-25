import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export type GithubWebsiteRepo = {
  id: string;
  title: string;
  repo: string;
  defaultBranch: string;
};

const GH_API = 'https://api.github.com';
const WORKFLOW_FILE = 'cd.yml';

export type WorkflowDispatchInputs = {
  deployType?: string;
  customDomain?: string;
  projectName?: string;
};

@Injectable()
export class GithubWebsitesClient {
  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(this.token());
  }

  async listRepos(): Promise<GithubWebsiteRepo[]> {
    const token = this.requireToken();
    const repos: GithubWebsiteRepo[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const data = await this.request<Array<Record<string, unknown>>>(
        'GET',
        '/user/repos',
        token,
        {
          params: {
            per_page: 100,
            page,
            affiliation: 'owner,collaborator,organization_member',
            sort: 'updated',
          },
        },
      );
      for (const item of data) {
        const fullName =
          typeof item.full_name === 'string' ? item.full_name : '';
        if (!fullName) continue;
        repos.push({
          id: fullName,
          title:
            typeof item.name === 'string' && item.name
              ? item.name
              : fullName,
          repo:
            typeof item.html_url === 'string'
              ? item.html_url
              : `https://github.com/${fullName}`,
          defaultBranch:
            typeof item.default_branch === 'string' && item.default_branch
              ? item.default_branch
              : 'main',
        });
      }
      if (data.length < 100) break;
    }
    return repos;
  }

  async getRepo(owner: string, name: string): Promise<GithubWebsiteRepo> {
    const token = this.requireToken();
    try {
      const item = await this.request<Record<string, unknown>>(
        'GET',
        `/repos/${owner}/${name}`,
        token,
      );
      const fullName =
        typeof item.full_name === 'string'
          ? item.full_name
          : `${owner}/${name}`;
      return {
        id: fullName,
        title: typeof item.name === 'string' && item.name ? item.name : name,
        repo:
          typeof item.html_url === 'string'
            ? item.html_url
            : `https://github.com/${fullName}`,
        defaultBranch:
          typeof item.default_branch === 'string' && item.default_branch
            ? item.default_branch
            : 'main',
      };
    } catch (error) {
      if (statusOf(error) === 404) {
        throw new BadRequestException('Repositório não encontrado no GitHub');
      }
      throw this.asGateway(error, 'Falha ao ler o repositório no GitHub');
    }
  }

  async dispatchWorkflow(
    owner: string,
    name: string,
    ref: string,
    inputs?: WorkflowDispatchInputs,
  ) {
    const token = this.requireToken();
    const payload = dispatchPayload(ref, inputs);
    try {
      await this.request(
        'POST',
        `/repos/${owner}/${name}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        token,
        { data: payload },
      );
    } catch (error) {
      if (statusOf(error) === 404) {
        throw new BadRequestException(
          'Este repositório ainda não tem .github/workflows/cd.yml. Copie websites/_templates/cd.yml para o repo do cliente.',
        );
      }
      if (statusOf(error) === 422 && payload.inputs) {
        try {
          await this.request(
            'POST',
            `/repos/${owner}/${name}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
            token,
            { data: { ref: ref || 'main' } },
          );
          return;
        } catch (retryError) {
          if (statusOf(retryError) === 404) {
            throw new BadRequestException(
              'Este repositório ainda não tem .github/workflows/cd.yml. Copie websites/_templates/cd.yml para o repo do cliente.',
            );
          }
          throw this.asGateway(retryError, 'Falha ao disparar a Action no GitHub');
        }
      }
      throw this.asGateway(error, 'Falha ao disparar a Action no GitHub');
    }
  }

  private token(): string {
    return this.config.get<string>('GITHUB_WEBSITES_TOKEN')?.trim() || '';
  }

  private requireToken(): string {
    const token = this.token();
    if (!token) {
      throw new ServiceUnavailableException(
        'GITHUB_WEBSITES_TOKEN não configurado. Crie um PAT com repo e workflow.',
      );
    }
    return token;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    extra?: { params?: Record<string, unknown>; data?: unknown },
  ): Promise<T> {
    try {
      const res = await axios.request<T>({
        method,
        url: `${GH_API}${path}`,
        params: extra?.params,
        data: extra?.data,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'namao-studio',
        },
        timeout: 20_000,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return res.data;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof ServiceUnavailableException) throw error;
      if (statusOf(error) === 404 || statusOf(error) === 422) throw error;
      throw this.asGateway(error, 'Falha ao falar com o GitHub');
    }
  }

  private asGateway(error: unknown, fallback: string) {
    if (
      error instanceof BadRequestException ||
      error instanceof ServiceUnavailableException
    ) {
      return error;
    }
    const status = statusOf(error);
    const detail =
      axios.isAxiosError(error) &&
      typeof error.response?.data === 'object' &&
      error.response.data &&
      'message' in error.response.data
        ? String((error.response.data as { message?: string }).message)
        : error instanceof Error
          ? error.message
          : fallback;
    return new BadGatewayException(status ? `${fallback} (${status})` : detail);
  }
}

function dispatchPayload(ref: string, inputs?: WorkflowDispatchInputs) {
  const payload: { ref: string; inputs?: Record<string, string> } = {
    ref: ref || 'main',
  };
  if (!inputs) return payload;
  payload.inputs = {
    'deploy-type': inputs.deployType || '',
    'custom-domain': inputs.customDomain || '',
    'project-name': inputs.projectName || '',
  };
  return payload;
}

function statusOf(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  return (error as AxiosError).response?.status ?? null;
}
