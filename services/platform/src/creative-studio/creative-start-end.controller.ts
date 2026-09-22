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
  CreativeStartEndService,
  type StartEndUploadFile,
} from './creative-start-end.service';
import { CreateStartEndClipDto, GenerateStartEndClipDto } from './dto/start-end.dto';

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('creative/inicio-fim')
export class CreativeStartEndController {
  constructor(private readonly clips: CreativeStartEndService) {}

  @Get()
  findAll() {
    return this.clips.findAll();
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'firstFrame', maxCount: 1 },
        { name: 'lastFrame', maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024 } },
    ),
  )
  create(
    @Body() dto: CreateStartEndClipDto,
    @UploadedFiles()
    files: {
      firstFrame?: StartEndUploadFile[];
      lastFrame?: StartEndUploadFile[];
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
  generate(@Param('id') id: string, @Body() dto: GenerateStartEndClipDto) {
    return this.clips.generate(id, dto);
  }
}
