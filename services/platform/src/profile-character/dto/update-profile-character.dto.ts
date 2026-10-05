import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileCharacterDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  characterId?: string | null;
}
