import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CALENDAR_PLATFORMS } from '../calendar.platforms';
import { CALENDAR_IDEA_FORMATS } from '../calendar-ideas.planner';

export class CalendarIdeasQueryDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class CalendarIdeaInputDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(280)
  hook!: string;

  @IsString()
  @MaxLength(2200)
  caption!: string;

  @IsIn(CALENDAR_IDEA_FORMATS)
  format!: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  commentKeyword?: string;
}

export class CalendarPostsFromIdeasDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CALENDAR_PLATFORMS, { each: true })
  platforms?: string[];

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CalendarIdeaInputDto)
  ideas!: CalendarIdeaInputDto[];
}
