<template>
  <div class="google-location-picker">
    <div ref="container" class="google-location-picker__map" aria-label="Choose a location on Google Maps" />
    <p v-if="loadError" class="google-location-picker__error" role="status">{{ loadError }}</p>
    <button type="button" class="google-location-picker__center" @click="selectCenter">Use map center</button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GoogleAdvancedMarker, GoogleListener, GoogleMapInstance } from '@/services/google-maps';
import { configuredGoogleMapId, googlePoint, loadGoogleMaps } from '@/services/google-maps';
import { isValidPoint, type MapPoint } from '@/utils/location-map';

const props = defineProps<{ center: MapPoint; point: MapPoint | null }>();
const emit = defineEmits<{ select: [point: MapPoint] }>();
const container = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
let map: GoogleMapInstance | null = null;
let pin: GoogleAdvancedMarker | null = null;
let mapClick: GoogleListener | null = null;
let active = true;

function select(point: MapPoint): void {
  const normalized = { latitude: Number(point.latitude.toFixed(6)), longitude: Number(point.longitude.toFixed(6)) };
  if (isValidPoint(normalized)) emit('select', normalized);
}

function updatePin(): void {
  if (!map || !props.point || !isValidPoint(props.point)) {
    if (pin) pin.map = null;
    pin = null;
    return;
  }
  if (!pin) {
    const content = document.createElement('span');
    content.style.cssText = 'display:block;width:24px;height:24px;border:3px solid white;border-radius:50% 50% 50% 0;background:#f47820;box-shadow:0 2px 7px #0007;transform:rotate(-45deg)';
    pin = new googleMaps!.AdvancedMarkerElement({
      map,
      title: 'Selected location. Drag to move.',
      content,
      gmpDraggable: true,
    });
    pin.addEventListener('dragend', () => {
      const position = pin?.position;
      if (position && 'lat' in position) select({ latitude: position.lat, longitude: position.lng });
    });
  }
  pin.position = googlePoint(props.point);
}

let googleMaps: Awaited<ReturnType<typeof loadGoogleMaps>> | null = null;

function selectCenter(): void {
  const center = map?.getCenter();
  if (center) select({ latitude: center.lat(), longitude: center.lng() });
}

watch([() => props.point?.latitude, () => props.point?.longitude], updatePin);
watch([() => props.center.latitude, () => props.center.longitude], () => {
  if (map && isValidPoint(props.center)) map.setCenter(googlePoint(props.center));
});

onMounted(async () => {
  try {
    googleMaps = await loadGoogleMaps();
    if (!active || !container.value) return;
    map = new googleMaps.maps.Map(container.value, {
      center: googlePoint(props.center),
      zoom: 15,
      mapId: configuredGoogleMapId(),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });
    mapClick = map.addListener('click', (event) => {
      const location = event.latLng;
      if (location) select({ latitude: location.lat(), longitude: location.lng() });
    });
    updatePin();
  } catch {
    if (active) loadError.value = 'Google Maps could not load. Check the map API key and try again.';
  }
});

onBeforeUnmount(() => {
  active = false;
  mapClick?.remove();
  if (pin) pin.map = null;
  pin = null;
  map = null;
});
</script>

<style scoped>
.google-location-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.google-location-picker__map {
  width: 100%;
  height: 300px;
  min-height: 240px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  background: #dce2df;
}
.google-location-picker__error {
  margin: 0;
  color: #8a3e00;
  font-size: .78rem;
}
.google-location-picker__center {
  align-self: flex-start;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  font: inherit;
  font-size: .8rem;
  cursor: pointer;
}
</style>
