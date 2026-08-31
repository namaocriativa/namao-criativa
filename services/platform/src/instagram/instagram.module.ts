import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { InstagramController } from './instagram.controller';
import { InstagramGraphClient } from './instagram-graph.client';
import { InstagramService } from './instagram.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [InstagramController],
  providers: [InstagramGraphClient, InstagramService],
  exports: [InstagramService, InstagramGraphClient],
})
export class InstagramModule {}
