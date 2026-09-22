import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import {
  StudioPermission,
  STUDIO_PERMISSION,
} from '../auth/studio-permission.decorator';
import { CreateVideoProjectDto } from './dto/create-video-project.dto';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { UpdateVideoProjectDto } from './dto/update-video-project.dto';
import { UploadVideoFrameDto } from './dto/upload-video-frame.dto';
import { listVideoModelsPayload } from './video-models';
import {
  VideoStudioService,
  type VideoUploadFile,
} from './video-studio.service';

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('video-models')
export class VideoModelsController {
  @Get()
  list() {
    return listVideoModelsPayload();
  }
}

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('video-projects')
export class VideoStudioController {
  constructor(private readonly videoStudio: VideoStudioService) {}

  @Get()
  findAll() {
    return this.videoStudio.findAll();
  }

  @Post()
  create(@Body() dto: CreateVideoProjectDto, @CurrentUser() user: JwtUser) {
    return this.videoStudio.create(dto, user.id);
  }

  @Get('library')
  library() {
    return this.videoStudio.library();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videoStudio.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVideoProjectDto) {
    return this.videoStudio.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videoStudio.deleteById(id);
  }

  @Post(':id/generate')
  generate(@Param('id') id: string, @Body() dto: GenerateVideoDto) {
    return this.videoStudio.generate(id, dto);
  }

  @Post(':id/frames')
  @UseInterceptors(
    FilesInterceptor('files', 2, {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadFrames(
    @Param('id') id: string,
    @UploadedFiles() files: VideoUploadFile[],
    @Body() dto: UploadVideoFrameDto,
  ) {
    return this.videoStudio.addFrames(id, dto.slot, files ?? []);
  }

  @Delete(':id/assets/:assetId')
  removeAsset(@Param('id') id: string, @Param('assetId') assetId: string) {
    return this.videoStudio.deleteAsset(id, assetId);
  }
}
