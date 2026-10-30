import type { FriendRequest } from '@/types/friend';
import type { PlayerSummary } from '@/types/player';
import { apiRequest } from './api-client';
import { toUserSummary } from '@/utils/display-name';

export interface FriendsSnapshot {
  friends: PlayerSummary[];
  requests: FriendRequest[];
  blockedIds: string[];
}

export const getFriends = (token: string) => apiRequest<FriendsSnapshot>('/friends', { token });
export const sendFriendRequest = (token: string, username: string) =>
  apiRequest<FriendsSnapshot>(`/friends/requests/${encodeURIComponent(username)}`, { method: 'POST', token });
export const acceptFriendRequest = (token: string, id: string) =>
  apiRequest<FriendsSnapshot>(`/friends/requests/${encodeURIComponent(id)}/accept`, { method: 'POST', token });
export const dismissFriendRequest = (token: string, id: string) =>
  apiRequest<FriendsSnapshot>(`/friends/requests/${encodeURIComponent(id)}`, { method: 'DELETE', token });
export const removeFriend = (token: string, username: string) =>
  apiRequest<FriendsSnapshot>(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE', token });
export const unblockFriend = (token: string, username: string) =>
  apiRequest<FriendsSnapshot>(`/friends/blocks/${encodeURIComponent(username)}`, { method: 'DELETE', token });
export const blockFriend = (token: string, username: string) =>
  apiRequest<FriendsSnapshot>(`/friends/blocks/${encodeURIComponent(username)}`, { method: 'POST', token });

export async function searchPlayers(token: string, query: string): Promise<PlayerSummary[]> {
  const users = await apiRequest<
    {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
      city: string | null;
    }[]
  >(`/friends/players?${new URLSearchParams({ q: query })}`, { token });
  return users.map((user) => ({
    ...toUserSummary(user),
    city: user.city ?? '',
    primarySport: '',
    distanceKm: 0,
    followers: 0,
    gamesCompleted: 0,
    featured: false,
  }));
}
