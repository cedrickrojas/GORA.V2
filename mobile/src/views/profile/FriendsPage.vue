<template>
  <ion-page>
    <SubPageHeader title="Friends" />

    <ion-content :fullscreen="true">
      <div class="friends">
        <SegmentTabs v-model="section" :options="sectionOptions" />
        <p v-if="friendsStore.error" class="friends__empty" role="alert">
          {{ friendsStore.error }} <button type="button" @click="friendsStore.refresh">Try again</button>
        </p>
        <p v-if="friendsStore.loading" class="friends__empty" aria-live="polite">Loading friends…</p>

        <template v-if="section === 'FRIENDS'">
          <p class="friends__count">{{ friendsCount }} friends</p>
          <p v-if="!friendsStore.loading && friendsCount === 0" class="friends__empty">
            Find a player and send a friend request. Once accepted, you’ll see each other’s Friends posts.
          </p>
          <router-link v-if="friendsCount === 0" to="/search">Find friends</router-link>
          <ul class="friends__list">
            <PlayerRow v-for="friend in friendsStore.friends" :key="friend.id" :player="friend" />
          </ul>
        </template>

        <template v-else>
          <h2 class="friends__heading">Received</h2>
          <p v-if="received.length === 0" class="friends__empty">No friend requests right now.</p>
          <ul v-else class="friends__list">
            <li v-for="request in received" :key="request.id" class="request">
              <UserAvatar :user="request.player" :size="48" />
              <span class="request__text">
                <router-link :to="`/profile/${request.player.username}`" class="request__name">
                  {{ request.player.displayName }}
                </router-link>
                <span>{{ request.player.primarySport }} · {{ mutualLabel(request.mutualFriends) }}</span>
                <time :datetime="request.createdAt">{{ formatTimeAgo(Date.parse(request.createdAt), now) }}</time>
              </span>
              <span class="request__actions">
                <button
                  type="button"
                  class="request__btn request__btn--primary"
                  :disabled="!!friendsStore.busyId"
                  @click="accept(request)"
                >
                  Accept
                </button>
                <button type="button" class="request__btn" :disabled="!!friendsStore.busyId" @click="decline(request)">
                  Decline
                </button>
              </span>
            </li>
          </ul>

          <h2 class="friends__heading">Sent</h2>
          <p v-if="sent.length === 0" class="friends__empty">You have no pending requests.</p>
          <ul v-else class="friends__list">
            <li v-for="request in sent" :key="request.id" class="request">
              <UserAvatar :user="request.player" :size="48" />
              <span class="request__text">
                <router-link :to="`/profile/${request.player.username}`" class="request__name">
                  {{ request.player.displayName }}
                </router-link>
                <span>Pending · sent {{ formatTimeAgo(Date.parse(request.createdAt), now) }}</span>
              </span>
              <span class="request__actions">
                <button type="button" class="request__btn" :disabled="!!friendsStore.busyId" @click="cancel(request)">
                  Cancel
                </button>
              </span>
            </li>
          </ul>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PlayerRow from '@/components/discover/PlayerRow.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useNow } from '@/composables/useNow';
import { useFriendsStore } from '@/stores/friends';
import type { FriendRequest } from '@/types/friend';
import { showNotice } from '@/utils/notice';
import { formatTimeAgo } from '@/utils/time';

type FriendsSection = 'FRIENDS' | 'REQUESTS';

const route = useRoute();
const friendsStore = useFriendsStore();
const { received, sent } = storeToRefs(friendsStore);
const now = useNow();

const section = ref<FriendsSection>(route.query.tab === 'requests' ? 'REQUESTS' : 'FRIENDS');

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'requests') {
      section.value = 'REQUESTS';
    }
  },
);

const sectionOptions = computed(() => [
  { id: 'FRIENDS' as const, label: 'Friends' },
  { id: 'REQUESTS' as const, label: 'Requests', count: received.value.length },
]);

const friendsCount = computed(() => friendsStore.friends.length);

function mutualLabel(count: number): string {
  return count === 1 ? '1 mutual friend' : `${count} mutual friends`;
}

async function accept(request: FriendRequest): Promise<void> {
  if (await friendsStore.accept(request.id)) void showNotice(`You and ${request.player.displayName} are now friends.`);
}

async function decline(request: FriendRequest): Promise<void> {
  if (await friendsStore.dismiss(request.id)) void showNotice(`Declined ${request.player.displayName}'s request.`);
}

async function cancel(request: FriendRequest): Promise<void> {
  if (await friendsStore.dismiss(request.id))
    void showNotice(`Cancelled your request to ${request.player.displayName}.`);
}

onMounted(() => {
  void friendsStore.load();
});
onIonViewWillEnter(() => {
  void friendsStore.refresh();
});
</script>

<style scoped>
.friends {
  padding: 12px 16px 32px;
}

.friends__count {
  margin: 16px 0 4px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.friends__heading {
  margin: 20px 0 4px;
  color: var(--gora-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.friends__empty {
  margin: 8px 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.friends__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.request {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.request__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.request__name {
  color: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
}

.request__text span,
.request__text time {
  overflow: hidden;
  color: var(--gora-muted);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request__actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.request__btn {
  padding: 7px 12px;
  border: 1px solid var(--gora-line);
  border-radius: 10px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
}

.request__btn--primary {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
</style>
