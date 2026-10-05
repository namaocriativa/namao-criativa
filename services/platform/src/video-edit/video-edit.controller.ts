import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import {
  STUDIO_PERMISSION,
  StudioPermission,
} from '../auth/studio-permission.decorator';
import { CreateVideoEditDto, UpdateVideoEditDto } from './dto/video-edit.dto';
import {
  VideoEditService,
  type VideoEditUploadFile,
} from './video-edit.service';

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('video-edits')
export class VideoEditController {
  constructor(private readonly videoEdits: VideoEditService) {}

  @Get('library-sources')
  librarySources() {
    return this.videoEdits.librarySources();
  }

  @Get()
  findAll() {
    return this.videoEdits.findAll();
  }

  @Post()
  create(@Body() dto: CreateVideoEditDto, @CurrentUser() user: JwtUser) {
    return this.videoEdits.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videoEdits.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVideoEditDto) {
    return this.videoEdits.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videoEdits.remove(id);
  }

  @Post(':id/media')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: VideoEditUploadFile,
  ) {
    return this.videoEdits.uploadMedia(id, file);
  }

  @Post(':id/exports')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  saveExport(
    @Param('id') id: string,
    @UploadedFile() file: VideoEditUploadFile,
  ) {
    return this.videoEdits.saveExport(id, file);
  }
}
