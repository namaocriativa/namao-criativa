import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LandingGenerateConfig } from './pipeline.types';

export type LandingJobStage =
  | 'queued'
  | 'briefing'
  | 'vision'
  | 'site_plan'
  | 'art_director'
  | 'page_architect'
  | 'pexels'
  | 'design_system'
  | 'section'
  | 'copywriter'
  | 'assembling'
  | 'reviewing'
  | 'visual_review'
  | 'screenshot'
  | 'validating'
  | 'saving'
  | 'copying_images'
  | 'npm_install'
  | 'npm_build'
  | 'publishing'
  | 'done'
  | 'done_with_warnings'
  | 'error'
  | 'cancelled';

export type LandingJobEvent = {
  stage: LandingJobStage;
  message: string;
  tokens?: number;
  chunk?: string;
  slug?: string;
  path?: string;
  warnings?: string[];
  error?: string;
  step?: number;
  totalSteps?: number;
  sectionId?: string;
  url?: string;
  at: string;
};

export type LandingJobRuntime = {
  id: string;
  leadId: string;
  slug: string;
  status: LandingJobStage;
  log: LandingJobEvent[];
  error?: string;
  cancelRequested: boolean;
  emitter: EventEmitter;
  createdAt: Date;
  updatedAt: Date;
  config?: LandingGenerateConfig;
};

const TERMINAL: LandingJobStage[] = [
  'done',
  'done_with_warnings',
  'error',
  'cancelled',
];

@Injectable()
export class LandingJobsService {
  private readonly emitters = new Map<string, EventEmitter>();
  private readonly configs = new Map<string, LandingGenerateConfig>();

  constructor(private readonly prisma: PrismaService) {}

  async create(
    leadId: string,
    slug: string,
    config?: LandingGenerateConfig,
  ): Promise<LandingJobRuntime> {
    const row = await this.prisma.landingJob.create({
      data: {
        leadId,
        slug,
        status: 'queued',
        log: [] as Prisma.InputJsonValue,
        cancelRequested: false,
      },
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        landingStatus: 'generating',
        activeLandingJobId: row.id,
        landingSlug: slug,
        ...(config
          ? { generateConfig: config as Prisma.InputJsonValue }
          : {}),
      },
    });

    const event: LandingJobEvent = {
      stage: 'queued',
      message: `Job ${row.id} enfileirado para ${slug}`,
      at: new Date().toISOString(),
    };

    const updated = await this.prisma.landingJob.update({
      where: { id: row.id },
      data: {
        log: [event] as Prisma.InputJsonValue,
      },
    });

    if (config) this.configs.set(row.id, config);

    const job = this.toRuntime(updated);
    job.emitter.emit('event', event);
    return job;
  }

  async get(id: string): Promise<LandingJobRuntime> {
    const row = await this.prisma.landingJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Job ${id} não encontrado`);
    return this.toRuntime(row);
  }

  async emit(
    job: LandingJobRuntime,
    partial: Omit<LandingJobEvent, 'at'> & { at?: string },
  ) {
    const event: LandingJobEvent = {
      ...partial,
      at: partial.at || new Date().toISOString(),
    };
    job.status = event.stage;
    if (event.error) job.error = event.error;
    job.log.push(event);

    const updated = await this.prisma.landingJob.update({
      where: { id: job.id },
      data: {
        status: event.stage,
        error: job.error ?? null,
        log: job.log as unknown as Prisma.InputJsonValue,
      },
    });
    job.updatedAt = updated.updatedAt;

    if (TERMINAL.includes(event.stage)) {
      const landingStatus =
        event.stage === 'done' || event.stage === 'done_with_warnings'
          ? 'built'
          : event.stage === 'cancelled'
            ? 'cancelled'
            : event.stage === 'error' && /npm (install|run build)/i.test(event.error || event.message)
              ? 'build_failed'
              : 'error';

      await this.prisma.lead.update({
        where: { id: job.leadId },
        data: {
          landingStatus,
          activeLandingJobId: null,
          landingBuiltAt:
            landingStatus === 'built' ? new Date() : undefined,
        },
      });
    }

    job.emitter.emit('event', event);
  }

  async requestCancel(jobId: string): Promise<LandingJobRuntime> {
    const job = await this.get(jobId);
    if (TERMINAL.includes(job.status)) {
      return job;
    }
    await this.prisma.landingJob.update({
      where: { id: jobId },
      data: { cancelRequested: true },
    });
    job.cancelRequested = true;
    return job;
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    const row = await this.prisma.landingJob.findUnique({
      where: { id: jobId },
      select: { cancelRequested: true },
    });
    return Boolean(row?.cancelRequested);
  }

  toPublic(job: LandingJobRuntime) {
    return {
      id: job.id,
      leadId: job.leadId,
      slug: job.slug,
      status: job.status,
      log: job.log,
      error: job.error,
      cancelRequested: job.cancelRequested,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private toRuntime(row: {
    id: string;
    leadId: string;
    slug: string;
    status: string;
    log: Prisma.JsonValue;
    error: string | null;
    cancelRequested: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): LandingJobRuntime {
    let emitter = this.emitters.get(row.id);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(50);
      this.emitters.set(row.id, emitter);
    }

    return {
      id: row.id,
      leadId: row.leadId,
      slug: row.slug,
      status: row.status as LandingJobStage,
      log: Array.isArray(row.log) ? (row.log as LandingJobEvent[]) : [],
      error: row.error ?? undefined,
      cancelRequested: row.cancelRequested,
      emitter,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      config: this.configs.get(row.id),
    };
  }
}
