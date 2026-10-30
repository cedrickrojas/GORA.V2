import type { OtherProfile, OwnProfile, ProfileUpdateInput } from '@/types/profile';
import type { HelpRequestsResponse } from '@/types/help-request';
import { apiRequest } from './api-client';
import { getApiBaseUrl } from './api-config';

function withCoverUrl<T extends OwnProfile | OtherProfile>(profile: T): T {
  const base = getApiBaseUrl();
  const absolute = (url: string | null): string | null =>
    url?.startsWith('/') ? new URL(url, base || window.location.origin).href : url;
  return {
    ...profile,
    profileImageUrl: absolute(profile.profileImageUrl),
    coverImageUrl: absolute(profile.coverImageUrl),
  };
}

export async function uploadMyProfilePhoto(token: string, photo: string): Promise<OwnProfile> {
  return withCoverUrl(await apiRequest<OwnProfile>('/profiles/me/photo', { method: 'PUT', body: { photo }, token }));
}

export async function removeMyProfilePhoto(token: string): Promise<OwnProfile> {
  return withCoverUrl(await apiRequest<OwnProfile>('/profiles/me/photo', { method: 'DELETE', token }));
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

export async function reportUser(token: string, username: string, reason: string, description: string): Promise<void> {
  await apiRequest(`/profiles/${encodeURIComponent(username)}/report`, {
    method: 'POST',
    body: { reason, description },
    token,
  });
}

export async function sendHelpRequest(token: string, message: string): Promise<void> {
  await apiRequest('/profiles/help', { method: 'POST', body: { message }, token });
}

export function getMyHelpRequests(token: string): Promise<HelpRequestsResponse> {
  return apiRequest<HelpRequestsResponse>('/profiles/me/help', { token });
}
