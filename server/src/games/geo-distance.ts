/**
 * Straight-line distance on the Earth's surface (Haversine), in kilometres. This is the
 * only place GORA measures distance on the server, so it can later be replaced by
 * PostGIS (ST_DWithin / ST_Distance) without touching the discovery rules.
 */

export const EARTH_RADIUS_KM = 6371;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoBoundingBox {
  minLatitude: number;
  maxLatitude: number;
  /** Null when the box wraps the poles or the antimeridian: every longitude matches. */
  minLongitude: number | null;
  maxLongitude: number | null;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Two decimals: 1.234 km -> 1.23 km. */
export function roundDistanceKm(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A box that contains every point within radiusKm of the center. It only narrows the
 * database query (it uses the latitude/longitude index); the exact radius check is
 * distanceKm afterwards.
 */
export function boundingBox(
  center: GeoPoint,
  radiusKm: number,
): GeoBoundingBox {
  const latitudeDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const minLatitude = center.latitude - latitudeDelta;
  const maxLatitude = center.latitude + latitudeDelta;

  if (minLatitude <= -90 || maxLatitude >= 90) {
    return {
      minLatitude: Math.max(minLatitude, -90),
      maxLatitude: Math.min(maxLatitude, 90),
      minLongitude: null,
      maxLongitude: null,
    };
  }

  const longitudeDelta =
    latitudeDelta / Math.cos(toRadians(Math.abs(center.latitude)));
  const minLongitude = center.longitude - longitudeDelta;
  const maxLongitude = center.longitude + longitudeDelta;

  if (minLongitude < -180 || maxLongitude > 180) {
    return { minLatitude, maxLatitude, minLongitude: null, maxLongitude: null };
  }

  return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}
