import { IsIn, IsString } from 'class-validator';

export class UploadVideoFrameDto {
  @IsString()
  @IsIn(['first-frame', 'last-frame'])
  slot!: 'first-frame' | 'last-frame';
}
