import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { InstagramModule } from '../instagram/instagram.module';
import { CalendarController } from './calendar.controller';
import { CalendarPublicController } from './calendar-public.controller';
import { CalendarService } from './calendar.service';
import { CalendarPublisher } from './calendar.publisher';

@Module({
  imports: [AuthModule, StorageModule, InstagramModule],
  controllers: [CalendarController, CalendarPublicController],
  providers: [CalendarService, CalendarPublisher],
  exports: [CalendarService, CalendarPublisher],
})
export class CalendarModule {}
