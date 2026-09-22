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
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdateOfferTemplateDto } from './dto/update-offer-template.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PackagesService, type PackageUploadFile } from './packages.service';
import { StudioAuth } from '../auth/studio-auth.decorator';

@StudioAuth()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  findAll() {
    return this.packagesService.findAll();
  }

  @Get('offer-template')
  getOfferTemplate() {
    return this.packagesService.getOfferTemplate();
  }

  @Patch('offer-template')
  updateOfferTemplate(@Body() dto: UpdateOfferTemplateDto) {
    return this.packagesService.updateOfferTemplate(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePackageDto) {
    return this.packagesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packagesService.deleteById(id);
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: PackageUploadFile[],
  ) {
    return this.packagesService.addImages(id, files ?? []);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.packagesService.deleteImage(id, imageId);
  }
}
