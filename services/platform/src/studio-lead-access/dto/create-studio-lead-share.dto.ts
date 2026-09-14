import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStudioLeadShareDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
