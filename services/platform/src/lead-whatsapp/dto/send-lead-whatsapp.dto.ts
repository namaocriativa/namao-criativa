import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendLeadWhatsAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;
}
