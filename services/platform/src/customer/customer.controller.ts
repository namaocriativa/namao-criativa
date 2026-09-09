import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { LeadAccountService } from '../lead-account/lead-account.service';
import { LeadActivityService } from '../lead-activity/lead-activity.service';
import { LeadMailService } from '../lead-mail/lead-mail.service';
import { SendLeadWhatsAppDto } from '../lead-whatsapp/dto/send-lead-whatsapp.dto';
import { LeadWhatsAppService } from '../lead-whatsapp/lead-whatsapp.service';
import { UpdateLeadDto } from '../lead/dto/update-lead.dto';
import { type LeadUploadFile } from '../lead/lead.service';
import { CustomerService } from './customer.service';

@Controller('customers')
export class CustomerController {
  constructor(
    private readonly customers: CustomerService,
    private readonly accounts: LeadAccountService,
    private readonly mail: LeadMailService,
    private readonly whatsapp: LeadWhatsAppService,
    private readonly activity: LeadActivityService,
  ) {}

  @Get()
  findAll() {
    return this.customers.findAll();
  }

  @Get(':id/account')
  getAccount(@Param('id') id: string) {
    return this.accounts.getAccount(id);
  }

  @Post(':id/account/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.accounts.resetPassword(id);
  }

  @Post(':id/account/send-password')
  sendPassword(@Param('id') id: string) {
    return this.accounts.sendPassword(id);
  }

  @Get(':id/emails')
  listEmails(@Param('id') id: string) {
    return this.mail.list(id);
  }

  @Get(':id/emails/:kind/preview')
  previewEmail(@Param('id') id: string, @Param('kind') kind: string) {
    return this.mail.preview(id, kind);
  }

  @Post(':id/emails/:kind')
  sendEmail(@Param('id') id: string, @Param('kind') kind: string) {
    return this.mail.send(id, kind);
  }

  @Get(':id/whatsapp')
  listWhatsApp(@Param('id') id: string) {
    return this.whatsapp.list(id);
  }

  @Get(':id/whatsapp/:kind/preview')
  previewWhatsApp(@Param('id') id: string, @Param('kind') kind: string) {
    return this.whatsapp.preview(id, kind);
  }

  @Post(':id/whatsapp/:kind')
  sendWhatsApp(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Body() dto: SendLeadWhatsAppDto,
  ) {
    return this.whatsapp.send(id, kind, dto?.text);
  }

  @Get(':id/history')
  listHistory(@Param('id') id: string) {
    return this.activity.listHistory(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.customers.update(id, dto);
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: LeadUploadFile[],
  ) {
    return this.customers.addImages(id, files ?? []);
  }

  @Get(':id/videos')
  listVideos(@Param('id') id: string) {
    return this.customers.listVideos(id);
  }

  @Post(':id/videos')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 40 * 1024 * 1024 },
    }),
  )
  uploadVideo(
    @Param('id') id: string,
    @Query('slot') slot: string,
    @UploadedFile() file: LeadUploadFile,
  ) {
    return this.customers.addVideo(id, file, slot);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.customers.deleteImage(id, imageId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customers.deleteById(id);
  }
}
