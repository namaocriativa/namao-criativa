import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInviteDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
