/**
 * Player capacity is never stored on Game. The current player count is the number of
 * ACTIVE GameParticipant rows, compared to Game.requiredPlayers. LEFT, REMOVED, and
 * COMPLETED rows are history, not current players. The host is counted only when they
 * have their own ACTIVE row; creating a game never adds one.
 *
 * The database capacity guard (GameParticipant_capacity_guard) counts ACTIVE and
 * COMPLETED rows, a superset: COMPLETED rows only exist once a game is over, so in an
 * OPEN or FULL game both counts are the same.
 */

export const ACTIVE_PLAYER_STATUS = 'ACTIVE' as const;

/** Rows the database capacity guard counts against requiredPlayers. */
export const OCCUPYING_PARTICIPANT_STATUSES = ['ACTIVE', 'COMPLETED'] as const;

export type OccupyingParticipantStatus =
  (typeof OCCUPYING_PARTICIPANT_STATUSES)[number];

export interface GameCapacitySummary {
  requiredPlayers: number;
  currentPlayers: number;
  remainingSlots: number;
  recruitingStatus: 'OPEN' | 'FULL';
}

export function countActivePlayers(statuses: readonly string[]): number {
  return statuses.filter((status) => status === ACTIVE_PLAYER_STATUS).length;
}

export function summarizeGameCapacity(
  requiredPlayers: number,
  activePlayers: number,
): GameCapacitySummary {
  const currentPlayers = Math.min(Math.max(0, activePlayers), requiredPlayers);

  return {
    requiredPlayers,
    currentPlayers,
    remainingSlots: requiredPlayers - currentPlayers,
    recruitingStatus: currentPlayers >= requiredPlayers ? 'FULL' : 'OPEN',
  };
}

export function canAcceptAnotherPlayer(
  requiredPlayers: number,
  activePlayers: number,
): boolean {
  return activePlayers < requiredPlayers;
}
