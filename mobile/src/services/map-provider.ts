import type { MapPoint } from '@/utils/location-map';

/**
 * Which map draws the discovery markers. The discovery rules (which games, where, how
 * far) never depend on it: a provider only draws markers and reports taps. Choose one
 * with VITE_MAP_PROVIDER (and its key in VITE_MAP_API_KEY); nothing is hardcoded. Until
 * a provider adapter is added, every choice falls back to the built-in preview, which
 * needs no key and no network.
 */

export type MapProviderId = 'placeholder' | 'google' | 'mapbox' | 'osm';

export const MAP_PROVIDER_LABELS: Record<MapProviderId, string> = {
  placeholder: 'Map preview',
  google: 'Google Maps',
  mapbox: 'Mapbox',
  osm: 'OpenStreetMap',
};

/** Providers with an adapter in this build. Add 'google' | 'mapbox' | 'osm' with theirs. */
export const IMPLEMENTED_MAP_PROVIDERS: readonly MapProviderId[] = ['placeholder'];

/** OpenStreetMap tiles need no key; the others do. */
const KEYLESS_PROVIDERS: readonly MapProviderId[] = ['placeholder', 'osm'];

export interface MapProviderConfig {
  /** The provider that actually draws the map. */
  id: MapProviderId;
  /** What VITE_MAP_PROVIDER asked for, when it differs from id. */
  requested: MapProviderId | null;
  /** Whether a key is configured. The key itself never leaves the adapter. */
  hasApiKey: boolean;
  /** Why the preview is shown instead of an interactive map, or null. */
  notice: string | null;
}

/** One marker = one place; several games and sports can share it. */
export interface MapMarker extends MapPoint {
  key: string;
  label: string;
  /** One emoji per sport at the place, from getSportMarker. */
  symbols: string[];
  gameCount: number;
}

/** The contract every provider adapter component implements. */
export interface MapCanvasProps {
  center: MapPoint;
  /** Half the visible width, in km. */
  radiusKm: number;
  /** Draw the search radius (only when a distance filter applies). */
  showRadius: boolean;
  markers: MapMarker[];
  selectedKey: string | null;
  /** Shown as "You are here"; never sent to the provider as an account location. */
  userLocation: MapPoint | null;
}

export interface MapProviderEnv {
  VITE_MAP_PROVIDER?: string;
  VITE_MAP_API_KEY?: string;
}

function readProvider(value: string | undefined): MapProviderId | null {
  const normalized = value?.trim().toLowerCase() ?? '';

  if (normalized === '' || normalized === 'none') {
    return null;
  }

  return (Object.keys(MAP_PROVIDER_LABELS) as MapProviderId[]).find((id) => id === normalized) ?? null;
}

export function resolveMapProvider(env: MapProviderEnv = import.meta.env): MapProviderConfig {
  const requested = readProvider(env.VITE_MAP_PROVIDER);
  const hasApiKey = (env.VITE_MAP_API_KEY?.trim() ?? '') !== '';

  if (requested === null || requested === 'placeholder') {
    return {
      id: 'placeholder',
      requested: null,
      hasApiKey,
      notice: 'Map preview: no map provider is set up, so markers are placed around the center without street tiles.',
    };
  }

  if (!KEYLESS_PROVIDERS.includes(requested) && !hasApiKey) {
    return {
      id: 'placeholder',
      requested,
      hasApiKey,
      notice: `${MAP_PROVIDER_LABELS[requested]} needs VITE_MAP_API_KEY. Showing the map preview instead.`,
    };
  }

  if (!IMPLEMENTED_MAP_PROVIDERS.includes(requested)) {
    return {
      id: 'placeholder',
      requested,
      hasApiKey,
      notice: `${MAP_PROVIDER_LABELS[requested]} is not connected yet. Showing the map preview instead.`,
    };
  }

  return { id: requested, requested: null, hasApiKey, notice: null };
}
