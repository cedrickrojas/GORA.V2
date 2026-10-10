import type { GameRoster, MyParticipation } from '@/types/game-player';
import { apiRequest } from './api-client';

/**
 * Roster REST calls. No body is ever sent: the acting user comes from the JWT, and the
 * counts, capacity, and statuses are decided by the server.
 */

const base = (gameId: string) => `/games/${encodeURIComponent(gameId)}/players`;

export function getGamePlayers(token: string, gameId: string): Promise<GameRoster> {
  return apiRequest<GameRoster>(base(gameId), { token });
}

export function getMyParticipation(token: string, gameId: string): Promise<MyParticipation> {
  return apiRequest<MyParticipation>(`${base(gameId)}/me`, { token });
}

export function leaveGame(token: string, gameId: string): Promise<MyParticipation> {
  return apiRequest<MyParticipation>(`${base(gameId)}/me/leave`, { method: 'PATCH', token });
}

export function removePlayer(token: string, gameId: string, userId: string): Promise<GameRoster> {
  return apiRequest<GameRoster>(`${base(gameId)}/${encodeURIComponent(userId)}/remove`, { method: 'PATCH', token });
}
