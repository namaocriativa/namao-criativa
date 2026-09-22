import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import {
  STUDIO_PERMISSION,
  StudioPermission,
} from '../auth/studio-permission.decorator';
import { CreativeMovieService } from './creative-movie.service';
import {
  CreateMovieDto,
  CreateMovieShotDto,
  GenerateMovieShotDto,
  UpdateMovieDto,
  UpdateMovieShotDto,
} from './dto/movie.dto';

@StudioPermission(STUDIO_PERMISSION.VIDEOS)
@Controller('creative/movies')
export class CreativeMovieController {
  constructor(private readonly movies: CreativeMovieService) {}

  @Get()
  findAll() {
    return this.movies.findAll();
  }

  @Post()
  create(@Body() dto: CreateMovieDto, @CurrentUser() user: JwtUser) {
    return this.movies.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.movies.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMovieDto) {
    return this.movies.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.movies.deleteById(id);
  }

  @Post(':id/shots')
  addShot(@Param('id') id: string, @Body() dto: CreateMovieShotDto) {
    return this.movies.addShot(id, dto);
  }

  @Patch(':id/shots/:shotId')
  updateShot(
    @Param('id') id: string,
    @Param('shotId') shotId: string,
    @Body() dto: UpdateMovieShotDto,
  ) {
    return this.movies.updateShot(id, shotId, dto);
  }

  @Delete(':id/shots/:shotId')
  removeShot(@Param('id') id: string, @Param('shotId') shotId: string) {
    return this.movies.deleteShot(id, shotId);
  }

  @Post(':id/shots/:shotId/generate')
  generateShot(
    @Param('id') id: string,
    @Param('shotId') shotId: string,
    @Body() dto: GenerateMovieShotDto,
  ) {
    return this.movies.generateShot(id, shotId, dto);
  }
}
