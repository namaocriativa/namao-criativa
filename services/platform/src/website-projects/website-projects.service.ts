import { BadRequestException, Injectable } from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.strategy';
import { CustomerService } from '../customer/customer.service';
import { LeadService } from '../lead/lead.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { parseGithubRepo } from './github-repo';
import {
  GithubWebsitesClient,
  type WorkflowDispatchInputs,
} from './github-websites.client';
import { CloudflarePagesClient } from './pages-domain.client';
import { parseWebsiteDomain, syncPagesProjectDomains } from './pages-domain';
import {
  buildWebsiteHealth,
  lookupAddresses,
  pagesDevHost,
  probeHttps,
  wantedHosts,
  type HostProbe,
} from './website-health';
import {
  WEBSITE_FRAMEWORKS,
  type WebsiteDeployType,
  type WebsiteFramework,
} from './website-catalog';

export type LinkWebsiteInput = {
  repo: string;
  deployType: WebsiteDeployType;
  deployNow?: boolean;
  framework?: WebsiteFramework;
  domain?: string;
  syncDomain?: boolean;
};

export type SyncWebsiteDomainInput = {
  domain?: string;
};

type WebsiteRow = {
  websiteRepo: string | null;
  websiteProjectId: string | null;
  websiteDeployType: string | null;
  websiteDomain: string | null;
};

@Injectable()
export class WebsiteProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioLeadAccessService,
    private readonly leads: LeadService,
    private readonly customers: CustomerService,
    private readonly github: GithubWebsitesClient,
    private readonly cloudflare: CloudflarePagesClient,
  ) {}

  list() {
    return this.github.listRepos().then((projects) => ({ projects }));
  }

  async linkLead(leadId: string, dto: LinkWebsiteInput, user: JwtUser) {
    await this.access.assertCanAccess(user, leadId);
    const linked = await this.persistLink('lead', leadId, dto);
    await this.dispatchAfterSave(linked, dto.deployNow);
    return this.leads.findById(leadId, user);
  }

  async linkCustomer(customerId: string, dto: LinkWebsiteInput, user: JwtUser) {
    await this.access.assertCanAccess(user, customerId);
    const linked = await this.persistLink('customer', customerId, dto);
    await this.dispatchAfterSave(linked, dto.deployNow);
    return this.customers.findById(customerId, user);
  }

  async deployLead(leadId: string, user: JwtUser) {
    await this.access.assertCanAccess(user, leadId);
    await this.dispatchProfile('lead', leadId);
    return this.leads.findById(leadId, user);
  }

  async deployCustomer(customerId: string, user: JwtUser) {
    await this.access.assertCanAccess(user, customerId);
    await this.dispatchProfile('customer', customerId);
    return this.customers.findById(customerId, user);
  }

  async syncLeadDomain(
    leadId: string,
    dto: SyncWebsiteDomainInput,
    user: JwtUser,
  ) {
    await this.access.assertCanAccess(user, leadId);
    await this.syncProfile('lead', leadId, dto);
    return this.leads.findById(leadId, user);
  }

  async syncCustomerDomain(
    customerId: string,
    dto: SyncWebsiteDomainInput,
    user: JwtUser,
  ) {
    await this.access.assertCanAccess(user, customerId);
    await this.syncProfile('customer', customerId, dto);
    return this.customers.findById(customerId, user);
  }

  async healthLead(leadId: string, user: JwtUser) {
    await this.access.assertCanAccess(user, leadId);
    return this.describeHealth(await this.readRow('lead', leadId));
  }

  async healthCustomer(customerId: string, user: JwtUser) {
    await this.access.assertCanAccess(user, customerId);
    return this.describeHealth(await this.readRow('customer', customerId));
  }

  private async persistLink(
    kind: 'lead' | 'customer',
    id: string,
    dto: LinkWebsiteInput,
  ) {
    const parsed = parseGithubRepo(dto.repo);
    if (!parsed) {
      throw new BadRequestException('Informe o repositório no formato owner/name');
    }
    const existing = await this.readRow(kind, id);
    const remote = await this.github.getRepo(parsed.owner, parsed.name);
    const framework = WEBSITE_FRAMEWORKS.includes(dto.framework as WebsiteFramework)
      ? (dto.framework as WebsiteFramework)
      : 'next';
    const data: {
      websiteRepo: string;
      websiteProjectId: string;
      websiteDeployType: WebsiteDeployType;
      websiteFramework: WebsiteFramework;
      landingStatus: string;
      websiteDomain?: string | null;
    } = {
      websiteRepo: remote.id,
      websiteProjectId: remote.title,
      websiteDeployType: dto.deployType,
      websiteFramework: framework,
      landingStatus: 'linked',
    };
    let nextDomain = existing?.websiteDomain ?? null;
    if (dto.domain !== undefined) {
      nextDomain = this.requireDomain(dto.domain);
      data.websiteDomain = nextDomain;
    }
    if (kind === 'lead') {
      await this.prisma.lead.update({ where: { id }, data });
    } else {
      await this.prisma.customer.update({ where: { id }, data });
    }
    if (dto.syncDomain) {
      await this.applyDomainSync({
        project: remote.title,
        deployType: dto.deployType,
        previous: existing?.websiteDomain,
        next: nextDomain,
        requireCloudflare: dto.deployType === 'cloudflare',
      });
    }
    return {
      owner: parsed.owner,
      name: parsed.name,
      defaultBranch: remote.defaultBranch,
      deployType: dto.deployType,
      customDomain: nextDomain || '',
      projectName: remote.title,
    };
  }

  private async syncProfile(
    kind: 'lead' | 'customer',
    id: string,
    dto: SyncWebsiteDomainInput,
  ) {
    const row = await this.readRow(kind, id);
    if (!row?.websiteRepo) {
      throw new BadRequestException('Este perfil ainda não tem um repositório vinculado');
    }
    if (row.websiteDeployType !== 'cloudflare') {
      throw new BadRequestException(
        'Sincronizar domínio vale só para sites no Cloudflare Pages.',
      );
    }
    const previous = row.websiteDomain;
    let next = previous;
    if (dto.domain !== undefined) {
      next = this.requireDomain(dto.domain);
      const data = { websiteDomain: next };
      if (kind === 'lead') {
        await this.prisma.lead.update({ where: { id }, data });
      } else {
        await this.prisma.customer.update({ where: { id }, data });
      }
    }
    if (!next && !previous) {
      throw new BadRequestException('Informe o domínio para sincronizar no Pages.');
    }
    const project = row.websiteProjectId;
    if (!project) {
      throw new BadRequestException('Este perfil não tem um projeto Pages vinculado.');
    }
    await this.applyDomainSync({
      project,
      deployType: 'cloudflare',
      previous,
      next,
      requireCloudflare: true,
    });
  }

  private async applyDomainSync(opts: {
    project: string;
    deployType: string;
    previous?: string | null;
    next: string | null;
    requireCloudflare: boolean;
  }) {
    if (opts.deployType !== 'cloudflare') {
      if (opts.previous) {
        this.cloudflare.requireConfigured();
        await syncPagesProjectDomains({
          api: this.cloudflare,
          project: opts.project,
          previous: opts.previous,
          next: null,
          pagesDev: `${opts.project}.pages.dev`,
        });
      }
      return;
    }
    if (!opts.next && !opts.previous) return;
    if (opts.requireCloudflare) this.cloudflare.requireConfigured();
    else if (!this.cloudflare.configured()) return;
    await syncPagesProjectDomains({
      api: this.cloudflare,
      project: opts.project,
      previous: opts.previous,
      next: opts.next,
      pagesDev: `${opts.project}.pages.dev`,
    });
  }

  private async describeHealth(row: WebsiteRow | null) {
    const project = row?.websiteProjectId || null;
    const domain = row?.websiteDomain || null;
    const pagesDev = pagesDevHost(project);
    const pagesLive = pagesDev ? await probeHttps(pagesDev) : null;
    let attached: Array<{ name: string; status: string }> = [];
    if (project && row?.websiteDeployType === 'cloudflare' && this.cloudflare.configured()) {
      try {
        attached = await this.cloudflare.listDomainDetails(project);
      } catch {
        attached = [];
      }
    }
    const hosts: HostProbe[] = [];
    for (const host of wantedHosts(domain)) {
      const addresses = await lookupAddresses(host);
      hosts.push({
        host,
        addresses,
        http: await probeHttps(host, addresses),
        attached: attached.find((item) => item.name === host) || null,
      });
    }
    return buildWebsiteHealth({
      project,
      deployType: row?.websiteDeployType || null,
      domain,
      pagesLive,
      attached,
      hosts,
    });
  }

  private requireDomain(value: string): string | null {
    const parsed = parseWebsiteDomain(value);
    if (parsed.invalid) {
      throw new BadRequestException('Informe um domínio válido, sem caminho.');
    }
    return parsed.domain;
  }

  private async readRow(
    kind: 'lead' | 'customer',
    id: string,
  ): Promise<WebsiteRow | null> {
    const select = {
      websiteRepo: true,
      websiteProjectId: true,
      websiteDeployType: true,
      websiteDomain: true,
    };
    if (kind === 'lead') {
      return this.prisma.lead.findUnique({ where: { id }, select });
    }
    return this.prisma.customer.findUnique({ where: { id }, select });
  }

  private async dispatchAfterSave(
    linked: Parameters<WebsiteProjectsService['dispatchLinked']>[0],
    deployNow?: boolean,
  ) {
    if (!deployNow) return;
    try {
      await this.dispatchLinked(linked);
    } catch (error) {
      if (error instanceof BadRequestException) return;
      throw error;
    }
  }

  private async dispatchProfile(kind: 'lead' | 'customer', id: string) {
    const row = await this.readRow(kind, id);
    await this.dispatchSaved(row);
  }

  private async dispatchSaved(row: WebsiteRow | null | undefined) {
    const parsed = parseGithubRepo(row?.websiteRepo);
    if (!parsed) {
      throw new BadRequestException('Este perfil ainda não tem um repositório vinculado');
    }
    const remote = await this.github.getRepo(parsed.owner, parsed.name);
    await this.dispatchLinked({
      owner: parsed.owner,
      name: parsed.name,
      defaultBranch: remote.defaultBranch,
      deployType: (row?.websiteDeployType as WebsiteDeployType) || 'cloudflare',
      customDomain: row?.websiteDomain || '',
      projectName: row?.websiteProjectId || remote.title,
    });
  }

  private dispatchLinked(linked: {
    owner: string;
    name: string;
    defaultBranch: string;
    deployType: WebsiteDeployType | string;
    customDomain: string;
    projectName: string;
  }) {
    const inputs: WorkflowDispatchInputs = {
      deployType: linked.deployType,
      customDomain: linked.customDomain,
      projectName: linked.projectName,
    };
    return this.github.dispatchWorkflow(
      linked.owner,
      linked.name,
      linked.defaultBranch,
      inputs,
    );
  }
}
