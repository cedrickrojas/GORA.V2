<template>
  <div class="filter-panel">
    <div class="filter-panel__row">
      <span class="filter-panel__label">Maximum distance</span>
      <strong class="filter-panel__value">{{ formatDistanceFilter(filters.maxDistanceKm) }}</strong>
    </div>
    <ion-range
      class="filter-panel__range"
      aria-label="Maximum distance"
      :min="0"
      :max="DISTANCE_FILTERS.length - 1"
      :step="1"
      :snaps="true"
      :ticks="true"
      :value="distanceIndex"
      @ion-input="onDistanceInput"
    />
    <div class="filter-panel__scale" aria-hidden="true">
      <span>1 km</span>
      <span>Any</span>
    </div>

    <div class="filter-panel__row filter-panel__row--spaced">
      <span class="filter-panel__label">Sport</span>
    </div>
    <ion-select
      class="filter-panel__select"
      aria-label="Sport"
      interface="action-sheet"
      :interface-options="{ header: 'Sport', cssClass: 'gora-sheet' }"
      :value="filters.sport ?? ALL_SPORTS"
      @ion-change="onSportChange"
    >
      <ion-select-option :value="ALL_SPORTS">All sports</ion-select-option>
      <ion-select-option v-for="sport in sportChoices" :key="sport" :value="sport">
        {{ sport }}
      </ion-select-option>
    </ion-select>

    <div class="filter-panel__actions">
      <button type="button" class="filter-panel__reset" :disabled="!filters.isActive" @click="filters.reset()">
        Reset
      </button>
      <button type="button" class="filter-panel__done" @click="emit('done')">Done</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { IonRange, IonSelect, IonSelectOption } from '@ionic/vue';
import type { RangeCustomEvent, SelectCustomEvent } from '@ionic/vue';
import { useCatalogStore } from '@/stores/catalog';
import { useFiltersStore } from '@/stores/filters';
import { useSportsStore } from '@/stores/sports';
import { DISTANCE_FILTERS, formatDistanceFilter } from '@/utils/search';

const ALL_SPORTS = '__all__';

const emit = defineEmits<{ done: [] }>();

const filters = useFiltersStore();
const catalog = useCatalogStore();
const sportsStore = useSportsStore();

/** Active sports from the API; the demo catalog only if that list could not load. */
const sportChoices = computed(() =>
  sportsStore.activeSports.length > 0
    ? sportsStore.activeSports.map((sport) => sport.name)
    : catalog.sports.map((sport) => sport.name),
);

const distanceIndex = computed(() => DISTANCE_FILTERS.indexOf(filters.maxDistanceKm));

function onDistanceInput(event: RangeCustomEvent): void {
  const index = typeof event.detail.value === 'number' ? event.detail.value : event.detail.value.upper;

  filters.maxDistanceKm = DISTANCE_FILTERS[index] ?? null;
}

function onSportChange(event: SelectCustomEvent<string>): void {
  filters.sport = event.detail.value === ALL_SPORTS ? null : event.detail.value;
}

onMounted(() => {
  void catalog.load();
  void sportsStore.fetchSports();
});
</script>

<style scoped>
.filter-panel {
  padding: 16px;
}

.filter-panel__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.filter-panel__row--spaced {
  margin-top: 18px;
}

.filter-panel__label {
  color: var(--gora-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.filter-panel__value {
  color: var(--ion-color-primary);
  font-size: 0.95rem;
}

.filter-panel__range {
  --bar-background: rgba(245, 247, 242, 0.18);
  --bar-background-active: var(--ion-color-primary);
  --knob-background: var(--ion-color-primary);
  --knob-size: 22px;
  padding: 0 4px;
}

.filter-panel__scale {
  display: flex;
  justify-content: space-between;
  margin-top: -6px;
  color: #7d8a93;
  font-size: 0.68rem;
}

.filter-panel__select {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  --placeholder-color: var(--gora-muted);
}

.filter-panel__actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.filter-panel__reset,
.filter-panel__done {
  flex: 1;
  padding: 10px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
}

.filter-panel__reset {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
}

.filter-panel__reset:disabled {
  opacity: 0.4;
  cursor: default;
}

.filter-panel__done {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
</style>
