import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fetchFollowSummary, setFollowing } from '@/services/profile.service';
import type { FollowSummary } from '@/types/profile';
import { applyFollowChange, canFollow } from '@/utils/follows';
import { useSessionStore } from './session';

const EMPTY_SUMMARY: FollowSummary = { followersCount: 0, followingCount: 0, followingIds: [] };

export const useFollowsStore = defineStore('follows', () => {
  const session = useSessionStore();
  const summary = ref<FollowSummary>(EMPTY_SUMMARY);
  const isLoaded = ref(false);

  const followersCount = computed(() => summary.value.followersCount);
  const followingCount = computed(() => summary.value.followingCount);
  const followingIds = computed(() => summary.value.followingIds);

  async function load(): Promise<void> {
    if (isLoaded.value) {
      return;
    }

    await session.load();
    summary.value = await fetchFollowSummary();
    isLoaded.value = true;
  }

  function isFollowing(userId: string): boolean {
    return summary.value.followingIds.includes(userId);
  }

  async function toggleFollow(userId: string): Promise<void> {
    if (!canFollow(session.me?.id ?? null, userId)) {
      return;
    }

    const next = !isFollowing(userId);
    const previous = summary.value;

    summary.value = applyFollowChange(previous, userId, next);

    try {
      await setFollowing(userId, next);
    } catch {
      summary.value = previous;
    }
  }

  return { followersCount, followingCount, followingIds, isLoaded, load, isFollowing, toggleFollow };
});
