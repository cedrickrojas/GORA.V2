<template>
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    class="location-picker-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="location-picker-content">
      <form class="location-picker" @submit.prevent="confirm">
        <h2 class="location-picker__title">📍 Add location</h2>
        <input
          v-model="query"
          type="search"
          class="location-picker__search"
          placeholder="Search location"
          aria-label="Search location"
        />
        <div class="location-picker__later">
          <button type="button" @click="showLaterPhaseNotice('Use current location')">
            <ion-icon :icon="navigateOutline" aria-hidden="true" />
            Use current location
          </button>
          <button type="button" @click="showLaterPhaseNotice('Select on map')">
            <ion-icon :icon="mapOutline" aria-hidden="true" />
            Select on map
          </button>
        </div>

        <ul class="location-picker__list" role="radiogroup" aria-label="Locations">
          <li v-for="place in results" :key="place.id">
            <button
              type="button"
              role="radio"
              class="location-picker__place"
              :class="{ 'location-picker__place--active': place.id === selectedId }"
              :aria-checked="place.id === selectedId"
              @click="selectedId = place.id"
            >
              <span aria-hidden="true">📍</span>
              <span class="location-picker__name">
                <strong>{{ place.name }}</strong>
                <small>{{ place.city }}</small>
              </span>
            </button>
          </li>
          <li v-if="results.length === 0" class="location-picker__empty">No places match that search.</li>
        </ul>

        <button type="submit" class="location-picker__confirm" :disabled="!selected">Confirm location</button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonContent, IonIcon, IonModal } from '@ionic/vue';
import { mapOutline, navigateOutline } from 'ionicons/icons';
import { useCatalogStore } from '@/stores/catalog';
import type { PostLocation } from '@/types/post';
import { showLaterPhaseNotice } from '@/utils/notice';

/**
 * Picks from the places GORA knows about. Search by a map provider, picking a point on
 * the map, and the device's current location arrive with the map implementation.
 */
const props = defineProps<{ isOpen: boolean; current: PostLocation | null }>();
const emit = defineEmits<{ close: []; confirm: [location: PostLocation] }>();

const catalog = useCatalogStore();
const query = ref('');
const selectedId = ref<string | null>(null);

const results = computed(() => {
  const term = query.value.trim().toLowerCase();

  return term
    ? catalog.locations.filter(
        (place) => place.name.toLowerCase().includes(term) || place.city.toLowerCase().includes(term),
      )
    : catalog.locations;
});
const selected = computed(() => catalog.locations.find((place) => place.id === selectedId.value) ?? null);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      query.value = '';
      selectedId.value =
        catalog.locations.find(
          (place) =>
            place.name === props.current?.name &&
            place.latitude === props.current.latitude &&
            place.longitude === props.current.longitude,
        )?.id ?? null;
    }
  },
);

function confirm(): void {
  if (!selected.value) {
    return;
  }

  const { name, latitude, longitude } = selected.value;
  emit('confirm', { name, latitude, longitude });
  emit('close');
}

onMounted(() => {
  void catalog.load();
});
</script>

<style scoped>
.location-picker-modal {
  --background: var(--gora-surface);
  --border-radius: 24px;
}

.location-picker-content {
  --background: var(--gora-surface);
}

.location-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom));
}

.location-picker__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.location-picker__search {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.88rem;
}

.location-picker__later {
  display: flex;
  gap: 8px;
}

.location-picker__later button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px dashed var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
}

.location-picker__list {
  display: flex;
  max-height: 280px;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.location-picker__place {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.location-picker__place--active {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.location-picker__name {
  display: flex;
  flex-direction: column;
  font-size: 0.88rem;
}

.location-picker__name small {
  color: var(--gora-muted);
  font-size: 0.74rem;
}

.location-picker__empty {
  padding: 8px 4px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.location-picker__confirm {
  padding: 13px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.location-picker__confirm:disabled {
  background: #1b2a37;
  color: #7d8a93;
  cursor: default;
}
</style>
