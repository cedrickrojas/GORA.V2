import type { MapPoint } from '@/utils/location-map';

/**
 * The device location, used only to center the map and measure distance to games. It is
 * never saved (no User column, no table, no storage) and never shown to anyone else; the
 * only place it goes is the latitude/longitude of a discovery search.
 */

export type LocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type LocationFailure = 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';

export type LocationResult = { ok: true; point: MapPoint } | { ok: false; reason: LocationFailure };

export const LOCATION_UNAVAILABLE_MESSAGE =
  'Location access is unavailable. You can still browse GORA games by sport and date.';

export const LOCATION_TIMEOUT_MS = 10_000;

/** About 110 m: plenty for "1.2 km away" and less precise than the device reading. */
const COORDINATE_DECIMALS = 3;

/** W3C GeolocationPositionError codes. */
const POSITION_ERROR_REASONS: Record<number, LocationFailure> = {
  1: 'DENIED',
  2: 'UNAVAILABLE',
  3: 'TIMEOUT',
};

function geolocation(): Geolocation | null {
  return typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null;
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function isLocationAvailable(): boolean {
  return geolocation() !== null;
}

/**
 * The permission state without asking. Browsers without the Permissions API answer
 * "prompt", so the app waits for the user to tap before asking.
 */
export async function checkPermission(): Promise<LocationPermissionState> {
  if (!isLocationAvailable()) {
    return 'unsupported';
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'prompt';
  }
}

/** One reading. Resolves (never rejects) with the point or why there is none. */
export function getCurrentLocation(timeoutMs = LOCATION_TIMEOUT_MS): Promise<LocationResult> {
  const provider = geolocation();

  if (!provider) {
    return Promise.resolve({ ok: false, reason: 'UNSUPPORTED' });
  }

  return new Promise((resolve) => {
    try {
      provider.getCurrentPosition(
        (position) =>
          resolve({
            ok: true,
            point: {
              latitude: roundCoordinate(position.coords.latitude),
              longitude: roundCoordinate(position.coords.longitude),
            },
          }),
        (error) => resolve({ ok: false, reason: POSITION_ERROR_REASONS[error.code] ?? 'UNAVAILABLE' }),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 },
      );
    } catch {
      resolve({ ok: false, reason: 'UNAVAILABLE' });
    }
  });
}

/**
 * Asks once, from a user action. On the web the browser shows its prompt on the first
 * reading, so asking and reading are the same call.
 */
export async function requestPermission(): Promise<LocationResult> {
  return getCurrentLocation();
}

export function describeLocationFailure(reason: LocationFailure): string {
  switch (reason) {
    case 'DENIED':
      return LOCATION_UNAVAILABLE_MESSAGE;
    case 'TIMEOUT':
      return 'Finding your location took too long. You can still browse GORA games by sport and date.';
    case 'UNSUPPORTED':
      return 'This device cannot share its location. You can still browse GORA games by sport and date.';
    case 'UNAVAILABLE':
      return LOCATION_UNAVAILABLE_MESSAGE;
  }
}
