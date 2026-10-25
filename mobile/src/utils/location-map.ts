import { getSportMarker } from './sports';

/**
 * Map rules shared by the discovery map and the location view opened by tapping a post
 * or game location (docs/features/sport-map-discovery.md). Markers are real GORA games
 * from GET /games/discover only, never venues on their own. Distances shown to people
 * come from the server; the helpers here only place and group markers.
 */

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapCenter extends MapPoint {
  name: string;
}

/** Activities within this distance of the selected location are listed as nearby. */
export const NEARBY_ACTIVITY_RADIUS_KM = 2;

/** Games closer together than this share one place (one marker with every sport there). */
export const SAME_PLACE_KM = 0.1;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidPoint(point: MapPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

/** Great-circle (haversine) distance in kilometers. */
export function distanceBetweenKm(a: MapPoint, b: MapPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** /map/<lat>/<lng>?name=...&game=... The coordinates are in the path so each place gets its own page. */
export function locationMapPath(center: MapCenter, gameId?: string): string {
  const query = new URLSearchParams({ name: center.name });

  if (gameId) {
    query.set('game', gameId);
  }

  return `/map/${center.latitude.toFixed(5)}/${center.longitude.toFixed(5)}?${query.toString()}`;
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
}

/** Reads the location view's route. Null when the coordinates are missing or invalid. */
export function parseLocationMapRoute(
  params: Record<string, unknown>,
  query: Record<string, unknown>,
): { center: MapCenter; selectedGameId: string | null } | null {
  const latitude = Number(firstString(params.lat));
  const longitude = Number(firstString(params.lng));
  const point = { latitude, longitude };

  if (firstString(params.lat) === null || firstString(params.lng) === null || !isValidPoint(point)) {
    return null;
  }

  const name = firstString(query.name)?.trim() || 'Selected location';

  return { center: { ...point, name }, selectedGameId: firstString(query.game) };
}

/** What a game needs to be put on a map. DiscoveredGame and ApiGame both fit. */
export interface PlaceableGame {
  id: string;
  sport: { name: string };
  gameDate: string;
  startTime: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
}

export interface GamePlace<T extends PlaceableGame = PlaceableGame> extends MapPoint {
  key: string;
  name: string;
  /** Earliest first. */
  games: T[];
}

/** A game's map position, or null when it has no (valid) coordinates. Never 0,0 as a fallback. */
export function gamePoint(game: PlaceableGame): MapPoint | null {
  if (game.latitude === null || game.longitude === null) {
    return null;
  }

  const point = { latitude: game.latitude, longitude: game.longitude };
  return isValidPoint(point) ? point : null;
}

/**
 * Games grouped by place so several games and sports at one venue share a marker. Places
 * keep the order the games arrived in (the server sends nearest first); games without
 * coordinates are left out because they have no position.
 */
export function groupGamesByPlace<T extends PlaceableGame>(games: readonly T[]): GamePlace<T>[] {
  const places: GamePlace<T>[] = [];

  for (const game of games) {
    const point = gamePoint(game);

    if (!point) {
      continue;
    }

    const place = places.find((candidate) => distanceBetweenKm(candidate, point) <= SAME_PLACE_KM);

    if (place) {
      place.games.push(game);
    } else {
      places.push({
        key: `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`,
        name: game.locationName,
        ...point,
        games: [game],
      });
    }
  }

  for (const place of places) {
    place.games.sort((a, b) => `${a.gameDate} ${a.startTime}`.localeCompare(`${b.gameDate} ${b.startTime}`));
  }

  return places;
}

/** One emoji per sport played at a place, in start-time order (🏐 🏀 🏸). */
export function placeMarkers(place: Pick<GamePlace, 'games'>): string[] {
  return [...new Set(place.games.map((game) => getSportMarker(game.sport.name)))];
}

/**
 * Position on the placeholder preview, in percent of its width and height, with the
 * selected location in the middle. A flat projection is fine over a few kilometers.
 */
export function projectToPreview(point: MapPoint, center: MapPoint, radiusKm: number): { left: number; top: number } {
  const kmPerDegree = (Math.PI / 180) * EARTH_RADIUS_KM;
  const eastKm = (point.longitude - center.longitude) * kmPerDegree * Math.cos(toRadians(center.latitude));
  const northKm = (point.latitude - center.latitude) * kmPerDegree;
  const scale = 42 / radiusKm;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  return {
    left: clamp(50 + eastKm * scale, 6, 94),
    top: clamp(50 - northKm * scale, 8, 92),
  };
}
