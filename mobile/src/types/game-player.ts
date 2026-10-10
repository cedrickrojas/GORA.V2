import type { GameStatus } from './game';

export type ParticipantStatus = 'ACTIVE' | 'LEFT' | 'COMPLETED' | 'REMOVED';

/** A seated (ACTIVE) player, with public profile fields only. */
export interface RosterPlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  joinedAt: string;
}

/** GET /games/:gameId/players. Counts come from the server's ACTIVE participant rows. */
export interface GameRoster {
  gameId: string;
  requiredPlayers: number;
  currentPlayers: number;
  availableSlots: number;
  status: GameStatus;
  players: RosterPlayer[];
}

export type MyParticipationStatus = ParticipantStatus | 'NOT_A_PLAYER';

export interface MyParticipation {
  gameId: string;
  status: MyParticipationStatus;
  joinedAt: string | null;
  completedAt: string | null;
}
