import { IsIn, IsString } from 'class-validator';

export class AttachStudioAssetDto {
  @IsIn(['image-studio', 'video-studio'])
  source!: 'image-studio' | 'video-studio';

  @IsString()
  assetId!: string;
}
