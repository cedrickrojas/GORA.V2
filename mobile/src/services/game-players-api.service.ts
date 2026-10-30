import type { GameLeaveRequest, GameRoster, MyParticipation } from '@/types/game-player';
import { apiRequest } from './api-client';

/**
 * Roster REST calls. The acting user comes from the JWT; the server decides all state.
 */

const base = (gameId: string) => `/games/${encodeURIComponent(gameId)}/players`;

export function getGamePlayers(token: string, gameId: string): Promise<GameRoster> {
  return apiRequest<GameRoster>(base(gameId), { token });
}

export function getMyParticipation(token: string, gameId: string): Promise<MyParticipation> {
  return apiRequest<MyParticipation>(`${base(gameId)}/me`, { token });
}

export function requestLeaveGame(token: string, gameId: string): Promise<GameLeaveRequest> {
  return apiRequest<GameLeaveRequest>(`${base(gameId)}/me/leave`, { method: 'PATCH', token });
}

export function getMyLeaveRequest(token: string, gameId: string): Promise<GameLeaveRequest | null> {
  return apiRequest<GameLeaveRequest | null>(`${base(gameId)}/me/leave-request`, { token });
}

export function cancelLeaveRequest(token: string, gameId: string): Promise<GameLeaveRequest> {
  return apiRequest<GameLeaveRequest>(`${base(gameId)}/me/leave-request/cancel`, { method: 'PATCH', token });
}

export function getGameLeaveRequests(token: string, gameId: string): Promise<GameLeaveRequest[]> {
  return apiRequest<GameLeaveRequest[]>(`${base(gameId)}/leave-requests`, { token });
}

export function respondLeaveRequest(token: string, gameId: string, userId: string, action: 'approve' | 'reject'): Promise<GameLeaveRequest> {
  return apiRequest<GameLeaveRequest>(`${base(gameId)}/${encodeURIComponent(userId)}/leave-request`, { method: 'PATCH', token, body: { action } });
}

export function removePlayer(token: string, gameId: string, userId: string): Promise<GameRoster> {
  return apiRequest<GameRoster>(`${base(gameId)}/${encodeURIComponent(userId)}/remove`, { method: 'PATCH', token });
}

export function markPlayerAttendance(token: string, gameId: string, userId: string, action: 'attended' | 'no_show'): Promise<GameRoster> {
  return apiRequest<GameRoster>(`${base(gameId)}/${encodeURIComponent(userId)}/attendance`, { method: 'PATCH', token, body: { action } });
}
