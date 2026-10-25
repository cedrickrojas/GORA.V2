import type { LocationFailure } from '@/services/location.service';
import type { MapPoint } from './location-map';

/** Initial browsing center only; never attached to a post without explicit selection. */
export const LOCATION_PICKER_CENTER: MapPoint = { latitude: 14.5995, longitude: 120.9842 };

export function describeLocationPickerFailure(reason: LocationFailure): string {
  switch (reason) {
    case 'DENIED':
      return 'Location permission was denied. Allow location access in your browser settings, or select a place on the map.';
    case 'TIMEOUT':
      return 'Finding your location took too long. Try again, or select a place on the map.';
    case 'UNSUPPORTED':
      return 'Location access is not supported here. Select a place on the map instead.';
    case 'UNAVAILABLE':
      return 'Your location could not be found. Try again, or select a place on the map.';
  }
}
