import type {
  ClubApiInvite,
  ClubApiJoinRequest,
  ClubApiJoinResult,
  ClubApiMember,
  ClubApiView,
  ClubCreateInput,
  ClubUpdateInput,
} from '@/types/club';
import { apiRequest } from './api-client';

/** Clubs stored on the server. The server enforces capacity, join rules, and permissions. */
const clubPath = (clubId: string, rest = ''): string => `/clubs/${encodeURIComponent(clubId)}${rest}`;

export function createServerClub(token: string, input: ClubCreateInput): Promise<ClubApiView> {
  return apiRequest<ClubApiView>('/clubs', { method: 'POST', body: input, token });
}

export function getMyServerClubs(token: string): Promise<ClubApiView[]> {
  return apiRequest<ClubApiView[]>('/clubs/mine', { token });
}

export function getServerClub(token: string, clubId: string): Promise<ClubApiView> {
  return apiRequest<ClubApiView>(clubPath(clubId), { token });
}

export function updateServerClub(token: string, clubId: string, input: ClubUpdateInput): Promise<ClubApiView> {
  return apiRequest<ClubApiView>(clubPath(clubId), { method: 'PATCH', body: input, token });
}

export function joinServerClub(token: string, clubId: string): Promise<ClubApiJoinResult> {
  return apiRequest<ClubApiJoinResult>(clubPath(clubId, '/join'), { method: 'POST', token });
}

/** Leaves the club, or cancels a pending request. */
export function leaveServerClub(token: string, clubId: string): Promise<ClubApiView> {
  return apiRequest<ClubApiView>(clubPath(clubId, '/leave'), { method: 'POST', token });
}

export function getServerClubMembers(token: string, clubId: string): Promise<ClubApiMember[]> {
  return apiRequest<ClubApiMember[]>(clubPath(clubId, '/members'), { token });
}

export function getServerClubRequests(token: string, clubId: string): Promise<ClubApiJoinRequest[]> {
  return apiRequest<ClubApiJoinRequest[]>(clubPath(clubId, '/members/requests'), { token });
}

export function approveServerClubRequest(token: string, clubId: string, userId: string): Promise<ClubApiMember> {
  return apiRequest<ClubApiMember>(clubPath(clubId, `/members/${encodeURIComponent(userId)}/approve`), {
    method: 'POST',
    token,
  });
}

export async function rejectServerClubRequest(token: string, clubId: string, userId: string): Promise<void> {
  await apiRequest<unknown>(clubPath(clubId, `/members/${encodeURIComponent(userId)}/reject`), {
    method: 'POST',
    token,
  });
}

export async function removeServerClubMember(token: string, clubId: string, userId: string): Promise<void> {
  await apiRequest<unknown>(clubPath(clubId, `/members/${encodeURIComponent(userId)}/remove`), {
    method: 'POST',
    token,
  });
}

export function getServerClubInvites(token: string, clubId: string): Promise<ClubApiInvite[]> {
  return apiRequest<ClubApiInvite[]>(clubPath(clubId, '/invites'), { token });
}

export function inviteToServerClub(token: string, clubId: string, username: string): Promise<ClubApiInvite> {
  return apiRequest<ClubApiInvite>(clubPath(clubId, '/invites'), { method: 'POST', body: { username }, token });
}
