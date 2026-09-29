import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { JwtUser } from '../auth/identity';
import { LlmService } from '../llm/llm.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerWhere } from '../owner/owner.util';
import { buildLeadBrief } from '../owner/lead-brief';
import type { LeadLike } from '../owner/lead-like';
import { stableLandingSlug } from '../owner/lead-like';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { runWithAiUsage } from '../ai-usage/ai-usage.context';
import { AI_FEATURES } from '../ai-usage/ai-usage.features';
import { requireTenantId, tenantWhere } from '../tenant/tenant.util';
import { GithubWebsitesClient } from '../website-projects/github-websites.client';
import { WebsiteProjectsService } from '../website-projects/website-projects.service';
import {
  buildSiteSkillBrief,
  isLeadImageSelected,
  type SiteBriefSource,
} from './site-brief';
import { estimateSiteSkillUsd } from './site-cost';
import { parseSiteFiles, buildSiteCodePrompt } from './site-files';
import { assertSafeRelPath } from './site-paths';
import { buildLeadPromptRewriteTask, parseLeadPrompt } from './site-prompt';
import {
  parseSiteObjective,
  type SiteApprovedBrief,
  type SiteObjective,
} from './site-skill.contract';
import {
  publicJob,
  type SiteSkillLogItem,
  type SiteSkillStage,
} from './site-skill.jobs';
import {
  buildSiteStructureTask,
  parseApprovedBrief,
  parseSiteStructure,
  parseStoredBrief,
} from './site-structure';

const execFileAsync = promisify(execFile);

export type SiteSkillUpload = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class SiteSkillService {
  private readonly logger = new Logger(SiteSkillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly owners: OwnerLookup,
    private readonly access: StudioLeadAccessService,
    private readonly llm: LlmService,
    private readonly storage: StorageService,
    private readonly github: GithubWebsitesClient,
    private readonly websites: WebsiteProjectsService,
  ) {}

  estimate(model?: string) {
    const chosen = model?.trim() || this.llm.modelFor('code');
    return estimateSiteSkillUsd(chosen);
  }

  async briefFor(user: JwtUser, leadId?: string, customerId?: string) {
    const owner = await this.resolveOwner(user, leadId, customerId);
    return this.loadBrief(owner);
  }

  async propose(opts: {
    user: JwtUser;
    leadId?: string;
    customerId?: string;
    objective?: string;
    objectiveNote?: string;
  }) {
    const owner = await this.resolveOwner(
      opts.user,
      opts.leadId,
      opts.customerId,
    );
    let objective: SiteObjective;
    try {
      objective = parseSiteObjective(opts.objective);
    } catch {
      throw new BadRequestException('Escolha o objetivo da página');
    }
    const objectiveNote = (opts.objectiveNote || '').trim();
    if (objective === 'other' && !objectiveNote) {
      throw new BadRequestException('Descreva o outro objetivo');
    }
    const loaded = await this.loadBrief(owner);
    return runWithAiUsage(
      {
        feature: AI_FEATURES.siteSkill,
        userId: opts.user.id,
        leadId: owner.kind === 'lead' ? owner.ownerId : null,
        customerId: owner.kind === 'customer' ? owner.ownerId : null,
      },
      () =>
        this.llm.generateJson(
          buildSiteStructureTask({ brief: loaded, objective, objectiveNote }),
          (value) =>
            parseSiteStructure(value, {
              objective,
              objectiveNote,
              knownGaps: loaded.gaps,
            }),
          { role: 'plan', expectedShape: '{sections,gaps}' },
        ),
    );
  }

  async findJob(id: string) {
    const row = await this.prisma.siteSkillJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Job não encontrado');
    if (row.tenantId !== requireTenantId()) {
      throw new NotFoundException('Job não encontrado');
    }
    return publicJob(row);
  }

  async start(opts: {
    user: JwtUser;
    leadId?: string;
    customerId?: string;
    model?: string;
    notes?: string;
    imageIds?: string[];
    uploads?: SiteSkillUpload[];
    brief?: unknown;
  }) {
    const owner = await this.resolveOwner(
      opts.user,
      opts.leadId,
      opts.customerId,
    );
    const detail = owner.detail as LeadLike;
    const slug = stableLandingSlug(detail);
    if (!detail.landingSlug) {
      await this.owners.update(owner.ownerId, { landingSlug: slug });
    }
    const model = opts.model?.trim() || this.llm.modelFor('code');
    const stored = this.readApproved(opts.brief);
    const row = await this.prisma.siteSkillJob.create({
      data: {
        tenantId: requireTenantId(),
        leadId: owner.kind === 'lead' ? owner.ownerId : null,
        customerId: owner.kind === 'customer' ? owner.ownerId : null,
        slug,
        status: 'queued',
        stage: 'queued',
        model,
        notes: (opts.notes || '').trim(),
        ...(stored ? { brief: stored } : {}),
        createdByUserId: opts.user.id,
        log: [
          { stage: 'queued', message: 'Na fila', at: new Date().toISOString() },
        ],
      },
    });
    void this.run(row.id, {
      ownerId: owner.ownerId,
      kind: owner.kind,
      imageIds: opts.imageIds || [],
      uploads: opts.uploads || [],
    }).catch((error) => {
      this.logger.error(
        error instanceof Error ? error.stack || error.message : String(error),
      );
    });
    return publicJob(row);
  }

  private async run(
    jobId: string,
    ctx: {
      ownerId: string;
      kind: 'lead' | 'customer';
      imageIds: string[];
      uploads: SiteSkillUpload[];
    },
  ) {
    const work = path.join(os.tmpdir(), `namao-site-${jobId}`);
    const meta = await this.prisma.siteSkillJob.findUnique({
      where: { id: jobId },
      select: { createdByUserId: true, leadId: true, customerId: true },
    });
    return runWithAiUsage(
      {
        feature: AI_FEATURES.siteSkill,
        userId: meta?.createdByUserId,
        leadId: meta?.leadId || (ctx.kind === 'lead' ? ctx.ownerId : null),
        customerId:
          meta?.customerId || (ctx.kind === 'customer' ? ctx.ownerId : null),
        jobId,
      },
      () => this.execute(jobId, ctx, work),
    );
  }

  private async execute(
    jobId: string,
    ctx: {
      ownerId: string;
      kind: 'lead' | 'customer';
      imageIds: string[];
      uploads: SiteSkillUpload[];
    },
    work: string,
  ) {
    try {
      await fs.rm(work, { recursive: true, force: true });
      await fs.mkdir(work, { recursive: true });
      const job = await this.requireJob(jobId);
      const detail = (await this.owners.requireDetail(ctx.ownerId)) as LeadLike;
      const brief = buildLeadBrief(detail);
      const approved = parseStoredBrief(job.brief);
      const wanted = new Set(ctx.imageIds);
      const promptBrief = {
        ...brief,
        images: brief.images.filter((image) => wanted.has(image.filename)),
      };

      await this.mark(jobId, 'scaffold', 'Criando o Vite…');
      const projectDir = await this.scaffold(work, job.slug);

      await this.mark(jobId, 'prompt', 'Adaptando o prompt…');
      const extraNames = ctx.uploads.map((file) => file.originalname);
      const rewritten = await this.llm.generateJson(
        buildLeadPromptRewriteTask(
          promptBrief,
          job.notes,
          extraNames,
          approved,
        ),
        parseLeadPrompt,
        { role: 'plan', expectedShape: '{prompt}' },
      );
      await fs.writeFile(
        path.join(projectDir, 'prompt.md'),
        rewritten.prompt,
        'utf8',
      );

      await this.mark(jobId, 'code', 'Gerando o site…');
      const generated = await this.llm.generateJson(
        buildSiteCodePrompt({
          prompt: rewritten.prompt,
          slug: job.slug,
          imageNames: [
            ...promptBrief.images.map((image) =>
              image.publicPath.replace(/^\//, ''),
            ),
            ...extraNames,
          ],
          approved,
        }),
        parseSiteFiles,
        {
          role: 'code',
          model: job.model || undefined,
          expectedShape: '{files}',
        },
      );
      await this.writeFiles(projectDir, generated.files);
      await this.mergeDeps(projectDir, generated.extraDeps || []);

      await this.mark(jobId, 'media', 'Copiando mídia…');
      await this.copyMedia(projectDir, detail, ctx);

      await this.mark(jobId, 'github', 'Criando o repositório…');
      await this.writeCdYml(projectDir, job.slug);
      const remote = await this.github.createRepo(job.slug);
      const [owner, name] = remote.id.split('/');
      await this.github.pushDirectory(projectDir, owner, name);

      await this.mark(jobId, 'link', 'Vinculando no perfil…');
      await this.websites.attachGeneratedRepo(ctx.kind, ctx.ownerId, remote.id);

      await this.mark(jobId, 'clone', 'Sincronizando websites/…');
      const cloned = await this.cloneLocal(owner, name, job.slug);

      await this.prisma.siteSkillJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          stage: 'done',
          repo: remote.id,
          error: null,
        },
      });
      await this.appendLog(
        jobId,
        'done',
        cloned
          ? `Pronto · ${remote.id} · clone em websites/${job.slug}`
          : `Pronto · ${remote.id}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o site';
      await this.prisma.siteSkillJob.update({
        where: { id: jobId },
        data: { status: 'error', stage: 'error', error: message },
      });
      await this.appendLog(jobId, 'error', message);
    } finally {
      await fs
        .rm(work, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }

  private async scaffold(parent: string, slug: string): Promise<string> {
    await execFileAsync(
      'npm',
      ['create', 'vite@latest', slug, '--', '--template', 'react-ts'],
      { cwd: parent, timeout: 180_000 },
    );
    return path.join(parent, slug);
  }

  private async writeFiles(root: string, files: Record<string, string>) {
    for (const [rel, content] of Object.entries(files)) {
      const safe = assertSafeRelPath(rel);
      const dest = path.join(root, safe);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, 'utf8');
    }
  }

  private async mergeDeps(root: string, extra: string[]) {
    const deps = new Set(['motion', 'three', ...extra]);
    const pkgPath = path.join(root, 'package.json');
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      pkg.dependencies = pkg.dependencies || {};
      for (const name of deps) {
        if (!pkg.dependencies[name]) pkg.dependencies[name] = 'latest';
      }
      await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    } catch {
      /* scaffold sem package.json */
    }
  }

  private async copyMedia(
    root: string,
    detail: LeadLike,
    ctx: { imageIds: string[]; uploads: SiteSkillUpload[] },
  ) {
    const publicDir = path.join(root, 'public');
    await fs.mkdir(path.join(publicDir, 'images'), { recursive: true });
    for (const file of ctx.uploads) {
      const name = path.basename(file.originalname || 'upload.bin');
      await fs.writeFile(path.join(publicDir, name), file.buffer);
    }
    const wanted = new Set(ctx.imageIds);
    for (const image of detail.images || []) {
      if (!isLeadImageSelected(image.filename, wanted)) continue;
      if (!image.localPath) continue;
      const buf = await this.storage.readStorageFile(image.localPath);
      if (!buf) continue;
      const filename = image.filename || path.basename(image.localPath);
      await fs.writeFile(path.join(publicDir, 'images', filename), buf);
    }
  }

  private async writeCdYml(root: string, slug: string) {
    const src = path.resolve(this.websitesDir(), '_templates', 'cd.yml');
    let body = '';
    try {
      body = await fs.readFile(src, 'utf8');
    } catch {
      body = `name: CD client website
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo skip
`;
    }
    body = body
      .replace(/framework: next/g, 'framework: vite')
      .replace(/default: paulinhocabelos/g, `default: ${slug}`);
    const dest = path.join(root, '.github', 'workflows');
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, 'cd.yml'), body, 'utf8');
  }

  async cloneLocal(
    owner: string,
    name: string,
    slug: string,
  ): Promise<boolean> {
    const destRoot = this.websitesDir();
    try {
      await fs.access(destRoot);
    } catch {
      return false;
    }
    const dest = path.join(destRoot, slug);
    try {
      await fs.access(dest);
      return true;
    } catch {
      /* clone */
    }
    try {
      await this.github.cloneRepo(owner, name, dest);
      await this.appendCatalog(owner, name, slug);
      return true;
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'clone websites/ falhou',
      );
      return false;
    }
  }

  private async appendCatalog(owner: string, name: string, slug: string) {
    const file = path.join(this.websitesDir(), 'catalog.json');
    let data: { projects: Array<Record<string, string>> } = { projects: [] };
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8')) as typeof data;
    } catch {
      data = { projects: [] };
    }
    const id = `${owner}/${name}`;
    if (data.projects.some((item) => item.id === id || item.title === slug)) {
      return;
    }
    data.projects.push({
      id,
      title: slug,
      repo: `https://github.com/${id}`,
      framework: 'vite',
      cloudflareProjectName: slug,
      vercelProjectName: slug,
    });
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  websitesDir(): string {
    const configured = this.config.get<string>('WEBSITES_DIR')?.trim();
    if (configured) return path.resolve(configured);
    return path.resolve(__dirname, '..', '..', '..', '..', 'websites');
  }

  private async resolveOwner(
    user: JwtUser,
    leadId?: string,
    customerId?: string,
  ) {
    const lead = leadId?.trim() || '';
    const customer = customerId?.trim() || '';
    if ((lead && customer) || (!lead && !customer)) {
      throw new BadRequestException('Informe leadId ou customerId');
    }
    const ownerId = lead || customer;
    await this.access.assertCanAccess(user, ownerId);
    const detail = await this.owners.requireDetail(ownerId);
    return {
      ownerId,
      kind: lead ? ('lead' as const) : ('customer' as const),
      detail,
    };
  }

  private async loadBrief(owner: { ownerId: string; detail: unknown }) {
    const igJob = await this.prisma.instagramSkillJob.findFirst({
      where: tenantWhere({
        status: 'done',
        ...ownerWhere(owner.ownerId),
      }),
      orderBy: { createdAt: 'desc' },
    });
    return buildSiteSkillBrief(owner.detail as SiteBriefSource, igJob);
  }

  private readApproved(value: unknown): SiteApprovedBrief | null {
    if (value == null || value === '') return null;
    try {
      const raw: unknown =
        typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
      return parseApprovedBrief(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      throw new BadRequestException(
        message === 'descreva o objetivo'
          ? 'Descreva o outro objetivo'
          : 'Briefing aprovado inválido',
      );
    }
  }

  private async requireJob(id: string) {
    const row = await this.prisma.siteSkillJob.findFirst({
      where: tenantWhere({ id }),
    });
    if (!row) throw new NotFoundException('Job não encontrado');
    return row;
  }

  private async mark(id: string, stage: SiteSkillStage, message: string) {
    await this.prisma.siteSkillJob.update({
      where: { id },
      data: { status: stage === 'error' ? 'error' : 'running', stage },
    });
    await this.appendLog(id, stage, message);
  }

  private async appendLog(id: string, stage: SiteSkillStage, message: string) {
    const row = await this.prisma.siteSkillJob.findUnique({ where: { id } });
    const log = (Array.isArray(row?.log) ? row.log : []) as SiteSkillLogItem[];
    log.push({ stage, message, at: new Date().toISOString() });
    await this.prisma.siteSkillJob.update({
      where: { id },
      data: { log },
    });
  }
}
