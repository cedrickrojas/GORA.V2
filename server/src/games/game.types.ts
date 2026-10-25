import type { GameStatus, JoinRequestStatus } from '../generated/prisma/client';

export interface GameSportView {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface GameHostView {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface GameClubView {
  id: string;
  name: string;
  slug: string;
  profileImageUrl: string | null;
}

/**
 * A game as the API returns it. currentPlayers is counted from occupying GameParticipant
 * rows (ACTIVE or COMPLETED), never stored; the host counts only with such a row.
 * gameDate is "YYYY-MM-DD" and the times are the venue's "HH:mm".
 */
export interface GameView {
  id: string;
  title: string;
  description: string | null;
  sport: GameSportView;
  host: GameHostView;
  club: GameClubView | null;
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
  /** Whether the viewer has an ACTIVE participation in this game. */
  isPlayer: boolean;
  /** PENDING join requests, for the host only (null for everyone else). Not players. */
  pendingRequestCount: number | null;
  canEdit: boolean;
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The compact game card shared by discovery and the Home feed (game-card.ts): only what a
 * card needs. currentPlayers counts ACTIVE GameParticipant rows and never exceeds
 * requiredPlayers.
 */
export interface GameCardView {
  id: string;
  title: string;
  sport: GameSportView;
  host: GameHostView;
  club: Pick<GameClubView, 'id' | 'name'> | null;
  gameDate: string;
  startTime: string;
  endTime: string | null;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  currentPlayers: number;
  requiredPlayers: number;
  remainingSlots: number;
  status: GameStatus;
  isHost: boolean;
  isPlayer: boolean;
  /** The viewer's own join request for this game, if any (drives Request to Join). */
  myJoinRequestStatus: JoinRequestStatus | null;
}

/**
 * One map/list result of GET /games/discover. distanceKm is from the search center (null
 * without one or without game coordinates).
 */
export interface DiscoveredGameView extends GameCardView {
  distanceKm: number | null;
}

export interface GameDiscoveryResult {
  games: DiscoveredGameView[];
  /** The searched game dates (inclusive); dateTo is null for "every upcoming date". */
  dateFrom: string;
  dateTo: string | null;
  /** The radius used, or null for any distance. */
  distanceKm: number | null;
}
