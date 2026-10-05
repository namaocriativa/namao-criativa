import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BrandIdentityService } from './brand-identity.service';

@Module({
  imports: [StorageModule],
  providers: [BrandIdentityService],
  exports: [BrandIdentityService],
})
export class BrandIdentityModule {}
