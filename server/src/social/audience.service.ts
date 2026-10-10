import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostVisibility } from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { RelationshipService } from './relationship.service';

/** What the audience belongs to, used in the error messages ("this story"). */
export type AudienceSubject = 'post' | 'story' | 'reel';

/**
 * The audience rules shared by posts, stories, and reels. CUSTOM needs at least one chosen
 * person, never the author, and only active people with no block in either direction.
 */
@Injectable()
export class AudienceService {
  constructor(
    private readonly usersService: UsersService,
    private readonly relationships: RelationshipService,
  ) {}

  /**
   * Returns the custom viewer ids for CUSTOM, or null for the other visibilities (which must
   * not send any).
   */
  async resolve(
    authorId: string,
    visibility: PostVisibility,
    customViewerIds: string[] | undefined,
    subject: AudienceSubject,
  ): Promise<string[] | null> {
    if (visibility !== 'CUSTOM') {
      if (customViewerIds && customViewerIds.length > 0) {
        throw new BadRequestException(
          `Custom viewers can only be chosen for CUSTOM ${subject}s.`,
        );
      }

      return null;
    }

    const ids = customViewerIds ?? [];

    if (ids.length === 0) {
      throw new BadRequestException(
        `Choose at least one person who can see this ${subject}.`,
      );
    }

    if (ids.includes(authorId)) {
      throw new BadRequestException(
        `You can always see your own ${subject}; do not add yourself.`,
      );
    }

    const [activeIds, blockedIds] = await Promise.all([
      this.usersService.filterActiveIds(ids),
      this.relationships.blockedAmong(authorId, ids),
    ]);
    const allowed = new Set(activeIds.filter((id) => !blockedIds.includes(id)));

    if (ids.some((id) => !allowed.has(id))) {
      throw new BadRequestException(
        `Some of the chosen people cannot be added to this ${subject}.`,
      );
    }

    return ids;
  }
}
