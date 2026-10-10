<template>
  <div class="people-picker">
    <div class="people-picker__head">
      <span>{{ title }}</span>
      <span class="people-picker__count">{{ selectedIds.length }} selected</span>
    </div>
    <input
      v-model="query"
      type="search"
      class="people-picker__search"
      placeholder="Search friends and players"
      aria-label="Search people"
    />
    <ul class="people-picker__people">
      <li v-for="person in filteredCandidates" :key="person.id">
        <label class="people-picker__person">
          <input
            type="checkbox"
            :checked="selected.has(person.id)"
            :disabled="!selected.has(person.id) && selectedIds.length >= max"
            @change="toggle(person.id)"
          />
          <UserAvatar :user="person" :size="30" />
          <span class="people-picker__name">
            <strong>{{ person.displayName }}</strong>
            <small>@{{ person.username }}{{ friendsStore.friendIds.has(person.id) ? ' · Friend' : '' }}</small>
          </span>
        </label>
      </li>
      <li v-if="candidates.length === 0 && postsStore.savesToServer" class="people-picker__empty">
        Your GORA friends will appear here once the Friends system is connected.
      </li>
      <li v-else-if="filteredCandidates.length === 0" class="people-picker__empty">No one matches that search.</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useFriendsStore } from '@/stores/friends';
import { usePostsStore } from '@/stores/posts';
import { useSessionStore } from '@/stores/session';
import type { UserSummary } from '@/types/user';
import { isServerId } from '@/utils/post-api';

defineProps<{ title: string; max: number }>();
const selectedIds = defineModel<string[]>({ required: true });

const session = useSessionStore();
const catalog = useCatalogStore();
const friendsStore = useFriendsStore();
const postsStore = usePostsStore();
const query = ref('');

const selected = computed(() => new Set(selectedIds.value));

/**
 * Friends first, then other players; never the author or anyone blocked. Nobody is preselected.
 * Posts saved to the database can only include real accounts, so demo people are left out then.
 */
const candidates = computed<UserSummary[]>(() => {
  const selfId = postsStore.me?.id;
  const seen = new Set<string>();

  return [...friendsStore.friends, ...catalog.players].filter((person) => {
    if (postsStore.savesToServer && !isServerId(person.id)) {
      return false;
    }

    if (person.id === selfId || friendsStore.blockedIdSet.has(person.id) || seen.has(person.id)) {
      return false;
    }

    seen.add(person.id);
    return true;
  });
});

const filteredCandidates = computed(() => {
  const term = query.value.trim().toLowerCase();

  return term
    ? candidates.value.filter(
        (person) => person.displayName.toLowerCase().includes(term) || person.username.toLowerCase().includes(term),
      )
    : candidates.value;
});

function toggle(userId: string): void {
  selectedIds.value = selected.value.has(userId)
    ? selectedIds.value.filter((id) => id !== userId)
    : [...selectedIds.value, userId];
}

onMounted(() => {
  void session.load();
  void catalog.load();
  void friendsStore.load();
});
</script>

<style scoped>
.people-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--gora-line);
  border-radius: 14px;
}

.people-picker__head {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
}

.people-picker__count {
  color: var(--ion-color-primary);
}

.people-picker__search {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.85rem;
}

.people-picker__people {
  display: flex;
  max-height: 240px;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.people-picker__person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 10px;
  cursor: pointer;
}

.people-picker__person input {
  width: 18px;
  height: 18px;
  accent-color: var(--ion-color-primary);
}

.people-picker__name {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.people-picker__name small {
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.people-picker__empty {
  padding: 8px 4px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}
</style>
