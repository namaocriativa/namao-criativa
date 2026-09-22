import { IsOptional, IsString } from 'class-validator';

export class SendLeadEmailDto {
  @IsOptional()
  @IsString()
  packageId?: string;
}
