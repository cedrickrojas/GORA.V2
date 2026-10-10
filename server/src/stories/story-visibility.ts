import type { Prisma } from '../generated/prisma/client';
import { friendshipWithViewer } from '../posts/post-visibility';

/**
 * The only definition of "stories this viewer may see". Every story read goes through it.
 *
 * - The author always sees their own stories, expired ones included (their archive).
 * - Anyone else sees only active stories (expiresAt in the future) of active authors with no
 *   block in either direction: PUBLIC; FRIENDS only as an accepted friend; CUSTOM only when
 *   listed; ONLY_ME never.
 * - Deleted stories (deletedAt set) are hidden from everyone, the author included.
 */
export function visibleStoriesWhere(
  viewerId: string,
  now: Date,
): Prisma.StoryWhereInput {
  return {
    deletedAt: null,
    OR: [
      { userId: viewerId },
      {
        expiresAt: { gt: now },
        user: {
          isActive: true,
          NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
        },
        OR: [
          { visibility: 'PUBLIC' },
          {
            visibility: 'FRIENDS',
            user: friendshipWithViewer(viewerId, 'ACCEPTED'),
          },
          {
            visibility: 'CUSTOM',
            customViewers: { some: { userId: viewerId } },
          },
        ],
      },
    ],
  };
}
