<template>
  <div class="google-map-canvas" role="group" aria-label="Google Map of GORA games">
    <div v-if="loadError" class="google-map-canvas__error" role="status">{{ loadError }}</div>
    <div ref="container" class="google-map-canvas__map" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GoogleAdvancedMarker, GoogleMapInstance, GoogleMapsLibraries } from '@/services/google-maps';
import { configuredGoogleMapId, googlePoint, loadGoogleMaps } from '@/services/google-maps';
import type { MapCanvasProps } from '@/services/map-provider';

const props = defineProps<MapCanvasProps>();
const emit = defineEmits<{ select: [key: string] }>();
const container = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
let map: GoogleMapInstance | null = null;
let libraries: GoogleMapsLibraries | null = null;
let radiusCircle: InstanceType<GoogleMapsLibraries['maps']['Circle']> | null = null;
let userMarker: GoogleAdvancedMarker | null = null;
let placeMarkers: GoogleAdvancedMarker[] = [];
let resizeObserver: ResizeObserver | null = null;
let active = true;

function markerContent(item: MapCanvasProps['markers'][number], selected: boolean): HTMLElement {
  const root = document.createElement('div');
  if (props.fitMarkers) {
    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');
    const pin = document.createElement('span');
    const state = item.activeCount && item.upcomingCount ? 'mixed' : item.activeCount ? 'active' : 'upcoming';
    pin.textContent = item.gameCount > 1 ? String(item.gameCount) : item.symbols[0] ?? '●';
    pin.setAttribute('aria-label', `${item.gameCount} ${item.gameCount === 1 ? 'game' : 'games'} at ${item.label}`);
    pin.style.cssText = [
      'display:grid', 'width:25px', 'height:25px', 'place-items:center', 'border:2px solid white',
      'border-radius:50%', `background:${state === 'active' ? '#df4843' : state === 'upcoming' ? '#ed922b' : '#ed6c27'}`,
      'color:white', 'font:800 11px/1 system-ui,sans-serif', 'box-shadow:0 1px 5px #0008',
    ].join(';');
    root.append(pin);
    return root;
  }
  root.setAttribute('role', 'button');
  root.setAttribute('tabindex', '0');
  root.style.cssText = [
    'display:flex', 'align-items:center', 'gap:3px', 'padding:5px 8px',
    `border:2px solid ${selected ? '#f47820' : '#ffffff'}`, 'border-radius:999px',
    `background:${selected ? '#f47820' : '#102333'}`, 'color:white',
    'box-shadow:0 2px 9px #0007', 'font:700 16px/1.15 system-ui,sans-serif',
    'white-space:nowrap', 'cursor:pointer', 'user-select:none',
  ].join(';');
  root.setAttribute('aria-label', `${item.gameCount} ${item.gameCount === 1 ? 'game' : 'games'} at this location; ${item.activeCount} active, ${item.upcomingCount} upcoming`);
  root.append(document.createTextNode(item.symbols.slice(0, 3).join('')));
  if (item.gameCount > 1) {
    const total = document.createElement('span');
    total.textContent = String(item.gameCount);
    total.style.cssText = 'margin-left:2px;padding:1px 5px;border-radius:999px;background:#fff;color:#102333;font-size:11px';
    root.append(total);
  }
  for (const [count, label, color] of [
    [item.activeCount, 'Active', '#15803d'],
    [item.upcomingCount, 'Upcoming', '#c75a0a'],
  ] as const) {
    if (!count) continue;
    const status = document.createElement('span');
    status.textContent = `${count} ${label}`;
    status.style.cssText = `margin-left:2px;padding:2px 5px;border:1px solid white;border-radius:999px;background:${color};font-size:9px;line-height:1.1`;
    root.append(status);
  }
  return root;
}

function clearMarkers(): void {
  for (const item of placeMarkers) item.map = null;
  placeMarkers = [];
}

function renderMarkers(): void {
  if (!map || !libraries) return;
  clearMarkers();
  placeMarkers = props.markers.map((item) => {
    const marker = new libraries!.AdvancedMarkerElement({
      map,
      position: googlePoint(item),
      title: `${item.label}: ${item.gameCount} ${item.gameCount === 1 ? 'game' : 'games'}`,
      content: markerContent(item, item.key === props.selectedKey),
      gmpClickable: true,
    });
    marker.addEventListener('gmp-click', () => emit('select', item.key));
    marker.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') emit('select', item.key);
    });
    return marker;
  });
}

function updateMap(): void {
  if (!map || !libraries) return;
  const center = googlePoint(props.center);
  if (props.fitMarkers && props.markers.length) {
    const bounds = new libraries.maps.LatLngBounds();
    // Keep the national shape in view even when current games sit in just one region.
    bounds.extend({ lat: 4.3, lng: 116 });
    bounds.extend({ lat: 21.5, lng: 127.5 });
    for (const item of props.markers) bounds.extend(googlePoint(item));
    map.fitBounds(bounds, 32);
  } else {
    map.setCenter(center);
    const zoom = props.fitMarkers ? 5 : props.radiusKm > 0 ? Math.max(8, Math.min(17, Math.round(Math.log2(40075 / (2 * props.radiusKm))))) : 12;
    map.setZoom(zoom);
  }
  radiusCircle?.setMap(null);
  radiusCircle = props.showRadius
    ? new libraries.maps.Circle({
        map,
        center,
        radius: props.radiusKm * 1000,
        strokeColor: '#ef7624',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: '#ef7624',
        fillOpacity: 0.1,
        clickable: false,
      })
    : null;

  if (props.userLocation) {
    const dot = document.createElement('span');
    dot.style.cssText = 'display:block;width:15px;height:15px;border:3px solid white;border-radius:50%;background:#2784ff;box-shadow:0 0 0 5px #2784ff44';
    if (!userMarker) {
      userMarker = new libraries.AdvancedMarkerElement({ map, title: 'Your current location', content: dot, zIndex: 1000 });
    }
    userMarker.position = googlePoint(props.userLocation);
  } else if (userMarker) {
    userMarker.map = null;
    userMarker = null;
  }
  renderMarkers();
}

onMounted(async () => {
  try {
    libraries = await loadGoogleMaps();
    if (!active || !container.value) return;
    map = new libraries.maps.Map(container.value, {
      center: googlePoint(props.center),
      zoom: 12,
      mapId: configuredGoogleMapId(),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy',
    });
    updateMap();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => map?.setCenter(googlePoint(props.center)));
      resizeObserver.observe(container.value);
    }
  } catch {
    if (active) loadError.value = 'Google Maps could not load. Check the map API key and try again.';
  }
});

watch(() => [props.center.latitude, props.center.longitude, props.radiusKm, props.showRadius, props.userLocation?.latitude, props.userLocation?.longitude, props.fitMarkers, props.markers], updateMap, { deep: true });
watch(() => [props.markers, props.selectedKey], renderMarkers, { deep: true });

onBeforeUnmount(() => {
  active = false;
  resizeObserver?.disconnect();
  clearMarkers();
  radiusCircle?.setMap(null);
  if (userMarker) userMarker.map = null;
  map = null;
});
</script>

<style scoped>
.google-map-canvas,
.google-map-canvas__map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.google-map-canvas__error {
  position: absolute;
  z-index: 2;
  inset: 0 0 auto;
  padding: 10px 14px;
  background: #fff4e8;
  color: #8a3e00;
  font-size: .8rem;
}
</style>
