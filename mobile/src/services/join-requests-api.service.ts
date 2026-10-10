import type { HostJoinRequest, JoinRequest } from '@/types/join-request';
import { apiRequest } from './api-client';

/**
 * Join request REST calls. Only the optional message is ever sent: the requester, the
 * host, and every status come from the server.
 */

const base = (gameId: string) => `/games/${encodeURIComponent(gameId)}/join-requests`;

export function createJoinRequest(token: string, gameId: string, message: string | null): Promise<JoinRequest> {
  return apiRequest<JoinRequest>(base(gameId), {
    method: 'POST',
    body: message ? { message } : {},
    token,
  });
}

export async function getMyJoinRequest(token: string, gameId: string): Promise<JoinRequest | null> {
  const response = await apiRequest<{ joinRequest: JoinRequest | null }>(`${base(gameId)}/me`, { token });
  return response.joinRequest;
}

export function cancelMyJoinRequest(token: string, gameId: string): Promise<JoinRequest> {
  return apiRequest<JoinRequest>(`${base(gameId)}/me/cancel`, { method: 'PATCH', token });
}

export function listGameJoinRequests(token: string, gameId: string): Promise<HostJoinRequest[]> {
  return apiRequest<HostJoinRequest[]>(base(gameId), { token });
}

export function acceptJoinRequest(token: string, gameId: string, requestId: string): Promise<HostJoinRequest> {
  return apiRequest<HostJoinRequest>(`${base(gameId)}/${encodeURIComponent(requestId)}/accept`, {
    method: 'PATCH',
    token,
  });
}

export function rejectJoinRequest(token: string, gameId: string, requestId: string): Promise<HostJoinRequest> {
  return apiRequest<HostJoinRequest>(`${base(gameId)}/${encodeURIComponent(requestId)}/reject`, {
    method: 'PATCH',
    token,
  });
}
