import { apiRequest } from './api-client';
import type { UserSummary } from '@/types/user';
export interface DirectCall {
  id: string;
  conversationId: string;
  caller: UserSummary;
  callee: UserSummary;
  mode: 'AUDIO' | 'VIDEO';
  status: string;
  offer: string;
  answer: string | null;
  callerCandidates: RTCIceCandidateInit[];
  calleeCandidates: RTCIceCandidateInit[];
  createdAt: string;
  answeredAt: string | null;
}
export const directCallApi = {
  incoming: (token: string) => apiRequest<{ call: DirectCall | null }>('/chat/calls/incoming', { token }),
  start: (token: string, conversationId: string, mode: 'AUDIO' | 'VIDEO', offer: string) =>
    apiRequest<DirectCall>(`/chat/direct/${conversationId}/calls`, { token, method: 'POST', body: { mode, offer } }),
  get: (token: string, id: string) => apiRequest<DirectCall>(`/chat/calls/${id}`, { token }),
  answer: (token: string, id: string, answer: string) =>
    apiRequest<DirectCall>(`/chat/calls/${id}/answer`, { token, method: 'PUT', body: { answer } }),
  candidate: (token: string, id: string, candidate: RTCIceCandidateInit) =>
    apiRequest(`/chat/calls/${id}/candidates`, {
      token,
      method: 'POST',
      body: { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex },
    }),
  end: (token: string, id: string) => apiRequest(`/chat/calls/${id}`, { token, method: 'DELETE' }),
};
