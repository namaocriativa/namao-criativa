import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import {
  STUDIO_PERMISSION,
  StudioPermission,
} from '../auth/studio-permission.decorator';
import { CreativeVideoLivreService } from './creative-video-livre.service';
import {
  BreakVideoLivreDto,
  CreateVideoLivreClipDto,
  GenerateVideoLivreClipDto,
  RefineVideoLivreDto,
} from './dto/video-livre.dto';

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('creative/video-livre')
export class CreativeVideoLivreController {
  constructor(private readonly clips: CreativeVideoLivreService) {}

  @Get('hooks')
  hooks() {
    return this.clips.listHooks();
  }

  @Get()
  findAll() {
    return this.clips.findAll();
  }

  @Post('refine')
  refine(@Body() dto: RefineVideoLivreDto, @CurrentUser() user: JwtUser) {
    return this.clips.refine(dto, user.id);
  }

  @Post('break')
  breakTakes(@Body() dto: BreakVideoLivreDto, @CurrentUser() user: JwtUser) {
    return this.clips.breakTakes(dto, user.id);
  }

  @Post()
  create(@Body() dto: CreateVideoLivreClipDto, @CurrentUser() user: JwtUser) {
    return this.clips.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clips.findById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clips.deleteById(id);
  }

  @Post(':id/generate')
  generate(
    @Param('id') id: string,
    @Body() dto: GenerateVideoLivreClipDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.clips.generate(id, dto, user.id);
  }
}
