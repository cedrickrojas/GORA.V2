<template>
  <section class="game-location-preview" :aria-label="`Map for ${name}`">
    <div ref="container" class="game-location-preview__map" />
    <div class="game-location-preview__footer">
      <span><strong>{{ name }}</strong><small>{{ latitude.toFixed(5) }}, {{ longitude.toFixed(5) }}</small></span>
      <router-link :to="mapPath" class="game-location-preview__open">Open map</router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { divIcon, map as createMap, marker, tileLayer, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{ name: string; latitude: number; longitude: number; mapPath: string }>();
const container = ref<HTMLElement | null>(null);
let map: LeafletMap | null = null;

onMounted(() => {
  if (!container.value) return;
  const point: [number, number] = [props.latitude, props.longitude];
  map = createMap(container.value, { center: point, zoom: 15, scrollWheelZoom: false, worldCopyJump: true });
  tileLayer(import.meta.env.VITE_LOCATION_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    keepBuffer: 1,
    updateWhenIdle: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }).addTo(map);
  marker(point, {
    title: props.name,
    icon: divIcon({ className: 'game-location-preview__pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 36] }),
  }).addTo(map);
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>

<style scoped>
.game-location-preview {
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
}
.game-location-preview__map {
  width: 100%;
  height: 210px;
  background: #dce2df;
}
.game-location-preview__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
}
.game-location-preview__footer > span { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.game-location-preview__footer strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.game-location-preview__footer small { color: var(--gora-muted); font-size: .72rem; }
.game-location-preview__open { color: var(--ion-color-primary); font-size: .82rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
.game-location-preview :deep(.game-location-preview__pin) { border: 0; background: transparent; }
.game-location-preview :deep(.game-location-preview__pin span) {
  display: block;
  width: 25px;
  height: 25px;
  border: 3px solid #fff;
  border-radius: 50% 50% 50% 0;
  background: var(--ion-color-primary);
  box-shadow: 0 2px 7px #0007;
  transform: rotate(-45deg);
}
.game-location-preview :deep(.leaflet-control-attribution) { font-size: 9px; }
</style>
