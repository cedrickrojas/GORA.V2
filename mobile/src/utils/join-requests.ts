import type { ApiGame, GameStatus } from '@/types/game';
import type { MyParticipation, RosterPlayer } from '@/types/game-player';
import type { HostJoinRequest, JoinRequest, JoinRequestStatus } from '@/types/join-request';
import type { UserSummary } from '@/types/user';

/** Mirrors the server limit so the counter matches what it accepts. */
export const JOIN_REQUEST_MESSAGE_MAX_LENGTH = 300;

export const JOIN_REQUEST_STATUS_LABELS: Record<JoinRequestStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

const CLOSED_GAME_LABELS: Record<Exclude<GameStatus, 'OPEN'>, string> = {
  FULL: 'Game is full',
  ACTIVE: 'Game in progress',
  COMPLETED: 'Game completed',
  CANCELLED: 'Game cancelled',
};

/**
 * What a viewer can do on a game, from server state only: the host manages players, an
 * ACTIVE player can request to leave, everyone else goes through join requests. The server
 * re-checks every rule on each call.
 */
export type JoinRequestAction =
  | { kind: 'host' }
  | { kind: 'player' }
  | { kind: 'request' }
  | { kind: 'pending' }
  | { kind: 'declined' }
  | { kind: 'closed'; label: string };

export function joinRequestAction(
  game: Pick<ApiGame, 'isHost' | 'isPlayer' | 'status'>,
  mine: Pick<JoinRequest, 'status'> | null,
  participation: Pick<MyParticipation, 'status'> | null = null,
): JoinRequestAction {
  if (game.isHost) {
    return { kind: 'host' };
  }

  // The freshest answer wins: participation is re-read right after leaving.
  const isPlayer = participation ? participation.status === 'ACTIVE' : game.isPlayer;

  if (isPlayer) {
    return { kind: 'player' };
  }

  if (mine?.status === 'PENDING') {
    return { kind: 'pending' };
  }

  if (mine?.status === 'REJECTED') {
    return { kind: 'declined' };
  }

  // No request, a cancelled one, or an accepted one whose player left or was removed.
  return game.status === 'OPEN' ? { kind: 'request' } : { kind: 'closed', label: CLOSED_GAME_LABELS[game.status] };
}

/** A short line for a viewer who used to play in this game. */
export function pastParticipationNote(participation: Pick<MyParticipation, 'status'> | null): string | null {
  if (participation?.status === 'LEFT') {
    return 'You left this game.';
  }

  if (participation?.status === 'REMOVED') {
    return 'The host removed you from this game.';
  }

  return null;
}

export function requesterSummary(request: HostJoinRequest): UserSummary {
  return {
    id: request.user.id,
    username: request.user.username,
    displayName: request.user.displayName,
    avatarUrl: request.user.profileImageUrl,
  };
}

export function rosterPlayerSummary(player: RosterPlayer): UserSummary {
  return {
    id: player.id,
    username: player.username,
    displayName: player.displayName,
    avatarUrl: player.profileImageUrl,
  };
}

export interface HostJoinRequestSections {
  pending: HostJoinRequest[];
  history: HostJoinRequest[];
}

/** Pending oldest first (who asked first); answered ones newest answer first. */
export function splitHostJoinRequests(requests: readonly HostJoinRequest[]): HostJoinRequestSections {
  const answeredAt = (request: HostJoinRequest) => request.respondedAt ?? request.updatedAt;

  return {
    pending: requests
      .filter((request) => request.status === 'PENDING')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    history: requests
      .filter((request) => request.status !== 'PENDING')
      .sort((a, b) => answeredAt(b).localeCompare(answeredAt(a))),
  };
}
