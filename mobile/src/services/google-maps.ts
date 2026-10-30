import type { MapPoint } from '@/utils/location-map';

interface GooglePoint {
  lat: number;
  lng: number;
}

export interface GoogleMapInstance {
  setCenter(point: GooglePoint): void;
  setZoom(zoom: number): void;
  getCenter(): GoogleCenter | null;
  fitBounds(bounds: GoogleBounds, padding?: number): void;
  addListener(event: 'click', handler: (event: GoogleMapClickEvent) => void): GoogleListener;
}

export interface GoogleCenter {
  lat(): number;
  lng(): number;
}

export interface GoogleBounds {
  extend(point: GooglePoint): void;
  isEmpty(): boolean;
}

export interface GoogleMapClickEvent {
  latLng?: { lat(): number; lng(): number } | null;
}

export interface GoogleAdvancedMarker extends HTMLElement {
  map: GoogleMapInstance | null;
  position: GooglePoint | MapPoint | null;
  title: string;
  gmpDraggable?: boolean;
}

export interface GoogleListener {
  remove(): void;
}

export interface GoogleMapsLibraries {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Circle: new (options: Record<string, unknown>) => { setMap(map: GoogleMapInstance | null): void };
    LatLngBounds: new () => GoogleBounds;
  };
  AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleAdvancedMarker;
}

interface GoogleMapsNamespace {
  importLibrary(name: string): Promise<unknown>;
}

interface GoogleMapsWindow extends Window {
  google?: { maps?: GoogleMapsNamespace };
  __goraGoogleMapsReady?: () => void;
}

let loader: Promise<GoogleMapsLibraries> | null = null;

export function loadGoogleMaps(): Promise<GoogleMapsLibraries> {
  if (!loader) loader = loadLibraries().catch((error: unknown) => {
    loader = null;
    throw error;
  });
  return loader;
}

async function loadLibraries(): Promise<GoogleMapsLibraries> {
  const key = import.meta.env.VITE_MAP_API_KEY?.trim();
  if (!key) throw new Error('Google Maps needs VITE_MAP_API_KEY.');

  const browser = window as GoogleMapsWindow;
  if (!browser.google?.maps?.importLibrary) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('gora-google-maps-api') as HTMLScriptElement | null;
      const script = existing ?? document.createElement('script');
      const clean = () => {
        delete browser.__goraGoogleMapsReady;
        script.removeEventListener('error', onError);
      };
      const onError = () => {
        clean();
        reject(new Error('Google Maps could not load. Check the API key and Maps JavaScript API settings.'));
      };
      browser.__goraGoogleMapsReady = () => {
        clean();
        resolve();
      };
      script.addEventListener('error', onError, { once: true });
      if (!existing) {
        const url = new URL('https://maps.googleapis.com/maps/api/js');
        url.searchParams.set('key', key);
        url.searchParams.set('v', 'weekly');
        url.searchParams.set('loading', 'async');
        url.searchParams.set('callback', '__goraGoogleMapsReady');
        script.id = 'gora-google-maps-api';
        script.async = true;
        script.src = url.toString();
        document.head.append(script);
      }
    });
  }

  const mapsNamespace = browser.google?.maps;
  if (!mapsNamespace) throw new Error('Google Maps did not initialize.');
  const [maps, markerLibrary] = await Promise.all([
    mapsNamespace.importLibrary('maps'),
    mapsNamespace.importLibrary('marker'),
  ]);
  return {
    maps: maps as GoogleMapsLibraries['maps'],
    AdvancedMarkerElement: (markerLibrary as { AdvancedMarkerElement: GoogleMapsLibraries['AdvancedMarkerElement'] }).AdvancedMarkerElement,
  };
}

export function googlePoint(point: MapPoint): GooglePoint {
  return { lat: point.latitude, lng: point.longitude };
}

export function configuredGoogleMapId(): string {
  return import.meta.env.VITE_GOOGLE_MAP_ID?.trim() || 'DEMO_MAP_ID';
}
