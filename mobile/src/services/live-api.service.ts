import { apiRequest, API_PREFIX } from './api-client';
import { getApiBaseUrl } from './api-config';
import type { UserSummary } from '@/types/user';

export interface LiveStreamInfo {
  id: string;
  title: string;
  host: UserSummary;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
}
export interface LivePeer {
  id: string;
  offer: string | null;
  answer: string | null;
}
export const liveApi = {
  mine: async (token: string) => (await apiRequest<{ live: LiveStreamInfo | null }>('/live/mine', { token })).live,
  list: (token: string) => apiRequest<LiveStreamInfo[]>('/live', { token }),
  config: (token: string) => apiRequest<{ iceServers: RTCIceServer[]; maxViewers: number }>('/live/config', { token }),
  start: (token: string, title: string) =>
    apiRequest<LiveStreamInfo>('/live', { token, method: 'POST', body: { title } }),
  get: (token: string, id: string) => apiRequest<LiveStreamInfo>(`/live/${id}`, { token }),
  end: (token: string, id: string) => apiRequest(`/live/${id}`, { token, method: 'DELETE' }),
  peers: (token: string, id: string) => apiRequest<LivePeer[]>(`/live/${id}/peers`, { token }),
  join: (token: string, id: string) => apiRequest<{ id: string }>(`/live/${id}/viewers`, { token, method: 'POST' }),
  poll: (token: string, id: string, peer: string) => apiRequest<LivePeer>(`/live/${id}/viewers/${peer}`, { token }),
  leave: (token: string, id: string, peer: string) =>
    apiRequest(`/live/${id}/viewers/${peer}`, { token, method: 'DELETE' }),
  signal: (token: string, id: string, peer: string, kind: 'offer' | 'answer', sdp: string) =>
    apiRequest(`/live/${id}/viewers/${peer}/${kind}`, { token, method: 'PUT', body: { sdp } }),
};

/** pagehide cannot await a normal API request. Keepalive also works for ordinary route cleanup. */
export function releaseLive(token: string, id: string, peerId?: string): void {
  const path = peerId ? `/live/${id}/viewers/${peerId}` : `/live/${id}`;
  void fetch(`${getApiBaseUrl()}${API_PREFIX}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => undefined);
}
