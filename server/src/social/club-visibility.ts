import type { Prisma } from '../generated/prisma/client';

/** Public content still requires an active club; private content requires membership too. */
export function visibleClubContentWhere(
  viewerId: string,
): Prisma.ClubWhereInput {
  return {
    isActive: true,
    OR: [
      { isPublic: true },
      { members: { some: { userId: viewerId, status: 'ACTIVE' } } },
    ],
  };
}
