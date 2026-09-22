import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateImageProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  imageSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemInstruction?: string;

  @IsOptional()
  @IsBoolean()
  googleSearch?: boolean;

  @IsOptional()
  @IsBoolean()
  imageSearch?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  personGeneration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  thinkingLevel?: string;

  @IsOptional()
  @IsBoolean()
  includeThoughts?: boolean;
}
