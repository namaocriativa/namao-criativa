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

export class CreateCalendarPostDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CALENDAR_PLATFORMS, { each: true })
  platforms!: string[];

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
