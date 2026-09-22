import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import {
  STUDIO_PERMISSION,
  StudioPermission,
} from '../auth/studio-permission.decorator';
import {
  CreativeUgcService,
  type UgcUploadFile,
} from './creative-ugc.service';
import { CreateUgcClipDto, GenerateUgcClipDto } from './dto/ugc-clip.dto';

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('creative/ugc-skills')
export class CreativeUgcController {
  constructor(private readonly clips: CreativeUgcService) {}

  @Get()
  findAll() {
    return this.clips.findAll();
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'product', maxCount: 1 }], {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  create(
    @Body() dto: CreateUgcClipDto,
    @UploadedFiles()
    files: {
      product?: UgcUploadFile[];
    },
    @CurrentUser() user: JwtUser,
  ) {
    return this.clips.create(dto, files ?? {}, user.id);
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
  generate(@Param('id') id: string, @Body() dto: GenerateUgcClipDto) {
    return this.clips.generate(id, dto);
  }
}
