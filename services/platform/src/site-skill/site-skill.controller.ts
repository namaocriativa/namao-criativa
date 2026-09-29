import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { SiteSkillService, type SiteSkillUpload } from './site-skill.service';

@StudioAuth()
@Controller('site-skill')
export class SiteSkillController {
  constructor(private readonly skill: SiteSkillService) {}

  @Get('estimate')
  estimate(@Query('model') model?: string) {
    return this.skill.estimate(model);
  }

  @Get('brief')
  brief(
    @CurrentUser() user: JwtUser,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.skill.briefFor(user, leadId, customerId);
  }

  @Post('propose')
  propose(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      leadId?: string;
      customerId?: string;
      objective?: string;
      objectiveNote?: string;
    },
  ) {
    return this.skill.propose({
      user,
      leadId: body.leadId,
      customerId: body.customerId,
      objective: body.objective,
      objectiveNote: body.objectiveNote,
    });
  }

  @Get('jobs/:id')
  job(@Param('id') id: string) {
    return this.skill.findJob(id);
  }

  @Post('generate')
  @UseInterceptors(
    FilesInterceptor('files', 12, { limits: { fileSize: 16 * 1024 * 1024 } }),
  )
  generate(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      leadId?: string;
      customerId?: string;
      model?: string;
      notes?: string;
      imageIds?: string | string[];
      brief?: string;
    },
    @UploadedFiles() files: SiteSkillUpload[],
  ) {
    const imageIds = Array.isArray(body.imageIds)
      ? body.imageIds
      : typeof body.imageIds === 'string' && body.imageIds
        ? body.imageIds
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
    return this.skill.start({
      user,
      leadId: body.leadId,
      customerId: body.customerId,
      model: body.model,
      notes: body.notes,
      brief: body.brief,
      imageIds,
      uploads: files || [],
    });
  }
}
