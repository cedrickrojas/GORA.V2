import { defineStore } from "pinia";
import { ref, watch } from "vue";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notification.service";
import type { AppNotification } from "@/types/notification";
import { describeApiError, isUnauthorized } from "@/utils/api-errors";
import { useAuthStore } from "./auth";

export const useNotificationsStore = defineStore("notifications", () => {
  const auth = useAuthStore();
  const items = ref<AppNotification[]>([]);
  const isLoaded = ref(false);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(false);
  const readingId = ref<string | null>(null);
  const isMarkingAll = ref(false);
  let nextOffset = 0,
    generation = 0,
    revision = 0;
  let pending: Promise<boolean> | null = null;

  // Cached Ionic pages and late responses must never expose another account's inbox.
  watch(
    () => [auth.sessionVersion, auth.currentUser?.id, auth.accessToken],
    reset,
    { flush: "sync" },
  );
  function reset(): void {
    generation++;
    revision++;
    items.value = [];
    unreadCount.value = 0;
    nextOffset = 0;
    isLoaded.value = false;
    isLoading.value = false;
    hasMore.value = false;
    readingId.value = null;
    isMarkingAll.value = false;
    error.value = null;
    pending = null;
  }
  function load(force = false): Promise<boolean> {
    if (pending) return pending;
    if (isLoaded.value && !force) return Promise.resolve(true);
    return fetchPage(false);
  }
  function loadMore(): Promise<boolean> {
    if (pending) return pending;
    if (!hasMore.value) return Promise.resolve(true);
    return fetchPage(true);
  }
  function fetchPage(append: boolean): Promise<boolean> {
    const token = auth.accessToken;
    if (!token) {
      reset();
      return Promise.resolve(false);
    }
    const account = generation,
      version = revision;
    isLoading.value = true;
    error.value = null;
    const work = (async () => {
      try {
        const page = await fetchNotifications(token, append ? nextOffset : 0);
        if (generation !== account || revision !== version) return false;
        const previous = append ? items.value : [];
        const ids = new Set(previous.map((item) => item.id));
        items.value = [
          ...previous,
          ...page.items.filter((item) => !ids.has(item.id)),
        ];
        unreadCount.value = page.unreadCount;
        hasMore.value = page.hasMore;
        nextOffset = page.nextOffset;
        isLoaded.value = true;
        return true;
      } catch (caught) {
        if (generation === account) {
          if (isUnauthorized(caught)) await auth.logout();
          else error.value = describeApiError(caught);
        }
        return false;
      } finally {
        if (generation === account) isLoading.value = false;
      }
    })().finally(() => {
      if (pending === work) pending = null;
      // An older poll must not restore unread state after a successful read.
      if (generation === account && revision !== version) void load(true);
    });
    pending = work;
    return work;
  }

  async function markRead(id: string): Promise<boolean> {
    const item = items.value.find((candidate) => candidate.id === id);
    if (!item) return false;
    if (item.read) return true;
    const token = auth.accessToken;
    if (!token || readingId.value || isMarkingAll.value) return false;
    const account = generation;
    readingId.value = id;
    error.value = null;
    try {
      const result = await markNotificationRead(token, id);
      if (generation !== account) return false;
      revision++;
      items.value = items.value.map((candidate) =>
        candidate.id === id ? { ...candidate, read: true } : candidate,
      );
      unreadCount.value = result.unreadCount;
      return true;
    } catch (caught) {
      if (generation === account) {
        if (isUnauthorized(caught)) await auth.logout();
        else error.value = describeApiError(caught);
      }
      return false;
    } finally {
      if (generation === account) readingId.value = null;
    }
  }
  async function markAllRead(): Promise<boolean> {
    const token = auth.accessToken;
    if (!token || readingId.value || isMarkingAll.value) return false;
    const account = generation;
    isMarkingAll.value = true;
    error.value = null;
    try {
      const result = await markAllNotificationsRead(token);
      if (generation !== account) return false;
      revision++;
      for (const item of items.value) item.read = true;
      unreadCount.value = result.unreadCount;
      return true;
    } catch (caught) {
      if (generation === account) {
        if (isUnauthorized(caught)) await auth.logout();
        else error.value = describeApiError(caught);
      }
      return false;
    } finally {
      if (generation === account) isMarkingAll.value = false;
    }
  }
  return {
    items,
    isLoaded,
    unreadCount,
    isLoading,
    error,
    hasMore,
    readingId,
    isMarkingAll,
    load,
    loadMore,
    markRead,
    markAllRead,
    reset,
  };
});
