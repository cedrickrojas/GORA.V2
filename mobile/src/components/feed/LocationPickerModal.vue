<template>
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    class="location-picker-modal"
    @will-dismiss="cancelLocating"
    @did-dismiss="emit('close')"
  >
    <ion-content class="location-picker-content">
      <form class="location-picker" @submit.prevent="confirm">
        <div class="location-picker__heading">
          <h2 class="location-picker__title"><ion-icon :icon="locationOutline" aria-hidden="true" /> Add location</h2>
          <button type="button" class="location-picker__cancel" @click="close">Cancel</button>
        </div>
        <input
          v-model="query"
          type="search"
          class="location-picker__search"
          placeholder="Search GORA places"
          aria-label="Search location"
          @input="showMap = false"
        />
        <div class="location-picker__actions">
          <button type="button" :disabled="isLocating" @click="useCurrentLocation">
            <ion-icon :icon="navigateOutline" aria-hidden="true" />
            {{ isLocating ? 'Finding location...' : 'Use current location' }}
          </button>
          <button type="button" :aria-pressed="showMap" @click="selectOnMap">
            <ion-icon :icon="mapOutline" aria-hidden="true" /> Select on map
          </button>
        </div>
        <p v-if="error" class="location-picker__error" role="alert">{{ error }}</p>
        <p v-if="isLocating" class="location-picker__status" role="status">
          Allow location access if your browser asks.
        </p>
        <LocationMapPicker v-if="showMap && isOpen" :center="mapCenter" :point="selected" @select="choosePoint" />
        <ul v-else class="location-picker__list" role="radiogroup" aria-label="Locations">
          <li v-for="place in results" :key="place.id">
            <button
              type="button"
              role="radio"
              class="location-picker__place"
              :class="{ 'location-picker__place--active': isSelected(place) }"
              :aria-checked="isSelected(place)"
              @click="chooseVenue(place)"
            >
              <ion-icon :icon="locationOutline" aria-hidden="true" />
              <span class="location-picker__name"
                ><strong>{{ place.name }}</strong
                ><small>{{ place.city }}</small></span
              >
            </button>
          </li>
          <li v-if="results.length === 0" class="location-picker__empty">
            No places match that search. You can select a location on the map.
          </li>
        </ul>
        <div v-if="selected" class="location-picker__selected">
          <label for="post-location-name">Location name</label>
          <input
            id="post-location-name"
            v-model="selected.name"
            class="location-picker__search"
            :maxlength="LOCATION_NAME_MAX_LENGTH"
            placeholder="Name this place"
          />
          <small>{{ selected.latitude.toFixed(6) }}, {{ selected.longitude.toFixed(6) }}</small>
        </div>
        <p class="location-picker__status">This location will be attached to your post when you confirm.</p>
        <button type="submit" class="location-picker__confirm" :disabled="!canConfirm || isLocating">
          Confirm location
        </button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonContent, IonIcon, IonModal } from '@ionic/vue';
import { locationOutline, mapOutline, navigateOutline } from 'ionicons/icons';
import LocationMapPicker from '@/components/map/LocationMapPicker.vue';
import { getCurrentLocation } from '@/services/location.service';
import { useCatalogStore } from '@/stores/catalog';
import { useAuthStore } from '@/stores/auth';
import type { PostLocation } from '@/types/post';
import { isValidPoint, type MapPoint } from '@/utils/location-map';
import { LOCATION_PICKER_CENTER, describeLocationPickerFailure } from '@/utils/location-picker';
import { LOCATION_NAME_MAX_LENGTH, validatePostLocation } from '@/utils/post-details';

const props = defineProps<{ isOpen: boolean; current: PostLocation | null }>();
const emit = defineEmits<{ close: []; confirm: [location: PostLocation] }>();
const catalog = useCatalogStore();
const auth = useAuthStore();
const query = ref('');
const selected = ref<PostLocation | null>(null);
const mapCenter = ref<MapPoint>({ ...LOCATION_PICKER_CENTER });
const showMap = ref(false);
const isLocating = ref(false);
const error = ref<string | null>(null);
let requestVersion = 0;
let automaticName = '';

const results = computed(() => {
  const term = query.value.trim().toLowerCase();
  return catalog.locations.filter(
    (place) =>
      isValidPoint(place) &&
      (!term || place.name.toLowerCase().includes(term) || place.city.toLowerCase().includes(term)),
  );
});
const canConfirm = computed(() => selected.value !== null && validatePostLocation(selected.value) === null);
function isSelected(place: PostLocation): boolean {
  return (
    selected.value?.name === place.name &&
    selected.value.latitude === place.latitude &&
    selected.value.longitude === place.longitude
  );
}
function cancelLocating(): void {
  requestVersion++;
  isLocating.value = false;
}
function close(): void {
  cancelLocating();
  emit('close');
}
function reset(): void {
  cancelLocating();
  query.value = '';
  error.value = null;
  showMap.value = false;
  selected.value = props.current && validatePostLocation(props.current) === null ? { ...props.current } : null;
  automaticName = selected.value?.name ?? '';
  mapCenter.value = selected.value ?? catalog.locations.find(isValidPoint) ?? { ...LOCATION_PICKER_CENTER };
}
watch(
  () => props.isOpen,
  (open) => {
    if (open) reset();
    else {
      cancelLocating();
      showMap.value = false;
    }
  },
  { immediate: true },
);
watch(
  [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
  () => {
    cancelLocating();
    selected.value = null;
    showMap.value = false;
    error.value = null;
    if (props.isOpen) emit('close');
  },
  { flush: 'sync' },
);
onBeforeUnmount(cancelLocating);

function chooseVenue(place: PostLocation): void {
  cancelLocating();
  error.value = null;
  selected.value = { name: place.name, latitude: place.latitude, longitude: place.longitude };
  automaticName = place.name;
  mapCenter.value = { latitude: place.latitude, longitude: place.longitude };
}
function selectOnMap(): void {
  cancelLocating();
  error.value = null;
  mapCenter.value = selected.value ?? catalog.locations.find(isValidPoint) ?? { ...LOCATION_PICKER_CENTER };
  showMap.value = true;
}
function choosePoint(point: MapPoint): void {
  if (!isValidPoint(point)) return;
  cancelLocating();
  error.value = null;
  const name = !selected.value || selected.value.name === automaticName ? 'Selected location' : selected.value.name;
  automaticName = 'Selected location';
  selected.value = { name, ...point };
}
async function useCurrentLocation(): Promise<void> {
  if (isLocating.value) return;
  const version = ++requestVersion;
  isLocating.value = true;
  error.value = null;
  try {
    const result = await getCurrentLocation(undefined, { precise: true });
    if (version !== requestVersion || !props.isOpen) return;
    if (!result.ok) {
      error.value = describeLocationPickerFailure(result.reason);
      return;
    }
    selected.value = { name: 'Current location', ...result.point };
    automaticName = 'Current location';
    mapCenter.value = result.point;
    showMap.value = true;
  } catch {
    if (version === requestVersion && props.isOpen) error.value = describeLocationPickerFailure('UNAVAILABLE');
  } finally {
    if (version === requestVersion) isLocating.value = false;
  }
}
function confirm(): void {
  if (!canConfirm.value || !selected.value || isLocating.value) return;
  cancelLocating();
  emit('confirm', {
    name: selected.value.name.trim(),
    latitude: selected.value.latitude,
    longitude: selected.value.longitude,
  });
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

.location-picker__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.location-picker__title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.location-picker__title ion-icon {
  color: var(--ion-color-primary);
}
.location-picker__cancel {
  border: 0;
  background: transparent;
  color: var(--gora-muted);
  font: inherit;
  cursor: pointer;
}
.location-picker__selected {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.location-picker__selected label {
  font-size: 0.8rem;
  font-weight: 700;
}
.location-picker__selected small,
.location-picker__status {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.75rem;
}
.location-picker__error {
  margin: 0;
  color: #ff7a7a;
  font-size: 0.8rem;
}
.location-picker__actions button[aria-pressed='true'] {
  border-style: solid;
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}
.location-picker__actions button:disabled {
  opacity: 0.6;
  cursor: wait;
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

.location-picker__actions {
  display: flex;
  gap: 8px;
}

.location-picker__actions button {
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
