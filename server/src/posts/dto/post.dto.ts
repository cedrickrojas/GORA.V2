import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { PostVisibility } from '../../generated/prisma/client';
import { trim } from '../../common/validation/transforms';
import { POST_VISIBILITIES } from '../post-visibility';

export const POST_CAPTION_MAX_LENGTH = 2200;
export const CUSTOM_VIEWERS_MAX = 100;
export const POST_TAGS_MAX = 20;
export const LOCATION_NAME_MAX_LENGTH = 120;

const VISIBILITY_MESSAGE = `Visibility must be one of ${POST_VISIBILITIES.join(', ')}.`;

class PostAudienceDto {
  @IsIn(POST_VISIBILITIES, { message: VISIBILITY_MESSAGE })
  visibility!: PostVisibility;

  /** Only for CUSTOM: the users (besides the author) who may see the post. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CUSTOM_VIEWERS_MAX)
  @ArrayUnique()
  @IsUUID('all', {
    each: true,
    message: 'Each custom viewer must be a user id.',
  })
  customViewerIds?: string[];
}

/** A place the author picked for the post. Never filled in from the device automatically. */
export class PostLocationDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name the location.' })
  @MaxLength(LOCATION_NAME_MAX_LENGTH)
  name!: string;

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'latitude must be a number.' },
  )
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'longitude must be a number.' },
  )
  @Min(-180)
  @Max(180)
  longitude!: number;
}

class TaggedUsersDto {
  @IsArray()
  @ArrayMaxSize(POST_TAGS_MAX)
  @ArrayUnique({ message: 'Tag each person only once.' })
  @IsUUID('all', {
    each: true,
    message: 'Each tagged person must be a user id.',
  })
  userIds!: string[];
}

export class CreatePostDto extends PostAudienceDto {
  /** A caption or at least one photo is required by the service. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(POST_CAPTION_MAX_LENGTH)
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(349600, { each: true })
  photos?: string[];

  @IsOptional()
  @IsUUID('all', { message: 'sportId must be a sport id.' })
  sportId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POST_TAGS_MAX)
  @ArrayUnique({ message: 'Tag each person only once.' })
  @IsUUID('all', {
    each: true,
    message: 'Each tagged person must be a user id.',
  })
  taggedUserIds?: string[];

  @IsOptional()
  @IsObject({ message: 'location must be an object.' })
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto;
}

/**
 * Edit Post: only the fields that are sent change. `sportId: null` and `location: null`
 * remove the sport or the location. A photo post may have an empty caption.
 */
export class UpdatePostDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Write something to post.' })
  @MaxLength(POST_CAPTION_MAX_LENGTH)
  caption?: string;

  @IsOptional()
  @IsUUID('all', { message: 'sportId must be a sport id.' })
  sportId?: string | null;

  @IsOptional()
  @IsObject({ message: 'location must be an object.' })
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto | null;
}

export class UpdatePostVisibilityDto extends PostAudienceDto {}

/** Replaces the whole tag list; an empty list removes every tag. */
export class UpdatePostTagsDto extends TaggedUsersDto {}

export class ListPostsQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'FRIENDS'])
  scope?: 'ALL' | 'FRIENDS';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** The id of the last post from the previous page. */
  @IsOptional()
  @IsUUID('all')
  cursor?: string;
}

export class CreatePostCommentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Write a comment.' })
  @MaxLength(2200)
  content!: string;
}
