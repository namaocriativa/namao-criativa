import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CALENDAR_PLATFORMS } from '../calendar.platforms';

export class UpdateCalendarPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CALENDAR_PLATFORMS, { each: true })
  platforms?: string[];

  @IsOptional()
  @IsString()
  leadId?: string | null;

  @IsOptional()
  @IsString()
  customerId?: string | null;
}
