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
import { CreateCalendarReminderDto } from './dto/create-calendar-reminder.dto';
import { UpdateCalendarReminderDto } from './dto/update-calendar-reminder.dto';
import { AttachStudioAssetDto } from './dto/attach-studio-asset.dto';
import {
  CalendarIdeasQueryDto,
  CalendarPostsFromIdeasDto,
} from './dto/calendar-ideas.dto';
import { CalendarPostFromCarouselDto } from './dto/calendar-from-carousel.dto';
import type { CalendarOwnerQuery } from './calendar.service';

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

  @Get('items')
  findItems(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.calendar.findItems(from, to, ownerQuery(leadId, customerId));
  }

  @Get('posts')
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.calendar.findRange(from, to, ownerQuery(leadId, customerId));
  }

  @Get('reminders')
  findReminders(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.calendar.findReminders(from, to, ownerQuery(leadId, customerId));
  }

  @Post('reminders')
  createReminder(
    @Body() dto: CreateCalendarReminderDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.calendar.createReminder(dto, user.id);
  }

  @Get('reminders/:id')
  findReminder(@Param('id') id: string) {
    return this.calendar.findReminderById(id);
  }

  @Patch('reminders/:id')
  updateReminder(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarReminderDto,
  ) {
    return this.calendar.updateReminder(id, dto);
  }

  @Delete('reminders/:id')
  removeReminder(@Param('id') id: string) {
    return this.calendar.removeReminder(id);
  }

  @Post('ideas')
  generateIdeas(
    @Body() dto: CalendarIdeasQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.calendar.generateIdeas(dto, user);
  }

  @Post('posts/from-ideas')
  createFromIdeas(
    @Body() dto: CalendarPostsFromIdeasDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.calendar.createFromIdeas(dto, user.id);
  }

  @Post('posts/from-carousel')
  createFromCarousel(
    @Body() dto: CalendarPostFromCarouselDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.calendar.createFromCarousel(dto, user);
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

function ownerQuery(leadId?: string, customerId?: string): CalendarOwnerQuery {
  return { leadId, customerId };
}
