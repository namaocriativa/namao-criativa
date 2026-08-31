import { IsNotEmpty, IsString } from 'class-validator';

export class SendInstagramPermissionDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;
}
