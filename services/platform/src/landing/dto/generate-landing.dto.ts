import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { COLOR_INTENSITY_IDS } from '@namao/landing-kit';

export class SectionMediaDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  video?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  portraitVideo?: string;
}

export class LandingSectionConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  component?: string;

  @IsOptional()
  @IsBoolean()
  stockVideo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SectionMediaDto)
  media?: SectionMediaDto;
}

export class SelectedUiComponentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  component!: string;

  @IsOptional()
  @IsObject()
  props?: Record<string, string | number | boolean>;

  @IsString()
  @MaxLength(20_000)
  html!: string;

  @IsString()
  @MaxLength(20_000)
  css!: string;

  @IsString()
  @MaxLength(20_000)
  js!: string;
}

export class CopywriterBriefDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  services?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class LandingFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  id!: string;

  @IsOptional()
  @IsObject()
  props?: Record<string, string | number | boolean>;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export class ThemeColorsDto {
  @IsString()
  @Matches(HEX6)
  ink!: string;

  @IsString()
  @Matches(HEX6)
  paper!: string;

  @IsString()
  @Matches(HEX6)
  accent!: string;

  @IsString()
  @Matches(HEX6)
  muted!: string;

  @IsString()
  @Matches(HEX6)
  surface!: string;
}

export class ThemeOverrideDto {
  @ValidateNested()
  @Type(() => ThemeColorsDto)
  colors!: ThemeColorsDto;

  @IsIn(COLOR_INTENSITY_IDS)
  intensity!: (typeof COLOR_INTENSITY_IDS)[number];
}

export class GenerateLandingDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LandingSectionConfigDto)
  sections?: LandingSectionConfigDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SelectedUiComponentDto)
  components?: SelectedUiComponentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => LandingFeatureDto)
  features?: LandingFeatureDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CopywriterBriefDto)
  copywriter?: CopywriterBriefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeOverrideDto)
  theme?: ThemeOverrideDto;
}
