import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Next,
  NotFoundException,
  Param,
  Post,
  Res,
  Sse,
} from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { existsSync, statSync } from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs';
import { LeadIdDto } from './dto/lead-id.dto';
import { GenerateLandingDto } from './dto/generate-landing.dto';
import { RateGenerationDto } from './dto/rate-generation.dto';
import { LandingJobEvent } from './landing-jobs.service';
import { LandingService } from './landing.service';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';

@StudioAuth()
@Controller('landing')
export class LandingController {
  constructor(
    private readonly landingService: LandingService,
    private readonly access: StudioLeadAccessService,
  ) {}

  @Get('status')
  status() {
    return this.landingService.status();
  }

  @Get('generator-options')
  generatorOptions() {
    return this.landingService.generatorOptions();
  }

  @Post('scaffold')
  async scaffold(@Body() dto: LeadIdDto, @CurrentUser() user: JwtUser) {
    await this.access.assertCanAccess(user, dto.leadId);
    return this.landingService.scaffold(dto.leadId);
  }

  @Post('prompt')
  async prompt(@Body() dto: LeadIdDto, @CurrentUser() user: JwtUser) {
    await this.access.assertCanAccess(user, dto.leadId);
    return this.landingService.prompt(dto.leadId);
  }

  @Post('publish')
  async publish(@Body() dto: LeadIdDto, @CurrentUser() user: JwtUser) {
    await this.access.assertCanAccess(user, dto.leadId);
    return this.landingService.publish(dto.leadId);
  }

  @Post('generate')
  async generate(
    @Body() dto: GenerateLandingDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.access.assertCanAccess(user, dto.leadId);
    return this.landingService.startGenerate(dto);
  }

  @Post('generations/:id/rating')
  rateGeneration(
    @Param('id') id: string,
    @Body() dto: RateGenerationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.landingService.rateGeneration(id, dto.rating, user);
  }

  @Get('generations')
  listGenerations(@CurrentUser() user: JwtUser) {
    return this.landingService.listGenerations(user);
  }

  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string, @CurrentUser() user: JwtUser) {
    const job = await this.landingService.getJobPublic(jobId);
    await this.access.assertCanAccess(user, job.leadId);
    return job;
  }

  @Post('jobs/:jobId/cancel')
  async cancel(@Param('jobId') jobId: string, @CurrentUser() user: JwtUser) {
    const job = await this.landingService.getJobPublic(jobId);
    await this.access.assertCanAccess(user, job.leadId);
    return this.landingService.cancelJob(jobId);
  }

  @Post('local/:leadId')
  async startLocal(
    @Param('leadId') leadId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.access.assertCanAccess(user, leadId);
    return this.landingService.startLocal(leadId);
  }

  @Delete('site/:leadId')
  async deleteSite(
    @Param('leadId') leadId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.access.assertCanAccess(user, leadId);
    return this.landingService.deleteSite(leadId);
  }

  @Get('preview/:leadId')
  async previewRoot(
    @Param('leadId') leadId: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    await this.access.assertCanAccess(user, leadId);
    return this.sendPreviewFile(leadId, 'index.html', res);
  }

  @Get('preview/:leadId/*splat')
  async previewSplat(
    @Param('leadId') leadId: string,
    @Param('splat') splat: string | string[],
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      await this.access.assertCanAccess(user, leadId);
      const relative = Array.isArray(splat)
        ? splat.join('/')
        : String(splat || 'index.html');
      return await this.sendPreviewFile(leadId, relative, res);
    } catch (error) {
      return next(error);
    }
  }

  @Sse('jobs/:jobId/events')
  events(
    @Param('jobId') jobId: string,
    @CurrentUser() user: JwtUser,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let cleanup = () => undefined;

      void (async () => {
        try {
          const job = await this.landingService.getJob(jobId);
          await this.access.assertCanAccess(user, job.leadId);

          for (const past of job.log) {
            subscriber.next({ data: past });
          }

          if (
            job.status === 'done' ||
            job.status === 'done_with_warnings' ||
            job.status === 'error' ||
            job.status === 'cancelled'
          ) {
            subscriber.complete();
            return;
          }

          const onEvent = (event: LandingJobEvent) => {
            subscriber.next({ data: event });
            if (
              event.stage === 'done' ||
              event.stage === 'done_with_warnings' ||
              event.stage === 'error' ||
              event.stage === 'cancelled'
            ) {
              subscriber.complete();
            }
          };

          job.emitter.on('event', onEvent);
          cleanup = () => {
            job.emitter.off('event', onEvent);
          };
        } catch (error) {
          subscriber.error(error);
        }
      })();

      return () => cleanup();
    });
  }

  private async sendPreviewFile(
    leadId: string,
    relative: string,
    res: Response,
  ) {
    const meta = await this.landingService.getPreviewMeta(leadId);
    const safeRel = relative.replace(/^\/+/, '') || 'index.html';
    if (safeRel.includes('..')) {
      throw new NotFoundException('Invalid path');
    }
    const filePath = path.resolve(path.join(meta.distDir, safeRel));
    if (!filePath.startsWith(path.resolve(meta.distDir))) {
      throw new NotFoundException('Invalid path');
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      const fallback = path.join(meta.distDir, 'index.html');
      if (existsSync(fallback) && (safeRel === '' || safeRel === 'index.html')) {
        return res.sendFile(fallback);
      }
      throw new NotFoundException(`Arquivo não encontrado: ${safeRel}`);
    }
    return res.sendFile(filePath);
  }
}
