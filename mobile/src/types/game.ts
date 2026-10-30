import type { ClubSummary } from './club';
import type { SportsLocation } from './sport';
import type { UserSummary } from './user';
import type { ParticipantStatus } from './game-player';
import type { JoinRequestStatus } from './join-request';

export interface JoinedGame extends ApiGame {
  participationStatus: ParticipantStatus | null;
  joinRequestStatus: JoinRequestStatus | null;
  joinedAt: string | null;
  requestedAt: string | null;
}

/** Mirrors the server's GameStatus enum. ACTIVE means the game is in progress. */
export type GameStatus = 'OPEN' | 'FULL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/**
 * The viewer's place in the join flow:
 * NONE -> REQUESTED (join request sent) -> PARTICIPANT (host accepted).
 * HOST is the organizer. Only participants of a COMPLETED game earn activity credit.
 */
export type GameParticipation = 'NONE' | 'REQUESTED' | 'PARTICIPANT' | 'HOST';

export interface Game {
  id: string;
  title: string;
  sport: string;
  host: UserSummary;
  /** The community the game belongs to. The host stays the organizer. */
  club?: ClubSummary | null;
  location: SportsLocation;
  /** The host's note, shown as the post text when the game appears in the feed. */
  description?: string;
  /** ISO 8601 timestamp. */
  startsAt: string;
  /** ISO 8601 timestamp of when the host posted the game; orders it in the Home feed. */
  createdAt: string;
  status: GameStatus;
  skillLevel: string;
  /** Capacity set by the host (Game.requiredPlayers). */
  requiredPlayers: number;
  /** Counted by the server from GameParticipant rows; never stored. */
  currentPlayers: number;
  participation: GameParticipation;
}

/** Mirrors the server's ParticipantStatus values that occupy a slot. */
export type GamePlayerStatus = 'ACTIVE' | 'COMPLETED';

export interface GamePlayer {
  user: UserSummary;
  status: GamePlayerStatus;
  /** The host only appears here when they joined as a player. */
  isHost: boolean;
}

/** Game Details response: the roster is the source of currentPlayers. */
export interface GameDetails extends Game {
  remainingSlots: number;
  players: GamePlayer[];
}

/**
 * A game created in GORA (GET /games/:id). gameDate is "YYYY-MM-DD" and the times are
 * the venue's "HH:mm", shown exactly as entered. currentPlayers is counted by the server.
 */
export interface ApiGame {
  autoAccept: boolean;
  id: string;
  title: string;
  description: string | null;
  sport: { id: string; name: string; iconUrl: string | null };
  host: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName: string;
    profileImageUrl: string | null;
  };
  club: { id: string; name: string; slug: string; profileImageUrl: string | null } | null;
  requiredPlayers: number;
  currentPlayers: number;
  remainingSlots: number;
  status: GameStatus;
  gameDate: string;
  startTime: string;
  endTime: string | null;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  isHost: boolean;
  /** Whether the viewer has an ACTIVE participation (decided by the server). */
  isPlayer: boolean;
  /** PENDING join requests, sent to the host only (null for everyone else). Not players. */
  pendingRequestCount: number | null;
  canEdit: boolean;
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /games. The host comes from the JWT and a new game is always OPEN. */
export interface CreateGameInput {
  autoAccept: boolean;
  sportId: string;
  clubId: string | null;
  title: string;
  description: string | null;
  requiredPlayers: number;
  gameDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
}

/** PATCH /games/:id: only the fields that changed. */
export type UpdateGameInput = Partial<CreateGameInput>;

export interface GameListQuery {
  sportId?: string;
  status?: GameStatus;
  /** "today", "upcoming" (default), or a YYYY-MM-DD date. */
  gameDate?: string;
  limit?: number;
  offset?: number;
}
