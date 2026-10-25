import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { StoryMediaType } from '../../generated/prisma/client';
import {
  trim,
  trimOptional,
  trimToNull,
} from '../../common/validation/transforms';
import { AudienceDto } from '../../social/dto/audience.dto';

export const STORY_CAPTION_MAX_LENGTH = 500;
export const MEDIA_URL_MAX_LENGTH = 2048;
export const STORY_MEDIA_TYPES = [
  'IMAGE',
  'VIDEO',
] as const satisfies readonly StoryMediaType[];

export const MEDIA_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

/** Story expiration and author are always set by the server. */
export class StoryMetadataDto extends AudienceDto {
  @IsIn(STORY_MEDIA_TYPES, { message: 'mediaType must be IMAGE or VIDEO.' })
  mediaType!: StoryMediaType;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CAPTION_MAX_LENGTH)
  caption?: string;
}

/** Existing external media URLs remain supported by the API. */
export class CreateStoryDto extends StoryMetadataDto {
  @Transform(trim)
  @IsUrl(MEDIA_URL_OPTIONS, {
    message: 'Media must be a valid http(s) URL.',
  })
  @MaxLength(MEDIA_URL_MAX_LENGTH, { message: 'Media URL is too long.' })
  mediaUrl!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(MEDIA_URL_OPTIONS, {
    message: 'Thumbnail must be a valid http(s) URL.',
  })
  @MaxLength(MEDIA_URL_MAX_LENGTH, { message: 'Thumbnail URL is too long.' })
  thumbnailUrl?: string | null;
}

/** Multipart custom viewers are a JSON array; inherited audience validation still applies. */
export class UploadStoryDto extends StoryMetadataDto {
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

export class CompleteStoryUploadDto extends StoryMetadataDto {
  @IsUUID()
  uploadId!: string;
}

/** Edit story: only the caption. A blank caption (or null) removes it. */
export class UpdateStoryDto {
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'caption must be text.' })
  @MaxLength(STORY_CAPTION_MAX_LENGTH)
  caption?: string | null;
}

export class UpdateStoryVisibilityDto extends AudienceDto {}
