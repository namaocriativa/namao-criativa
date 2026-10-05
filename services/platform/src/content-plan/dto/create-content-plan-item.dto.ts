import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1' || text === 'on') return true;
  if (text === 'false' || text === '0' || text === 'off') return false;
  return undefined;
}

export class CreateContentPlanItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  imageModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  imageSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  videoModel?: string;

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
  @MaxLength(64)
  characterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  characterAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  takeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slides?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  useBrandIdentity?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  useBrandLogo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  logoAppearance?: string;
}
