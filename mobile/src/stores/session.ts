import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fetchCurrentUser } from '@/services/user.service';
import type { UserSummary } from '@/types/user';
import { toUserSummary } from '@/utils/display-name';
import { useAuthStore } from './auth';

export const useSessionStore = defineStore('session', () => {
  const auth = useAuthStore();
  /** The demo user (Louis) behind the mock feeds, friends, and chats. */
  const currentUser = ref<UserSummary | null>(null);
  /** Who acts in the app: the signed-in account, or the demo user when nobody is signed in. */
  const me = computed<UserSummary | null>(() =>
    auth.currentUser ? toUserSummary(auth.currentUser) : currentUser.value,
  );

  async function load(): Promise<void> {
    if (currentUser.value) {
      return;
    }

    currentUser.value = await fetchCurrentUser();
  }

  return { currentUser, me, load };
});
