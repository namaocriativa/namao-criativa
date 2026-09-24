import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import {
  STUDIO_PERMISSION,
  StudioPermission,
} from '../auth/studio-permission.decorator';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CreativeStudioService } from './creative-studio.service';
import { GenerateCarouselDto } from './dto/generate-carousel.dto';
import { GenerateFlyerDto } from './dto/generate-flyer.dto';

@StudioAuth()
@Controller('creative')
export class CreativeStudioController {
  constructor(private readonly creativeStudio: CreativeStudioService) {}

  @Get('features')
  listFeatures() {
    return this.creativeStudio.listFeatures();
  }

  @Post('features/flyer-venda-landing/generate')
  @StudioPermission(STUDIO_PERMISSION.IMAGES)
  generateFlyer(
    @Body() dto: GenerateFlyerDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.creativeStudio.generateFlyer(dto, user);
  }

  @Post('features/carousel-instagram/generate')
  @StudioPermission(STUDIO_PERMISSION.IMAGES)
  generateCarousel(
    @Body() dto: GenerateCarouselDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.creativeStudio.generateCarousel(dto, user);
  }
}
