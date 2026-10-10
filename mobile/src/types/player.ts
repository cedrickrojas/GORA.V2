import type { UserSummary } from './user';

export interface PlayerSummary extends UserSummary {
  primarySport: string;
  city: string;
  distanceKm: number;
  followers: number;
  gamesCompleted: number;
  featured: boolean;
}
