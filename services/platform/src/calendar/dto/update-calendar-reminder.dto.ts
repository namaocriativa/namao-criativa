import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CALENDAR_REMINDER_STATUSES } from '../calendar.reminders';

export class UpdateCalendarReminderDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsIn([...CALENDAR_REMINDER_STATUSES])
  status?: (typeof CALENDAR_REMINDER_STATUSES)[number];
}
