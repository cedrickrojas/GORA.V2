import type { OtherProfile, OwnProfile, ProfileUpdateInput } from '@/types/profile';
import { apiRequest } from './api-client';
import { getApiBaseUrl } from './api-config';

function withCoverUrl<T extends OwnProfile | OtherProfile>(profile: T): T {
  return profile.coverImageUrl?.startsWith('/')
    ? { ...profile, coverImageUrl: new URL(profile.coverImageUrl, getApiBaseUrl() || window.location.origin).href }
    : profile;
}

export async function uploadMyCover(token: string, photo: string): Promise<OwnProfile> {
  return withCoverUrl(await apiRequest<OwnProfile>('/profiles/me/cover', { method: 'PUT', body: { photo }, token }));
}

export async function removeMyCover(token: string): Promise<OwnProfile> {
  return withCoverUrl(await apiRequest<OwnProfile>('/profiles/me/cover', { method: 'DELETE', token }));
}

/**
 * Profile REST calls. Every route needs the signed-in user's JWT; writes only ever target "me".
 * Sports go through sports-api.service.ts.
 */

export async function getMyProfile(token: string): Promise<OwnProfile> {
  return withCoverUrl(await apiRequest<OwnProfile>('/profiles/me', { token }));
}

export async function updateMyProfile(token: string, input: ProfileUpdateInput): Promise<OwnProfile> {
  return withCoverUrl(await apiRequest<OwnProfile>('/profiles/me', { method: 'PATCH', body: input, token }));
}

/** Your own username returns your OwnProfile; a blocked-by-them or missing user is a 404. */
export async function getProfile(token: string, username: string): Promise<OwnProfile | OtherProfile> {
  return withCoverUrl(
    await apiRequest<OwnProfile | OtherProfile>(`/profiles/${encodeURIComponent(username)}`, { token }),
  );
}
