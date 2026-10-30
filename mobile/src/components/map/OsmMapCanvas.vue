<template>
  <div class="osm-map-canvas" role="group" aria-label="OpenStreetMap of GORA games">
    <div ref="container" class="osm-map-canvas__map" />
    <p v-if="tilesUnavailable" class="osm-map-canvas__error" role="status">
      Map tiles are temporarily unavailable. Try again in a moment.
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  circle,
  divIcon,
  latLngBounds,
  map as createMap,
  marker,
  tileLayer,
  type Circle as LeafletCircle,
  type Map as LeafletMap,
  type Marker as LeafletMarker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapCanvasProps, MapMarker } from '@/services/map-provider';
import { isValidPoint } from '@/utils/location-map';

const props = defineProps<MapCanvasProps>();
const emit = defineEmits<{ select: [key: string] }>();
const container = ref<HTMLElement | null>(null);
const tilesUnavailable = ref(false);
let map: LeafletMap | null = null;
let radius: LeafletCircle | null = null;
let userLocation: LeafletMarker | null = null;
let placeMarkers: LeafletMarker[] = [];
let resizeObserver: ResizeObserver | null = null;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function placeIcon(item: MapMarker) {
  const symbols = item.symbols.slice(0, 3).map(escapeHtml).join('');
  if (props.fitMarkers) {
    const state = item.activeCount && item.upcomingCount ? 'mixed' : item.activeCount ? 'active' : 'upcoming';
    const label = item.gameCount > 1 ? item.gameCount : symbols.slice(0, 2);
    return divIcon({
      className: 'osm-map-marker osm-map-marker--country',
      html: `<span class="osm-map-marker__country-pin osm-map-marker__country-pin--${state}">${label}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
  const count = item.gameCount > 1 ? `<span class="osm-map-marker__count">${item.gameCount}</span>` : '';
  const statuses = [
    item.activeCount ? `<span class="osm-map-marker__status osm-map-marker__status--active">${item.activeCount} Active</span>` : '',
    item.upcomingCount ? `<span class="osm-map-marker__status osm-map-marker__status--upcoming">${item.upcomingCount} Upcoming</span>` : '',
  ].join('');
  const selected = item.key === props.selectedKey ? ' osm-map-marker--selected' : '';
  return divIcon({
    className: `osm-map-marker${selected}`,
    html: `<span class="osm-map-marker__content"><span class="osm-map-marker__pill">${symbols}${count}</span><span class="osm-map-marker__statuses">${statuses}</span></span>`,
    iconSize: [104, 54],
    iconAnchor: [52, 20],
  });
}

function removeMarkers(): void {
  for (const item of placeMarkers) item.remove();
  placeMarkers = [];
}

function renderMarkers(): void {
  if (!map) return;
  removeMarkers();
  placeMarkers = props.markers.map((item) => {
    const pin = marker([item.latitude, item.longitude], {
      icon: placeIcon(item),
      title: `${item.label}: ${item.gameCount} ${item.gameCount === 1 ? 'game' : 'games'}; ${item.activeCount} active, ${item.upcomingCount} upcoming`,
      keyboard: true,
    }).addTo(map!);
    pin.on('click keypress', () => emit('select', item.key));
    pin.bindTooltip(`${item.label} · ${item.gameCount} ${item.gameCount === 1 ? 'game' : 'games'}`);
    return pin;
  });
}

function updateMap(): void {
  if (!map || !isValidPoint(props.center)) return;
  if (props.fitMarkers && props.markers.length) {
    // Keep the national shape in view even when current games sit in just one region.
    const points = [
      [4.3, 116] as [number, number],
      [21.5, 127.5] as [number, number],
      ...props.markers.map((item) => [item.latitude, item.longitude] as [number, number]),
    ];
    map.fitBounds(latLngBounds(points), { padding: [32, 32], maxZoom: 8, animate: false });
  } else {
    const zoom = props.fitMarkers ? 5 : props.radiusKm > 0 ? Math.max(7, Math.min(17, Math.round(Math.log2(40075 / (2 * props.radiusKm))))) : 12;
    map.setView([props.center.latitude, props.center.longitude], zoom, { animate: false });
  }

  radius?.remove();
  radius = props.showRadius
    ? circle([props.center.latitude, props.center.longitude], {
        radius: props.radiusKm * 1000,
        color: '#ef7624',
        weight: 2,
        opacity: 0.8,
        fillColor: '#ef7624',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(map)
    : null;

  if (props.userLocation) {
    const icon = divIcon({ className: 'osm-map-user', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] });
    if (!userLocation) userLocation = marker([props.userLocation.latitude, props.userLocation.longitude], { icon, title: 'Your current location', keyboard: false }).addTo(map);
    else userLocation.setLatLng([props.userLocation.latitude, props.userLocation.longitude]);
  } else if (userLocation) {
    userLocation.remove();
    userLocation = null;
  }
  renderMarkers();
}

onMounted(() => {
  if (!container.value || !isValidPoint(props.center)) return;
  map = createMap(container.value, {
    center: [props.center.latitude, props.center.longitude],
    zoom: 12,
    minZoom: 2,
    maxZoom: 19,
    scrollWheelZoom: false,
    worldCopyJump: true,
  });
  tileLayer(import.meta.env.VITE_LOCATION_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    keepBuffer: 1,
    updateWhenIdle: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
    .on('tileerror', () => { tilesUnavailable.value = true; })
    .on('tileload', () => { tilesUnavailable.value = false; })
    .addTo(map);
  updateMap();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
    resizeObserver.observe(container.value);
  }
});

watch(() => [props.center.latitude, props.center.longitude, props.radiusKm, props.showRadius, props.userLocation?.latitude, props.userLocation?.longitude, props.fitMarkers, props.markers], updateMap, { deep: true });
watch(() => [props.markers, props.selectedKey], renderMarkers, { deep: true });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  removeMarkers();
  radius?.remove();
  userLocation?.remove();
  map?.remove();
  map = null;
});
</script>

<style scoped>
.osm-map-canvas,
.osm-map-canvas__map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.osm-map-canvas__error {
  position: absolute;
  z-index: 700;
  inset: 0 0 auto;
  margin: 0;
  padding: 8px 12px;
  background: #fff4e8;
  color: #8a3e00;
  font-size: .78rem;
}

.osm-map-canvas :deep(.osm-map-marker) {
  border: 0;
  background: transparent;
}
.osm-map-canvas :deep(.osm-map-marker__content) {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 2px;
  width: 104px;
}
.osm-map-canvas :deep(.osm-map-marker__statuses) {
  display: flex;
  justify-content: center;
  gap: 3px;
}
.osm-map-canvas :deep(.osm-map-marker__status) {
  padding: 2px 5px;
  border: 1px solid #fff;
  border-radius: 999px;
  color: #fff;
  font: 700 9px/1.1 system-ui, sans-serif;
  white-space: nowrap;
  box-shadow: 0 1px 5px #0008;
}
.osm-map-canvas :deep(.osm-map-marker__status--active) { background: #15803d; }
.osm-map-canvas :deep(.osm-map-marker__status--upcoming) { background: #c75a0a; }
.osm-map-canvas :deep(.osm-map-marker__pill) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
  padding: 3px 7px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: #102333;
  box-shadow: 0 2px 9px #0007;
  color: #fff;
  font: 700 16px/1.1 system-ui, sans-serif;
  white-space: nowrap;
}
.osm-map-canvas :deep(.osm-map-marker--selected .osm-map-marker__pill) {
  border-color: #f47820;
  background: #f47820;
}
.osm-map-canvas :deep(.osm-map-marker__count) {
  margin-left: 2px;
  padding: 1px 5px;
  border-radius: 999px;
  background: #fff;
  color: #102333;
  font-size: 11px;
}
.osm-map-canvas :deep(.osm-map-marker__country-pin) {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
  font: 800 11px/1 system-ui, sans-serif;
  box-shadow: 0 1px 5px #0008;
}
.osm-map-canvas :deep(.osm-map-marker__country-pin--active) { background: #df4843; }
.osm-map-canvas :deep(.osm-map-marker__country-pin--upcoming) { background: #ed922b; }
.osm-map-canvas :deep(.osm-map-marker__country-pin--mixed) { background: #ed6c27; }
.osm-map-canvas :deep(.osm-map-user) { border: 0; background: transparent; }
.osm-map-canvas :deep(.osm-map-user span) {
  display: block;
  width: 15px;
  height: 15px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #2784ff;
  box-shadow: 0 0 0 5px #2784ff44;
}
.osm-map-canvas :deep(.leaflet-control-attribution) { font-size: 10px; }
</style>
