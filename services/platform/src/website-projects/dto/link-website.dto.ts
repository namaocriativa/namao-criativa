import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { WEBSITE_DEPLOY_TYPES, WEBSITE_FRAMEWORKS } from '../website-catalog';

export class LinkWebsiteDto {
  @IsString()
  @MinLength(3)
  repo!: string;

  @IsString()
  @IsIn([...WEBSITE_DEPLOY_TYPES])
  deployType!: (typeof WEBSITE_DEPLOY_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  deployNow?: boolean;

  @IsOptional()
  @IsString()
  @IsIn([...WEBSITE_FRAMEWORKS])
  framework?: (typeof WEBSITE_FRAMEWORKS)[number];

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsBoolean()
  syncDomain?: boolean;
}

export class SyncWebsiteDomainDto {
  @IsOptional()
  @IsString()
  domain?: string;
}
