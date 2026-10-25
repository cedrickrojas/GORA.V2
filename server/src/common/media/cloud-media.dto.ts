import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { VIDEO_MAX_BYTES } from './private-media.storage';

export const MEDIA_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

export class StartMediaUploadDto {
  @IsIn(['stories', 'reels'])
  resource!: 'stories' | 'reels';

  @IsIn(Object.keys(MEDIA_TYPES))
  contentType!: keyof typeof MEDIA_TYPES;

  @IsInt()
  @Min(1)
  @Max(VIDEO_MAX_BYTES)
  size!: number;
}

export class CompleteMediaUploadDto {
  @IsUUID()
  uploadId!: string;
}
