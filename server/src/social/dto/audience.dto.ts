import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import type { PostVisibility } from '../../generated/prisma/client';
import { POST_VISIBILITIES } from '../../posts/post-visibility';

export const CUSTOM_AUDIENCE_MAX = 100;

/** Who can see a story or reel: the same four options (and limits) as posts. */
export class AudienceDto {
  @IsIn(POST_VISIBILITIES, {
    message: `Visibility must be one of ${POST_VISIBILITIES.join(', ')}.`,
  })
  visibility!: PostVisibility;

  /** Only for CUSTOM: the users (besides the author) who may see it. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CUSTOM_AUDIENCE_MAX)
  @ArrayUnique()
  @IsUUID('all', {
    each: true,
    message: 'Each custom viewer must be a user id.',
  })
  customViewerIds?: string[];
}
