import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DistanceFilter } from '@/utils/search';

/** The header filter. Home, Search, and Discover all read from it. */
export const useFiltersStore = defineStore('filters', () => {
  const maxDistanceKm = ref<DistanceFilter>(null);
  const sport = ref<string | null>(null);

  const isActive = computed(() => maxDistanceKm.value !== null || sport.value !== null);

  function reset(): void {
    maxDistanceKm.value = null;
    sport.value = null;
  }

  return { maxDistanceKm, sport, isActive, reset };
});
