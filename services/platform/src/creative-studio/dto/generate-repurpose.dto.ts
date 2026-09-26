import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateRepurposeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  characterId?: string;
}
