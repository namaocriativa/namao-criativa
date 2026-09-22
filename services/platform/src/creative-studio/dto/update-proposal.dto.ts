import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCreativeProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

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
  @IsArray()
  @IsString({ each: true })
  referenceAssetIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadImageIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  leadLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  thinkingLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstFrameImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastFrameImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstFrameAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastFrameAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  characterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rationale?: string;
}
