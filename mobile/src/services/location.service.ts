import { isValidPoint, type MapPoint } from '@/utils/location-map';

/**
 * Device readings are never stored by this service. Discovery uses a rounded point only
 * for searches. A post author can explicitly select and confirm a precise point to attach
 * to a post; that location follows the post's audience.
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

function roundCoordinate(value: number, decimals = COORDINATE_DECIMALS): number {
  const factor = 10 ** decimals;
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
export function getCurrentLocation(
  timeoutMs = LOCATION_TIMEOUT_MS,
  options: { precise?: boolean } = {},
): Promise<LocationResult> {
  const provider = geolocation();

  if (!provider) {
    return Promise.resolve({ ok: false, reason: 'UNSUPPORTED' });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    // Some browsers leave a permission prompt pending beyond their native timeout.
    const deadline = setTimeout(() => finish({ ok: false, reason: 'TIMEOUT' }), timeoutMs);
    try {
      provider.getCurrentPosition(
        (position) => {
          const point = {
            latitude: roundCoordinate(position.coords.latitude, options.precise ? 6 : COORDINATE_DECIMALS),
            longitude: roundCoordinate(position.coords.longitude, options.precise ? 6 : COORDINATE_DECIMALS),
          };
          finish(isValidPoint(point) ? { ok: true, point } : { ok: false, reason: 'UNAVAILABLE' });
        },
        (error) => finish({ ok: false, reason: POSITION_ERROR_REASONS[error.code] ?? 'UNAVAILABLE' }),
        {
          enableHighAccuracy: options.precise === true,
          timeout: timeoutMs,
          maximumAge: options.precise ? 0 : 5 * 60_000,
        },
      );
    } catch {
      finish({ ok: false, reason: 'UNAVAILABLE' });
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
