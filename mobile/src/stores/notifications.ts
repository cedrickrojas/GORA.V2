import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fetchNotifications } from '@/services/notification.service';
import type { AppNotification } from '@/types/notification';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([]);
  const isLoaded = ref(false);

  const unreadCount = computed(() => items.value.filter((item) => !item.read).length);

  async function load(): Promise<void> {
    if (isLoaded.value) {
      return;
    }

    items.value = await fetchNotifications();
    isLoaded.value = true;
  }

  function markRead(id: string): void {
    const item = items.value.find((candidate) => candidate.id === id);

    if (item) {
      item.read = true;
    }
  }

  function markAllRead(): void {
    for (const item of items.value) {
      item.read = true;
    }
  }

  return { items, isLoaded, unreadCount, load, markRead, markAllRead };
});
