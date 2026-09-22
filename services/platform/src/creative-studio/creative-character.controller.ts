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
  STUDIO_PERMISSION,
  StudioPermission,
} from '../auth/studio-permission.decorator';
import {
  CreativeCharacterService,
  type CharacterUploadFile,
} from './creative-character.service';
import {
  CreateCharacterDto,
  GenerateCharacterPhotoDto,
  GenerateCharacterVideoDto,
  UpdateCharacterDto,
} from './dto/character.dto';

@StudioPermission(STUDIO_PERMISSION.IMAGES)
@Controller('creative/characters')
export class CreativeCharacterController {
  constructor(private readonly characters: CreativeCharacterService) {}

  @Get()
  @StudioPermission(STUDIO_PERMISSION.IMAGES, STUDIO_PERMISSION.VIDEOS)
  findAll() {
    return this.characters.findAll();
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 8, {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  create(
    @Body() dto: CreateCharacterDto,
    @UploadedFiles() files: CharacterUploadFile[],
    @CurrentUser() user: JwtUser,
  ) {
    return this.characters.create(dto, files ?? [], user.id);
  }

  @Get(':id')
  @StudioPermission(STUDIO_PERMISSION.IMAGES, STUDIO_PERMISSION.VIDEOS)
  findOne(@Param('id') id: string) {
    return this.characters.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCharacterDto) {
    return this.characters.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.characters.deleteById(id);
  }

  @Post(':id/photos')
  generatePhoto(
    @Param('id') id: string,
    @Body() dto: GenerateCharacterPhotoDto,
  ) {
    return this.characters.generatePhoto(id, dto);
  }

  @Post(':id/videos')
  @StudioPermission(STUDIO_PERMISSION.VIDEOS)
  generateVideo(
    @Param('id') id: string,
    @Body() dto: GenerateCharacterVideoDto,
  ) {
    return this.characters.generateVideo(id, dto);
  }
}
