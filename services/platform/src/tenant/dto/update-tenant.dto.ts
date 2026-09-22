import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TENANT_STATUS } from '../tenant.constants';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn([TENANT_STATUS.ACTIVE, TENANT_STATUS.DISABLED])
  status?: string;
}
