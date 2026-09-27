import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class AiBudgetItemDto {
  @IsIn(['tenant', 'user', 'lead'])
  scope!: 'tenant' | 'user' | 'lead';

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsNumber()
  @Min(0)
  monthlyLimitUsd!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  warnPercent?: number;
}

export class SaveAiBudgetsDto {
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => AiBudgetItemDto)
  items!: AiBudgetItemDto[];
}
