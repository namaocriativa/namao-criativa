import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { ContentPlanService } from './content-plan.service';
import { GenerateContentPlanDto } from './dto/generate-content-plan.dto';
import { CreateContentPlanItemDto } from './dto/create-content-plan-item.dto';
import { RewriteContentPlanItemDto } from './dto/rewrite-content-plan-item.dto';
import { SelectContentPlanItemsDto } from './dto/select-content-plan-items.dto';
import { SelectContentPlanMediaDto } from './dto/select-content-plan-media.dto';
import { BreakContentPlanTakesDto } from './dto/break-content-plan-takes.dto';
import { listVideoHooks } from './video-hooks';

@StudioAuth()
@Controller('content-plan')
export class ContentPlanController {
  constructor(private readonly plans: ContentPlanService) {}

  @Get('open')
  open(
    @CurrentUser() user: JwtUser,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.plans.open(user, leadId, customerId);
  }

  @Get('video-hooks')
  videoHooks() {
    return listVideoHooks();
  }

  @Get('estimate')
  estimate(
    @Query('format') format?: string,
    @Query('slides') slides?: string,
    @Query('planModel') planModel?: string,
    @Query('imageModel') imageModel?: string,
    @Query('imageSize') imageSize?: string,
    @Query('videoModel') videoModel?: string,
    @Query('duration') duration?: string,
    @Query('resolution') resolution?: string,
    @Query('takes') takes?: string,
  ) {
    return this.plans.estimate({
      format,
      slides,
      planModel,
      imageModel,
      imageSize,
      videoModel,
      duration,
      resolution,
      takes,
    });
  }

  @Post('generate')
  generate(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateContentPlanDto,
  ) {
    return this.plans.generate(dto, user);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.plans.confirm(id, user);
  }

  @Post(':id/discard')
  discard(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.plans.discard(id, user);
  }

  @Patch(':id/items')
  selectItems(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SelectContentPlanItemsDto,
  ) {
    return this.plans.selectItems(id, dto, user);
  }

  @Post(':id/items/:itemId/rewrite')
  rewriteItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: RewriteContentPlanItemDto,
  ) {
    return this.plans.rewriteItem(id, itemId, dto, user);
  }

  @Post(':id/items/:itemId/create')
  createItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateContentPlanItemDto,
  ) {
    return this.plans.createItem(id, itemId, user, dto);
  }

  @Post(':id/items/:itemId/break-takes')
  breakItemTakes(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: BreakContentPlanTakesDto,
  ) {
    return this.plans.breakItemTakes(id, itemId, dto, user);
  }

  @Patch(':id/items/:itemId/media')
  selectItemMedia(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SelectContentPlanMediaDto,
  ) {
    return this.plans.selectItemMedia(id, itemId, dto, user);
  }

  @Post(':id/items/:itemId/schedule')
  scheduleItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.plans.scheduleItem(id, itemId, user);
  }
}
