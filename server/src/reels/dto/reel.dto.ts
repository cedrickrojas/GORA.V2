import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  trim,
  trimOptional,
  trimToNull,
} from '../../common/validation/transforms';
import { AudienceDto } from '../../social/dto/audience.dto';
import {
  MEDIA_URL_MAX_LENGTH,
  MEDIA_URL_OPTIONS,
} from '../../stories/dto/story.dto';

export const REEL_CAPTION_MAX_LENGTH = 2200;
export const REEL_MAX_DURATION_SECONDS = 600;

export class ReelMetadataDto extends AudienceDto {
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(REEL_CAPTION_MAX_LENGTH)
  caption?: string;

  @IsOptional()
  @IsUUID('all', { message: 'sportId must be a sport id.' })
  sportId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'durationSeconds must be a whole number.' })
  @Min(1)
  @Max(REEL_MAX_DURATION_SECONDS)
  durationSeconds?: number;
}

/** Existing external video URLs remain supported. */
export class CreateReelDto extends ReelMetadataDto {
  @Transform(trim)
  @IsUrl(MEDIA_URL_OPTIONS, { message: 'Video must be a valid http(s) URL.' })
  @MaxLength(MEDIA_URL_MAX_LENGTH, { message: 'Video URL is too long.' })
  videoUrl!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(MEDIA_URL_OPTIONS, {
    message: 'Thumbnail must be a valid http(s) URL.',
  })
  @MaxLength(MEDIA_URL_MAX_LENGTH, { message: 'Thumbnail URL is too long.' })
  thumbnailUrl?: string | null;
}

/** Multipart fields are strings; custom viewers are sent as a JSON array. */
export class UploadReelDto extends ReelMetadataDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  })
  declare customViewerIds?: string[];
}

/** Edit reel: caption and sport. null (or a blank caption) removes the value. */
export class UpdateReelDto {
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'caption must be text.' })
  @MaxLength(REEL_CAPTION_MAX_LENGTH)
  caption?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'sportId must be a sport id.' })
  sportId?: string | null;
}

export class UpdateReelVisibilityDto extends AudienceDto {}
