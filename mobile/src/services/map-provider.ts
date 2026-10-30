import type { MapPoint } from '@/utils/location-map';

/**
 * Which map draws the discovery markers. The discovery rules (which games, where, how
 * far) never depend on it: a provider only draws markers and reports taps. Choose one
 * with VITE_MAP_PROVIDER. OSM works without a key; Google Maps is an optional keyed provider.
 */

export type MapProviderId = 'placeholder' | 'google' | 'mapbox' | 'osm';

export const MAP_PROVIDER_LABELS: Record<MapProviderId, string> = {
  placeholder: 'Map preview',
  google: 'Google Maps',
  mapbox: 'Mapbox',
  osm: 'OpenStreetMap',
};

/** Providers with an adapter in this build. */
export const IMPLEMENTED_MAP_PROVIDERS: readonly MapProviderId[] = ['placeholder', 'google', 'osm'];

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
  activeCount: number;
  upcomingCount: number;
}

/** The contract every provider adapter component implements. */
export interface MapCanvasProps {
  center: MapPoint;
  /** Half the visible width, in km. */
  radiusKm: number;
  /** Draw the search radius (only when a distance filter applies). */
  showRadius: boolean;
  /** Fit the map to all game markers (used by the all Philippines map). */
  fitMarkers?: boolean;
  markers: MapMarker[];
  selectedKey: string | null;
  /** Only used to draw the location marker; Google receives coordinates when its map is enabled. */
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

  if (requested === null) return { id: 'osm', requested: null, hasApiKey, notice: null };

  if (requested === 'placeholder') {
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
