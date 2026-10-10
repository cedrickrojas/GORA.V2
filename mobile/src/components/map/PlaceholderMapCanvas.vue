<template>
  <div class="map-canvas" role="group" aria-label="Map of GORA games">
    <span v-if="showRadius" class="map-canvas__ring" aria-hidden="true" />
    <span v-if="userPosition" class="map-canvas__you" :style="userPosition" aria-label="Your location">
      <span class="map-canvas__you-dot" />
    </span>
    <span v-else class="map-canvas__center" aria-hidden="true">+</span>

    <button
      v-for="marker in markers"
      :key="marker.key"
      type="button"
      class="map-canvas__marker"
      :class="{ 'map-canvas__marker--active': marker.key === selectedKey }"
      :style="positionOf(marker)"
      :aria-label="markerLabel(marker)"
      :aria-pressed="marker.key === selectedKey"
      @click="emit('select', marker.key)"
    >
      <span v-for="symbol in marker.symbols" :key="symbol" aria-hidden="true">{{ symbol }}</span>
      <span v-if="marker.gameCount > 1" class="map-canvas__count" aria-hidden="true">{{ marker.gameCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MapCanvasProps, MapMarker } from '@/services/map-provider';
import { type MapPoint, projectToPreview } from '@/utils/location-map';

/**
 * The built-in map: no tiles, no key, no network. Markers sit at their real bearing and
 * distance from the center (a flat projection, fine over the discovery radii).
 */
const props = defineProps<MapCanvasProps>();
const emit = defineEmits<{ select: [key: string] }>();

function toStyle(point: MapPoint): Record<string, string> {
  const { left, top } = projectToPreview(point, props.center, props.radiusKm);
  return { left: `${left}%`, top: `${top}%` };
}

const userPosition = computed(() => (props.userLocation ? toStyle(props.userLocation) : null));

function positionOf(marker: MapMarker): Record<string, string> {
  return toStyle(marker);
}

function markerLabel(marker: MapMarker): string {
  const games = marker.gameCount === 1 ? '1 game' : `${marker.gameCount} games`;
  return `${marker.label}: ${games}`;
}
</script>

<style scoped>
.map-canvas {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 32px 32px,
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 32px 32px,
    radial-gradient(circle at 50% 50%, #17324a 0%, #0b1824 75%);
}

.map-canvas__ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 84%;
  height: 84%;
  border: 1px dashed rgba(var(--ion-color-primary-rgb), 0.35);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.map-canvas__center,
.map-canvas__you,
.map-canvas__marker {
  position: absolute;
  transform: translate(-50%, -50%);
}

.map-canvas__center {
  color: rgba(245, 247, 242, 0.4);
  font-size: 1.2rem;
}

.map-canvas__you-dot {
  display: block;
  width: 14px;
  height: 14px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25);
}

.map-canvas__marker {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  background: rgba(8, 19, 31, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  color: inherit;
  cursor: pointer;
  font-size: 1.05rem;
  line-height: 1.2;
}

.map-canvas__marker--active {
  z-index: 1;
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
}

.map-canvas__count {
  margin-left: 2px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #08131f;
  font-size: 0.66rem;
  font-weight: 800;
}
</style>
