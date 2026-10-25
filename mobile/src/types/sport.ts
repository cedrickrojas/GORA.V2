export interface SportCategory {
  id: string;
  name: string;
  activePlayers: number;
  openGames: number;
  /** Higher is hotter. Sent by the API. */
  trendingScore: number;
}

export interface SportsLocation {
  id: string;
  name: string;
  city: string;
  sports: string[];
  /** Venue coordinates (WGS 84). Never a player's home location. */
  latitude: number;
  longitude: number;
  /** From the viewer; calculated by the API from the viewer's coordinates. */
  distanceKm: number;
}
