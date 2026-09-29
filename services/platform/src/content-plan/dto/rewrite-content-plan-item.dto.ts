import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RewriteContentPlanItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(800)
  note!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;
}
