import { IsNotEmpty, IsString } from 'class-validator';

export class LeadIdDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;
}
