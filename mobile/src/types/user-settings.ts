import type { DistanceFilter } from '@/utils/search';

export interface UserSettings {
  notifyFriends: boolean;
  notifyGames: boolean;
  notifyMessages: boolean;
  notifyContent: boolean;
  profileVisibility: 'PUBLIC' | 'FRIENDS';
  defaultDistanceKm: DistanceFilter;
  useDeviceLocation: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notifyFriends: true,
  notifyGames: true,
  notifyMessages: true,
  notifyContent: true,
  profileVisibility: 'PUBLIC',
  defaultDistanceKm: null,
  useDeviceLocation: true,
};
