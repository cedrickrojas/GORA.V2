import { visibleClubContentWhere } from '../social/club-visibility';
import type { Prisma } from '../generated/prisma/client';
import { friendshipWithViewer } from '../posts/post-visibility';

/**
 * The only definition of "games this viewer may see". The host always sees their games.
 * Anyone else sees games of active hosts with no block in either direction, outside a
 * club, in a public club, or in a club the viewer is an ACTIVE member of.
 */
export function visibleGamesWhere(viewerId: string): Prisma.GameWhereInput {
  return {
    OR: [
      { hostId: viewerId },
      {
        AND: [
          {
            host: {
              isActive: true,
              NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
            },
          },
          {
            OR: [{ clubId: null }, { club: visibleClubContentWhere(viewerId) }],
          },
        ],
      },
    ],
  };
}
