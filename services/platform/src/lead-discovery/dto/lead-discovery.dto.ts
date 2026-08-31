import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const DISCOVERY_LIMIT_DEFAULT = 100;
export const DISCOVERY_LIMIT_MAX = 500;
export const DISCOVERY_RADIUS_DEFAULT = 5;
export const DISCOVERY_RADIUS_MIN = 0.5;
export const DISCOVERY_RADIUS_MAX = 30;

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class LeadDiscoveryDto {
  @IsString()
  @MinLength(1)
  city!: string;

  @IsString()
  @MinLength(1)
  state!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(DISCOVERY_RADIUS_MIN)
  @Max(DISCOVERY_RADIUS_MAX)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCOVERY_LIMIT_MAX)
  limit?: number;
}
