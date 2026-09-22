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
import { CreateImageProjectDto } from './dto/create-image-project.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { UpdateImageProjectDto } from './dto/update-image-project.dto';
import { listImageModelsPayload } from './image-models';
import {
  ImageStudioService,
  type ImageUploadFile,
} from './image-studio.service';

@StudioPermission(STUDIO_PERMISSION.IMAGES)
@Controller('image-models')
export class ImageModelsController {
  @Get()
  list() {
    return listImageModelsPayload();
  }
}

@StudioPermission(STUDIO_PERMISSION.IMAGES)
@Controller('image-projects')
export class ImageStudioController {
  constructor(private readonly imageStudio: ImageStudioService) {}

  @Get()
  findAll() {
    return this.imageStudio.findAll();
  }

  @Post()
  create(@Body() dto: CreateImageProjectDto, @CurrentUser() user: JwtUser) {
    return this.imageStudio.create(dto, user.id);
  }

  @Get('library')
  library() {
    return this.imageStudio.library();
  }

  @Get(':id/messages')
  listMessages(@Param('id') id: string) {
    return this.imageStudio.listMessages(id);
  }

  @Get(':id/gallery')
  gallery(@Param('id') id: string) {
    return this.imageStudio.gallery(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imageStudio.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateImageProjectDto) {
    return this.imageStudio.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imageStudio.deleteById(id);
  }

  @Post(':id/generate')
  generate(@Param('id') id: string, @Body() dto: GenerateImageDto) {
    return this.imageStudio.generate(id, dto);
  }

  @Post(':id/references')
  @UseInterceptors(
    FilesInterceptor('files', 14, {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadReferences(
    @Param('id') id: string,
    @UploadedFiles() files: ImageUploadFile[],
  ) {
    return this.imageStudio.addReferences(id, files ?? []);
  }

  @Delete(':id/assets/:assetId')
  removeAsset(@Param('id') id: string, @Param('assetId') assetId: string) {
    return this.imageStudio.deleteAsset(id, assetId);
  }
}
