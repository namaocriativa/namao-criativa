import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { WebsiteProjectsService } from './website-projects.service';
import { lookupAddresses, probeHttps } from './website-health';

jest.mock('./website-health', () => {
  const actual = jest.requireActual<typeof import('./website-health')>(
    './website-health',
  );
  return {
    ...actual,
    lookupAddresses: jest.fn(),
    probeHttps: jest.fn(),
  };
});

describe('WebsiteProjectsService', () => {
  const prisma = {
    lead: { update: jest.fn(), findUnique: jest.fn() },
    customer: { update: jest.fn(), findUnique: jest.fn() },
  };
  const access = { assertCanAccess: jest.fn() };
  const leads = { findById: jest.fn() };
  const customers = { findById: jest.fn() };
  const github = {
    listRepos: jest.fn(),
    getRepo: jest.fn(),
    dispatchWorkflow: jest.fn(),
  };
  const cloudflare = {
    configured: jest.fn(),
    requireConfigured: jest.fn(),
    listDomains: jest.fn(),
    listDomainDetails: jest.fn(),
    attachDomain: jest.fn(),
    detachDomain: jest.fn(),
    ensureCname: jest.fn(),
  };
  const service = new WebsiteProjectsService(
    prisma as never,
    access as never,
    leads as never,
    customers as never,
    github as never,
    cloudflare as never,
  );
  const user = {
    id: 'user-1',
    email: 'a@b.c',
    name: 'Ana',
    role: 'ADMIN',
    leadId: null,
    customerId: null,
    tenantId: 't1',
  };
  const remote = {
    id: 'lleonesouza/paulinhocabelos',
    title: 'paulinhocabelos',
    repo: 'https://github.com/lleonesouza/paulinhocabelos',
    defaultBranch: 'main',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    access.assertCanAccess.mockResolvedValue({ id: 'lead-1' });
    github.getRepo.mockResolvedValue(remote);
    github.dispatchWorkflow.mockResolvedValue(undefined);
    leads.findById.mockResolvedValue({
      id: 'lead-1',
      websiteRepo: remote.id,
      websiteDeployType: 'cloudflare',
    });
    customers.findById.mockResolvedValue({
      id: 'cust-1',
      websiteRepo: remote.id,
      websiteDeployType: 'vercel',
    });
    prisma.lead.findUnique.mockResolvedValue({
      websiteRepo: remote.id,
      websiteProjectId: 'paulinhocabelos',
      websiteDeployType: 'cloudflare',
      websiteDomain: null,
    });
    prisma.customer.findUnique.mockResolvedValue({
      websiteRepo: remote.id,
      websiteProjectId: 'paulinhocabelos',
      websiteDeployType: 'vercel',
      websiteDomain: null,
    });
    cloudflare.configured.mockReturnValue(true);
    cloudflare.listDomains.mockResolvedValue([]);
    cloudflare.listDomainDetails.mockResolvedValue([]);
    (lookupAddresses as jest.Mock).mockResolvedValue(['1.1.1.1']);
    (probeHttps as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      detail: 'HTTP 200',
    });
    cloudflare.attachDomain.mockResolvedValue(undefined);
    cloudflare.detachDomain.mockResolvedValue(undefined);
    cloudflare.ensureCname.mockResolvedValue(undefined);
  });

  it('lista os repositórios do GitHub', async () => {
    github.listRepos.mockResolvedValue([remote]);
    await expect(service.list()).resolves.toEqual({ projects: [remote] });
  });

  it('rejeita repo inválido', async () => {
    await expect(
      service.linkLead(
        'lead-1',
        { repo: 'sem-barra', deployType: 'cloudflare' },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(github.getRepo).not.toHaveBeenCalled();
  });

  it('grava websiteRepo, deployType e domínio no lead', async () => {
    const result = await service.linkLead(
      'lead-1',
      {
        repo: 'lleonesouza/paulinhocabelos',
        deployType: 'cloudflare',
        domain: 'https://www.paulinhocabelos.com.br',
      },
      user,
    );
    expect(access.assertCanAccess).toHaveBeenCalledWith(user, 'lead-1');
    expect(github.getRepo).toHaveBeenCalledWith('lleonesouza', 'paulinhocabelos');
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: {
        websiteRepo: 'lleonesouza/paulinhocabelos',
        websiteProjectId: 'paulinhocabelos',
        websiteDeployType: 'cloudflare',
        websiteFramework: 'next',
        landingStatus: 'linked',
        websiteDomain: 'paulinhocabelos.com.br',
      },
    });
    expect(github.dispatchWorkflow).not.toHaveBeenCalled();
    expect(cloudflare.attachDomain).not.toHaveBeenCalled();
    expect(result.websiteRepo).toBe('lleonesouza/paulinhocabelos');
  });

  it('dispara a Action com inputs quando deployNow é true', async () => {
    await service.linkLead(
      'lead-1',
      {
        repo: 'lleonesouza/paulinhocabelos',
        deployType: 'vercel',
        deployNow: true,
        framework: 'vite',
        domain: 'loja.com.br',
      },
      user,
    );
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        websiteDeployType: 'vercel',
        websiteFramework: 'vite',
        websiteDomain: 'loja.com.br',
      }),
    });
    expect(github.dispatchWorkflow).toHaveBeenCalledWith(
      'lleonesouza',
      'paulinhocabelos',
      'main',
      {
        deployType: 'vercel',
        customDomain: 'loja.com.br',
        projectName: 'paulinhocabelos',
      },
    );
  });

  it('sincroniza o domínio no Pages sem disparar a Action', async () => {
    await service.syncLeadDomain(
      'lead-1',
      { domain: 'paulinhocabelos.com.br' },
      user,
    );
    expect(github.dispatchWorkflow).not.toHaveBeenCalled();
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { websiteDomain: 'paulinhocabelos.com.br' },
    });
    expect(cloudflare.requireConfigured).toHaveBeenCalled();
    expect(cloudflare.attachDomain).toHaveBeenCalledWith(
      'paulinhocabelos',
      'paulinhocabelos.com.br',
    );
    expect(cloudflare.attachDomain).toHaveBeenCalledWith(
      'paulinhocabelos',
      'www.paulinhocabelos.com.br',
    );
  });

  it('remove o domínio antigo ao sincronizar um novo', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      websiteRepo: remote.id,
      websiteProjectId: 'paulinhocabelos',
      websiteDeployType: 'cloudflare',
      websiteDomain: 'antigo.com.br',
    });
    cloudflare.listDomains.mockResolvedValue([
      'antigo.com.br',
      'www.antigo.com.br',
    ]);
    await service.syncLeadDomain('lead-1', { domain: 'novo.com.br' }, user);
    expect(cloudflare.detachDomain).toHaveBeenCalledWith(
      'paulinhocabelos',
      'antigo.com.br',
    );
    expect(cloudflare.attachDomain).toHaveBeenCalledWith(
      'paulinhocabelos',
      'novo.com.br',
    );
  });

  it('recusa sync quando o destino é Vercel', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      websiteRepo: remote.id,
      websiteProjectId: 'paulinhocabelos',
      websiteDeployType: 'vercel',
      websiteDomain: 'loja.com.br',
    });
    await expect(
      service.syncLeadDomain('lead-1', {}, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudflare.attachDomain).not.toHaveBeenCalled();
  });

  it('avisa quando o token da Cloudflare falta', async () => {
    cloudflare.requireConfigured.mockImplementation(() => {
      throw new ServiceUnavailableException('CLOUDFLARE_API_TOKEN');
    });
    await expect(
      service.syncLeadDomain(
        'lead-1',
        { domain: 'paulinhocabelos.com.br' },
        user,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('salva o vínculo mesmo se a Action ainda não existe', async () => {
    github.dispatchWorkflow.mockRejectedValue(
      new BadRequestException(
        'Este repositório ainda não tem .github/workflows/cd.yml. Copie websites/_templates/cd.yml para o repo do cliente.',
      ),
    );
    await expect(
      service.linkLead(
        'lead-1',
        {
          repo: 'lleonesouza/paulinhocabelos',
          deployType: 'cloudflare',
          deployNow: true,
        },
        user,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ websiteRepo: remote.id }),
    );
    expect(prisma.lead.update).toHaveBeenCalled();
  });

  it('dispara de novo no vínculo salvo', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      websiteRepo: remote.id,
      websiteProjectId: 'paulinhocabelos',
      websiteDeployType: 'cloudflare',
      websiteDomain: 'paulinhocabelos.com.br',
    });
    await service.deployLead('lead-1', user);
    expect(github.dispatchWorkflow).toHaveBeenCalledWith(
      'lleonesouza',
      'paulinhocabelos',
      'main',
      {
        deployType: 'cloudflare',
        customDomain: 'paulinhocabelos.com.br',
        projectName: 'paulinhocabelos',
      },
    );
  });

  it('falha o deploy se o perfil não tem repo', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      websiteRepo: null,
      websiteProjectId: null,
      websiteDeployType: null,
      websiteDomain: null,
    });
    await expect(service.deployLead('lead-1', user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('monta a saúde do site no Cloudflare', async () => {
    prisma.lead.findUnique.mockResolvedValue({
      websiteRepo: remote.id,
      websiteProjectId: 'paulinhocabelos',
      websiteDeployType: 'cloudflare',
      websiteDomain: 'paulinhocabelos.com.br',
    });
    cloudflare.listDomainDetails.mockResolvedValue([
      { name: 'paulinhocabelos.com.br', status: 'active' },
      { name: 'www.paulinhocabelos.com.br', status: 'active' },
    ]);
    const health = await service.healthLead('lead-1', user);
    expect(health.overall).toBe('ok');
    expect(health.pagesDev).toBe('paulinhocabelos.pages.dev');
    expect(health.items).toHaveLength(3);
  });

  it('grava o vínculo no cliente', async () => {
    await service.linkCustomer(
      'cust-1',
      { repo: 'lleonesouza/paulinhocabelos', deployType: 'vercel' },
      user,
    );
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: expect.objectContaining({
        websiteRepo: 'lleonesouza/paulinhocabelos',
        websiteDeployType: 'vercel',
        landingStatus: 'linked',
      }),
    });
  });
});
