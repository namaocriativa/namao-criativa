import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateLandingDto } from './dto/generate-landing.dto';
import { normalizeGenerateConfig } from './generate-config';
import { LandingJobsService } from './landing-jobs.service';
import { LandingLocalService } from './landing-local.service';
import { LandingPipelineService } from './landing-pipeline.service';
import { buildLeadBrief } from './lead-brief';
import { LlmService } from '../llm/llm.service';
import { buildPipelineOverviewPrompt } from './pipeline-prompts';
import { buildCursorLandingPrompt, stableLandingSlug } from './prompt.builder';
import { ScaffoldService } from './scaffold.service';
import { PRESET_SECTIONS } from './section-catalog';
import { VercelService } from './vercel.service';

@Injectable()
export class LandingService {
  private readonly logger = new Logger(LandingService.name);

  constructor(
    private readonly owners: OwnerLookup,
    private readonly prisma: PrismaService,
    private readonly scaffoldService: ScaffoldService,
    private readonly llmService: LlmService,
    private readonly jobsService: LandingJobsService,
    private readonly pipelineService: LandingPipelineService,
    private readonly localService: LandingLocalService,
    private readonly vercelService: VercelService,
  ) {}

  async status() {
    const llm = await this.llmService.status();
    return {
      ...llm,
      vercel: this.vercelService.status(),
    };
  }

  generatorOptions() {
    return {
      sections: PRESET_SECTIONS,
      customType: 'custom',
    };
  }

  async scaffold(leadId: string) {
    return this.scaffoldService.ensureScaffold(leadId);
  }

  async prompt(leadId: string) {
    const lead = await this.owners.requireDetail(leadId);
    const slug = stableLandingSlug(lead);
    const brief = buildLeadBrief(lead);
    const prompt = buildPipelineOverviewPrompt(brief);
    const cursorPrompt = buildCursorLandingPrompt(lead);

    const projectDir = this.scaffoldService.projectPath(slug);
    try {
      await fs.access(projectDir);
      await fs.writeFile(path.join(projectDir, 'PROMPT.md'), prompt, 'utf8');
    } catch {
      // scaffold optional for prompt generation
    }

    return {
      slug,
      prompt,
      cursorPrompt,
      path: `leads/${slug}`,
    };
  }

  async startGenerate(dto: GenerateLandingDto) {
    const leadId = dto.leadId;
    const config = normalizeGenerateConfig(dto);
    const llm = await this.llmService.status();
    if (!llm.ready) {
      throw new BadRequestException(
        llm.error || 'LLM indisponível. Ajuste a aba Config.',
      );
    }

    const scaffold = await this.scaffoldService.ensureScaffold(leadId);
    const job = await this.jobsService.create(leadId, scaffold.slug, config);
    void this.pipelineService.run(job).catch((error) => {
      this.logger.error(
        `Job ${job.id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return {
      jobId: job.id,
      slug: scaffold.slug,
      scaffoldCreated: scaffold.created,
      leadId,
      sections: config.sections.map((section) => section.id),
      components: config.components.map((item) => item.component),
    };
  }

  async getJob(jobId: string) {
    return this.jobsService.get(jobId);
  }

  async getJobPublic(jobId: string) {
    const job = await this.jobsService.get(jobId);
    return this.jobsService.toPublic(job);
  }

  async cancelJob(jobId: string) {
    const job = await this.jobsService.requestCancel(jobId);
    return this.jobsService.toPublic(job);
  }

  async deleteSite(leadId: string) {
    const lead = await this.owners.requireDetail(leadId);
    const slug = (lead.landingSlug || stableLandingSlug(lead)).trim();
    if (!slug || slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
      throw new BadRequestException('Slug de landing inválido');
    }

    if (lead.activeLandingJobId) {
      try {
        await this.jobsService.requestCancel(lead.activeLandingJobId);
      } catch {
        // job pode já ter terminado
      }
    }

    this.localService.stopLead(leadId);

    const leadsDir = path.resolve(this.scaffoldService.getLeadsDir());
    const projectDir = path.resolve(this.scaffoldService.projectPath(slug));
    const relative = path.relative(leadsDir, projectDir);
    if (
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative)
    ) {
      throw new BadRequestException('Caminho de landing inválido');
    }

    let deletedDir = false;
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
      deletedDir = true;
    } catch (error) {
      this.logger.warn(
        `Falha ao remover leads/${slug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const updated = await this.owners.update(leadId, {
      landingStatus: 'none',
      landingSlug: null,
      landingBuiltAt: null,
      activeLandingJobId: null,
    });

    return {
      leadId,
      slug,
      deletedDir,
      path: `leads/${slug}`,
      landingStatus: updated.landingStatus,
    };
  }

  async startLocal(leadId: string) {
    return this.localService.start(leadId);
  }

  async getPreviewMeta(leadId: string) {
    const lead = await this.owners.requireDetail(leadId);
    const slug = stableLandingSlug(lead);
    const distDir = path.join(this.scaffoldService.projectPath(slug), 'dist');
    try {
      await fs.access(path.join(distDir, 'index.html'));
    } catch {
      throw new NotFoundException(
        `Preview indisponível para lead ${leadId}. Gere o site e aguarde o build.`,
      );
    }
    return { leadId, slug, distDir, previewPath: `/landing/preview/${leadId}/` };
  }

  async publish(leadId: string) {
    const lead = await this.owners.requireDetail(leadId);
    const slug = (lead.landingSlug || stableLandingSlug(lead)).trim();
    if (!slug) {
      throw new BadRequestException('Lead sem landing gerada');
    }
    const projectDir = this.scaffoldService.projectPath(slug);
    await this.getPreviewMeta(leadId);
    return this.vercelService.publishProject({
      leadId,
      slug,
      projectDir,
      existingProjectId: lead.vercelProjectId,
    });
  }

  async rateGeneration(id: string, rating: number) {
    const row = await this.prisma.landingGeneration.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Generation ${id} não encontrada`);
    return this.prisma.landingGeneration.update({
      where: { id },
      data: { humanRating: rating },
    });
  }

  async listGenerations() {
    return this.prisma.landingGeneration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        leadId: true,
        jobId: true,
        componentIds: true,
        themeStyle: true,
        category: true,
        visualScore: true,
        humanRating: true,
        conversion: true,
        createdAt: true,
      },
    });
  }
}
