import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { GithubWebsitesClient } from './github-websites.client';

function makeClient(token?: string) {
  const config = {
    get: jest.fn((key: string) =>
      key === 'GITHUB_WEBSITES_TOKEN' ? token : undefined,
    ),
  };
  return new GithubWebsitesClient(config as unknown as ConfigService);
}

function axiosError(status: number, message = 'Not Found') {
  const error = new AxiosError(message);
  error.response = {
    status,
    data: { message },
    statusText: message,
    headers: {},
    config: { headers: {} as never },
  };
  return error;
}

describe('GithubWebsitesClient', () => {
  let request: jest.SpyInstance;

  beforeEach(() => {
    request = jest.spyOn(axios, 'request').mockReset();
  });

  afterEach(() => {
    request.mockRestore();
  });

  it('lista repositórios do token', async () => {
    request.mockResolvedValueOnce({
      data: [
        {
          full_name: 'lleonesouza/paulinhocabelos',
          name: 'paulinhocabelos',
          html_url: 'https://github.com/lleonesouza/paulinhocabelos',
          default_branch: 'main',
        },
      ],
    });
    const repos = await makeClient('ghp_test').listRepos();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://api.github.com/user/repos',
        params: expect.objectContaining({
          affiliation: 'owner,collaborator,organization_member',
        }),
      }),
    );
    expect(repos).toEqual([
      {
        id: 'lleonesouza/paulinhocabelos',
        title: 'paulinhocabelos',
        repo: 'https://github.com/lleonesouza/paulinhocabelos',
        defaultBranch: 'main',
      },
    ]);
  });

  it('falha com 503 sem token', async () => {
    await expect(makeClient('').listRepos()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('dispara workflow_dispatch no cd.yml', async () => {
    request.mockResolvedValueOnce({ data: undefined });
    await makeClient('ghp_test').dispatchWorkflow(
      'lleonesouza',
      'paulinhocabelos',
      'main',
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://api.github.com/repos/lleonesouza/paulinhocabelos/actions/workflows/cd.yml/dispatches',
        data: { ref: 'main' },
      }),
    );
  });

  it('envia inputs e cai no dispatch simples se o cd.yml ainda não os declara', async () => {
    request
      .mockRejectedValueOnce(axiosError(422, 'Unexpected inputs'))
      .mockResolvedValueOnce({ data: undefined });
    await makeClient('ghp_test').dispatchWorkflow(
      'lleonesouza',
      'paulinhocabelos',
      'main',
      {
        deployType: 'cloudflare',
        customDomain: 'paulinhocabelos.com.br',
        projectName: 'paulinhocabelos',
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: {
          ref: 'main',
          inputs: {
            'deploy-type': 'cloudflare',
            'custom-domain': 'paulinhocabelos.com.br',
            'project-name': 'paulinhocabelos',
          },
        },
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { ref: 'main' } }),
    );
  });

  it('rejeita repositório inexistente', async () => {
    request.mockRejectedValueOnce(axiosError(404));
    await expect(
      makeClient('ghp_test').getRepo('lleonesouza', 'missing'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pede o template quando o workflow não existe', async () => {
    request.mockRejectedValueOnce(axiosError(404));
    await expect(
      makeClient('ghp_test').dispatchWorkflow(
        'lleonesouza',
        'paulinhocabelos',
        'main',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
