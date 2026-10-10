import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
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

/**
 * Add Story. The photo or video is a URL to external storage until uploads exist; the
 * story expires 24 hours after it is posted (set by the server, never by the client).
 */
export class CreateStoryDto extends AudienceDto {
  @IsIn(STORY_MEDIA_TYPES, { message: 'mediaType must be IMAGE or VIDEO.' })
  mediaType!: StoryMediaType;

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

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CAPTION_MAX_LENGTH)
  caption?: string;
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
