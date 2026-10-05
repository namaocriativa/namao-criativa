import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const HEX = /^#([0-9a-fA-F]{6})$/;

export class UpdateBrandIdentityDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  logoImageId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX, { message: 'primaryColor deve ser #RRGGBB' })
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX, { message: 'secondaryColor deve ser #RRGGBB' })
  secondaryColor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX, { message: 'accentColor deve ser #RRGGBB' })
  accentColor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX, { message: 'backgroundColor deve ser #RRGGBB' })
  backgroundColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  headingFont?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bodyFont?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  voice?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  logoAppearance?: string | null;
}
