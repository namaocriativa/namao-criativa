import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CalendarService, type CalendarUploadFile } from './calendar.service';
import { CalendarPublisher } from './calendar.publisher';
import { CreateCalendarPostDto } from './dto/create-calendar-post.dto';
import { UpdateCalendarPostDto } from './dto/update-calendar-post.dto';
import { AttachStudioAssetDto } from './dto/attach-studio-asset.dto';

@StudioAuth()
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly publisher: CalendarPublisher,
  ) {}

  @Get('automation')
  automation() {
    return this.publisher.capabilities();
  }

  @Get('posts')
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.calendar.findRange(from, to);
  }

  @Post('posts')
  create(@Body() dto: CreateCalendarPostDto, @CurrentUser() user: JwtUser) {
    return this.calendar.create(dto, user.id);
  }

  @Get('posts/:id')
  findOne(@Param('id') id: string) {
    return this.calendar.findById(id);
  }

  @Patch('posts/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCalendarPostDto) {
    return this.calendar.update(id, dto);
  }

  @Delete('posts/:id')
  remove(@Param('id') id: string) {
    return this.calendar.remove(id);
  }

  @Post('posts/:id/assets')
  @UseInterceptors(
    FilesInterceptor('files', 8, {
      limits: { fileSize: 32 * 1024 * 1024 },
    }),
  )
  uploadAssets(
    @Param('id') id: string,
    @UploadedFiles() files: CalendarUploadFile[],
  ) {
    return this.calendar.addUploads(id, files ?? []);
  }

  @Post('posts/:id/assets/from-studio')
  attachStudio(@Param('id') id: string, @Body() dto: AttachStudioAssetDto) {
    return this.calendar.attachStudioAsset(id, dto);
  }

  @Delete('posts/:id/assets/:assetId')
  removeAsset(@Param('id') id: string, @Param('assetId') assetId: string) {
    return this.calendar.removeAsset(id, assetId);
  }

  @Post('posts/:id/schedule')
  schedule(@Param('id') id: string) {
    return this.calendar.schedule(id);
  }

  @Post('posts/:id/publish')
  publishNow(@Param('id') id: string) {
    return this.publisher.publishPost(id);
  }

  @Post('posts/:id/targets/:targetId/mark-published')
  markPublished(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() body: { permalink?: string },
  ) {
    return this.calendar.markTargetPublished(id, targetId, body?.permalink);
  }
}
