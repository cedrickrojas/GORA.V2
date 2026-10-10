import type { Game, GameParticipation, GamePlayer } from '@/types/game';

export const PARTICIPATION_LABELS: Record<GameParticipation, string> = {
  NONE: 'Request to Join',
  REQUESTED: 'Requested',
  PARTICIPANT: 'Joined',
  HOST: 'Hosting',
};

export function canRequestToJoin(game: Game): boolean {
  return game.status === 'OPEN' && game.participation === 'NONE';
}

/** Occupying GameParticipant statuses. LEFT and REMOVED do not take a slot. */
export const OCCUPYING_PLAYER_STATUSES = ['ACTIVE', 'COMPLETED'] as const;

export function countOccupyingPlayers(statuses: readonly string[]): number {
  return statuses.filter((status) => status === 'ACTIVE' || status === 'COMPLETED').length;
}

export interface GameCapacitySummary {
  requiredPlayers: number;
  currentPlayers: number;
  remainingSlots: number;
  isFull: boolean;
}

/** Same formula the API will use: occupying participants / requiredPlayers. */
export function summarizeGameCapacity(
  requiredPlayers: number,
  occupyingPlayers: number,
): GameCapacitySummary {
  const currentPlayers = Math.min(Math.max(0, occupyingPlayers), requiredPlayers);

  return {
    requiredPlayers,
    currentPlayers,
    remainingSlots: requiredPlayers - currentPlayers,
    isFull: currentPlayers >= requiredPlayers,
  };
}

/** The server never exceeds capacity; clamping keeps a bad payload from showing 13/12. */
export function getPlayerCount(game: Pick<Game, 'currentPlayers' | 'requiredPlayers'>): number {
  return summarizeGameCapacity(game.requiredPlayers, game.currentPlayers).currentPlayers;
}

export function formatPlayerCount(game: Pick<Game, 'currentPlayers' | 'requiredPlayers'>): string {
  return `${getPlayerCount(game)}/${game.requiredPlayers}`;
}

export function getSpotsLeft(game: Pick<Game, 'currentPlayers' | 'requiredPlayers'>): number {
  return game.requiredPlayers - getPlayerCount(game);
}

export interface RosterSlot<T = GamePlayer> {
  /** Two-digit slot label: "01", "02", ... */
  label: string;
  player: T | null;
}

/**
 * One slot per required player: players first, then open slots. Open slots are only
 * generated here (requiredPlayers - players), never stored.
 */
export function buildRosterSlots<T = GamePlayer>(requiredPlayers: number, players: readonly T[]): RosterSlot<T>[] {
  const width = Math.max(2, String(requiredPlayers).length);

  return Array.from({ length: requiredPlayers }, (_, index) => ({
    label: String(index + 1).padStart(width, '0'),
    player: players[index] ?? null,
  }));
}

export interface MyGamesSections {
  hosting: Game[];
  upcoming: Game[];
  requested: Game[];
  completed: Game[];
}

export function groupMyGames(games: readonly Game[]): MyGamesSections {
  const byStart = [...games].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const isDone = (game: Game): boolean => game.status === 'COMPLETED';

  return {
    hosting: byStart.filter((game) => game.participation === 'HOST' && !isDone(game)),
    upcoming: byStart.filter((game) => game.participation === 'PARTICIPANT' && !isDone(game)),
    requested: byStart.filter((game) => game.participation === 'REQUESTED' && !isDone(game)),
    completed: byStart
      .filter((game) => isDone(game) && game.participation !== 'NONE' && game.participation !== 'REQUESTED')
      .reverse(),
  };
}
