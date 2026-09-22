import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class GenerateFlyerDto {
  @IsString()
  @MaxLength(80)
  leadId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @Type(() => String)
  packageIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
