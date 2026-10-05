import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { VideoEditController } from './video-edit.controller';
import { VideoEditService } from './video-edit.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [VideoEditController],
  providers: [VideoEditService],
  exports: [VideoEditService],
})
export class VideoEditModule {}
