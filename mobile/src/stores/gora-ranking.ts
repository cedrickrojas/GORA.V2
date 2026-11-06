import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { fetchGoraRanking } from "@/services/gora-ranking.service";
import type { RankedPlayer } from "@/types/gora-ranking";
import { describeApiError, isUnauthorized } from "@/utils/api-errors";
import { useAuthStore } from "./auth";

export const useGoraRankingStore = defineStore("gora-ranking", () => {
  const auth = useAuthStore();
  const players = ref<RankedPlayer[]>([]);
  const currentPlayer = ref<RankedPlayer | null>(null);
  const total = ref(0);
  const hasMore = ref(false);
  const isLoading = ref(false);
  const isLoaded = ref(false);
  const error = ref<string | null>(null);
  let offset = 0;
  let generation = 0;
  let pending: Promise<void> | null = null;

  watch(
    () => [auth.sessionVersion, auth.currentUser?.id, auth.accessToken],
    reset,
    { flush: "sync" },
  );

  function reset(): void {
    generation++;
    players.value = [];
    currentPlayer.value = null;
    total.value = 0;
    hasMore.value = false;
    isLoading.value = false;
    isLoaded.value = false;
    error.value = null;
    offset = 0;
    pending = null;
  }

  function load(force = false): Promise<void> {
    if (pending) return pending;
    if (isLoaded.value && !force) return Promise.resolve();
    return fetchPage(false);
  }

  function loadMore(): Promise<void> {
    if (pending) return pending;
    return hasMore.value ? fetchPage(true) : Promise.resolve();
  }

  function fetchPage(append: boolean): Promise<void> {
    const token = auth.accessToken;
    if (!token) {
      reset();
      return Promise.resolve();
    }
    const version = generation;
    isLoading.value = true;
    error.value = null;
    const work = (async () => {
      try {
        const page = await fetchGoraRanking(token, append ? offset : 0);
        if (version !== generation) return;
        const previous = append ? players.value : [];
        const ids = new Set(previous.map((player) => player.id));
        players.value = [
          ...previous,
          ...page.players.filter((player) => !ids.has(player.id)),
        ];
        currentPlayer.value = page.currentPlayer;
        total.value = page.total;
        hasMore.value = page.hasMore;
        offset = page.nextOffset;
        isLoaded.value = true;
      } catch (caught) {
        if (version !== generation) return;
        if (isUnauthorized(caught)) await auth.logout();
        else error.value = describeApiError(caught);
      } finally {
        if (version === generation) isLoading.value = false;
      }
    })().finally(() => {
      if (pending === work) pending = null;
    });
    pending = work;
    return work;
  }

  return {
    players,
    currentPlayer,
    total,
    hasMore,
    isLoading,
    isLoaded,
    error,
    load,
    loadMore,
  };
});
