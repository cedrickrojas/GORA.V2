<template>
  <div class="location-map-picker">
    <p class="location-map-picker__hint">Tap the map or drag the pin to choose a location.</p>
    <div ref="container" class="location-map-picker__canvas" aria-label="Choose a location on the map" />
    <p v-if="tilesUnavailable" class="location-map-picker__error" role="status">
      Street tiles could not load. Check your connection or choose a place from the list.
    </p>
    <button type="button" class="location-map-picker__center" @click="selectCenter">Use map center</button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  divIcon,
  map as createMap,
  marker,
  tileLayer,
  type Map as LeafletMap,
  type Marker,
  type LeafletMouseEvent,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidPoint, type MapPoint } from '@/utils/location-map';

const props = defineProps<{ center: MapPoint; point: MapPoint | null }>();
const emit = defineEmits<{ select: [point: MapPoint] }>();
const container = ref<HTMLElement | null>(null);
const tilesUnavailable = ref(false);
let map: LeafletMap | null = null;
let pin: Marker | null = null;
let observer: ResizeObserver | null = null;
const icon = divIcon({
  className: 'location-map-picker__pin',
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

function select(point: MapPoint): void {
  const normalized = { latitude: Number(point.latitude.toFixed(6)), longitude: Number(point.longitude.toFixed(6)) };
  if (isValidPoint(normalized)) emit('select', normalized);
}

function selectCenter(): void {
  const center = map?.getCenter().wrap();
  if (center) select({ latitude: center.lat, longitude: center.lng });
}

function updatePin(): void {
  if (!map || !props.point || !isValidPoint(props.point)) {
    pin?.remove();
    pin = null;
    return;
  }
  const coords: [number, number] = [props.point.latitude, props.point.longitude];
  if (pin) pin.setLatLng(coords);
  else {
    pin = marker(coords, { icon, draggable: true, title: 'Selected location. Drag to move.', autoPan: true }).addTo(
      map,
    );
    pin.on('dragend', () => {
      const position = pin?.getLatLng().wrap();
      if (position) select({ latitude: position.lat, longitude: position.lng });
    });
  }
}

watch([() => props.point?.latitude, () => props.point?.longitude], updatePin);
watch([() => props.center.latitude, () => props.center.longitude], () => {
  if (map && isValidPoint(props.center)) map.panTo([props.center.latitude, props.center.longitude], { animate: false });
});

onMounted(() => {
  if (!container.value || !isValidPoint(props.center)) return;
  map = createMap(container.value, {
    center: [props.center.latitude, props.center.longitude],
    zoom: 15,
    minZoom: 2,
    maxZoom: 19,
    scrollWheelZoom: false,
    worldCopyJump: true,
  });
  tileLayer(import.meta.env.VITE_LOCATION_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    keepBuffer: 1,
    updateWhenIdle: true,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
    .on('tileerror', () => {
      tilesUnavailable.value = true;
    })
    .on('tileload', () => {
      tilesUnavailable.value = false;
    })
    .addTo(map);
  map.on('click', (event: LeafletMouseEvent) => {
    const position = event.latlng.wrap();
    select({ latitude: position.lat, longitude: position.lng });
  });
  updatePin();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      map?.invalidateSize({ pan: false });
    });
    observer.observe(container.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  map?.remove();
  map = null;
  pin = null;
});
</script>

<style scoped>
.location-map-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.location-map-picker__hint,
.location-map-picker__error {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.78rem;
}
.location-map-picker__error {
  color: #ffb45c;
}
.location-map-picker__canvas {
  width: 100%;
  height: 300px;
  min-height: 240px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  background: #dce2df;
  color: #202322;
  touch-action: none;
}
.location-map-picker__canvas:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}
.location-map-picker__center {
  align-self: flex-start;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.location-map-picker__canvas :deep(.location-map-picker__pin) {
  background: transparent;
  border: 0;
}
.location-map-picker__canvas :deep(.location-map-picker__pin span) {
  display: block;
  width: 28px;
  height: 28px;
  border: 3px solid #fff;
  border-radius: 50% 50% 50% 0;
  background: var(--ion-color-primary);
  box-shadow: 0 2px 6px #0006;
  transform: rotate(-45deg);
}
.location-map-picker__canvas :deep(.leaflet-control-attribution) {
  font-size: 10px;
}
@media (max-width: 420px) {
  .location-map-picker__canvas {
    height: 260px;
  }
}
</style>
