import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StudioActivityInterceptor } from './studio-activity.interceptor';
import { StudioActivityService } from './studio-activity.service';

@Module({
  providers: [
    StudioActivityService,
    StudioActivityInterceptor,
    { provide: APP_INTERCEPTOR, useClass: StudioActivityInterceptor },
  ],
  exports: [StudioActivityService],
})
export class StudioActivityModule {}
