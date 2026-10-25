import type { AddSportInput, SportOption, UpdateSportInput, UserSportEntry } from '@/types/profile';
import { apiRequest } from './api-client';

/**
 * Sports REST calls. The sport list is read-only; user sports always target "me", and the
 * owner comes from the JWT on the server, so no user id is ever sent.
 */

export function getSports(token: string): Promise<SportOption[]> {
  return apiRequest<SportOption[]>('/sports', { token });
}

export function getMySports(token: string): Promise<UserSportEntry[]> {
  return apiRequest<UserSportEntry[]>('/users/me/sports', { token });
}

export function addMySport(token: string, input: AddSportInput): Promise<UserSportEntry> {
  return apiRequest<UserSportEntry>('/users/me/sports', { method: 'POST', body: input, token });
}

export function updateMySport(token: string, sportId: string, input: UpdateSportInput): Promise<UserSportEntry> {
  return apiRequest<UserSportEntry>(`/users/me/sports/${encodeURIComponent(sportId)}`, {
    method: 'PATCH',
    body: input,
    token,
  });
}

export async function removeMySport(token: string, sportId: string): Promise<void> {
  await apiRequest<null>(`/users/me/sports/${encodeURIComponent(sportId)}`, { method: 'DELETE', token });
}
