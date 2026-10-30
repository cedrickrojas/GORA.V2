import type { Prisma } from '../generated/prisma/client';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import { ACTIVE_PLAYER_STATUS, summarizeGameCapacity } from './game-capacity';
import { formatGameDate, formatGameTime } from './game-schedule';
import type { GameCardView } from './game.types';

/**
 * The compact game shape shared by discovery (map/list) and the Home feed: one select and
 * one mapper, so every card counts players the same way (ACTIVE GameParticipant rows via
 * _count, never loaded one by one) and never exposes more than the public host fields.
 */
export function gameCardSelect(viewerId: string) {
  return {
    id: true,
    hostId: true,
    title: true,
    requiredPlayers: true,
    autoAccept: true,
    gameDate: true,
    startTime: true,
    endTime: true,
    locationName: true,
    latitude: true,
    longitude: true,
    status: true,
    createdAt: true,
    sport: { select: { id: true, name: true, iconUrl: true } },
    host: { select: AUTHOR_SELECT },
    club: { select: { id: true, name: true } },
    _count: {
      select: { participants: { where: { status: ACTIVE_PLAYER_STATUS } } },
    },
    participants: {
      where: { userId: viewerId, status: ACTIVE_PLAYER_STATUS },
      select: { id: true },
    },
    joinRequests: { where: { userId: viewerId }, select: { status: true } },
  } satisfies Prisma.GameSelect;
}

export type GameCardRow = Prisma.GameGetPayload<{
  select: ReturnType<typeof gameCardSelect>;
}>;

export function toGameCard(row: GameCardRow, viewerId: string): GameCardView {
  const capacity = summarizeGameCapacity(
    row.requiredPlayers,
    row._count.participants,
  );

  return {
    id: row.id,
    title: row.title,
    sport: row.sport,
    host: {
      id: row.host.id,
      username: row.host.username,
      firstName: row.host.firstName,
      lastName: row.host.lastName,
      displayName: formatDisplayName(row.host),
      profileImageUrl: row.host.profileImageUrl,
    },
    club: row.club,
    gameDate: formatGameDate(row.gameDate),
    startTime: formatGameTime(row.startTime),
    endTime: row.endTime ? formatGameTime(row.endTime) : null,
    locationName: row.locationName,
    latitude: row.latitude,
    longitude: row.longitude,
    currentPlayers: capacity.currentPlayers,
    requiredPlayers: capacity.requiredPlayers,
    autoAccept: row.autoAccept,
    remainingSlots: capacity.remainingSlots,
    status: row.status,
    isHost: row.hostId === viewerId,
    isPlayer: row.participants.length > 0,
    myJoinRequestStatus: row.joinRequests[0]?.status ?? null,
  };
}
