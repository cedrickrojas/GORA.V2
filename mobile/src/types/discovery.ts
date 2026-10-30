import type { ApiGame, GameStatus } from './game';
import type { JoinRequestStatus } from './join-request';

/**
 * One result of GET /games/discover: a real GORA game with only what a map marker, its
 * preview, and a list row need. distanceKm and currentPlayers come from the server
 * (ACTIVE GameParticipant rows); the client never recalculates them.
 */
export interface DiscoveredGame {
  autoAccept?: boolean;
  id: string;
  title: string;
  sport: ApiGame['sport'];
  host: ApiGame['host'];
  club: { id: string; name: string } | null;
  gameDate: string;
  startTime: string;
  endTime: string | null;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  currentPlayers: number;
  requiredPlayers: number;
  remainingSlots: number;
  status: GameStatus;
  isHost: boolean;
  isPlayer: boolean;
  myJoinRequestStatus: JoinRequestStatus | null;
}

export interface GameDiscoveryResponse {
  games: DiscoveredGame[];
  dateFrom: string;
  dateTo: string | null;
  distanceKm: number | null;
}

/** Server date values: presets decided on the game clock, or one YYYY-MM-DD date. */
export type DiscoveryDateParam = 'today' | 'tomorrow' | 'this-week' | string;

export interface GameDiscoveryQuery {
  sportId?: string;
  date?: DiscoveryDateParam;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  status?: Exclude<GameStatus, 'CANCELLED'>;
  limit?: number;
}

/** The date filter the user picks. ALL = every upcoming date. */
export type DiscoveryDateFilter = 'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'CUSTOM';

export type DiscoveryViewMode = 'MAP' | 'LIST';
