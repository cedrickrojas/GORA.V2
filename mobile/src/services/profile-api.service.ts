import type { OtherProfile, OwnProfile, ProfileUpdateInput } from '@/types/profile';
import { apiRequest } from './api-client';

/**
 * Profile REST calls. Every route needs the signed-in user's JWT; writes only ever target "me".
 * Sports go through sports-api.service.ts.
 */

export function getMyProfile(token: string): Promise<OwnProfile> {
  return apiRequest<OwnProfile>('/profiles/me', { token });
}

export function updateMyProfile(token: string, input: ProfileUpdateInput): Promise<OwnProfile> {
  return apiRequest<OwnProfile>('/profiles/me', { method: 'PATCH', body: input, token });
}

/** Your own username returns your OwnProfile; a blocked-by-them or missing user is a 404. */
export function getProfile(token: string, username: string): Promise<OwnProfile | OtherProfile> {
  return apiRequest<OwnProfile | OtherProfile>(`/profiles/${encodeURIComponent(username)}`, { token });
}
