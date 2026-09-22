import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { verifyCalendarAssetSig } from './calendar.public-url';

@Public()
@Controller('public/calendar-assets')
export class CalendarPublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  @Get(':id')
  @Header('Cache-Control', 'private, max-age=120')
  async serve(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
  ) {
    const secret = this.config.get<string>('JWT_SECRET')?.trim() || '';
    if (
      !verifyCalendarAssetSig({
        assetId: id,
        exp,
        sig,
        secret,
      })
    ) {
      throw new ForbiddenException('Link de mídia inválido ou expirado');
    }
    const asset = await this.prisma.contentCalendarAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('Mídia não encontrada');
    const buffer = await this.storage.readStorageFile(asset.localPath);
    if (!buffer) throw new NotFoundException('Arquivo não está no disco');
    return new StreamableFile(buffer, {
      type: asset.mimeType || 'application/octet-stream',
      disposition: `inline; filename="${asset.filename}"`,
    });
  }
}
