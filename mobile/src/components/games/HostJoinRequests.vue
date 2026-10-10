<template>
  <section class="host-requests" aria-label="Join requests">
    <SectionHeader title="Join Requests" />
    <p class="host-requests__count">
      Pending Requests: <strong>{{ pendingCount }}</strong>
    </p>
    <p v-if="game.status === 'FULL'" class="host-requests__note">
      This game is already full. Pending requests can be accepted when a slot opens.
    </p>
    <p v-else class="host-requests__note">Accepting a request adds the player to the roster.</p>

    <p v-if="status === 'error'" class="host-requests__state" role="alert">
      {{ error }}
      <button type="button" class="host-requests__retry" @click="reload">Try again</button>
    </p>
    <p v-else-if="status === 'loading' && requests.length === 0" class="host-requests__state">Loading requests…</p>
    <p v-else-if="sections.pending.length === 0" class="host-requests__state">No pending requests.</p>

    <ul v-if="sections.pending.length > 0" class="host-requests__list">
      <li v-for="request in sections.pending" :key="request.id" class="host-requests__item">
        <router-link :to="`/profile/${request.user.username}`" class="host-requests__who">
          <UserAvatar :user="requesterSummary(request)" :size="40" />
          <span>
            <strong>{{ request.user.displayName }}</strong>
            <span>@{{ request.user.username }} · {{ formatTimeAgo(Date.parse(request.createdAt), now) }}</span>
          </span>
        </router-link>
        <p v-if="request.message" class="host-requests__message">“{{ request.message }}”</p>
        <div class="host-requests__buttons">
          <button
            type="button"
            class="host-requests__reject"
            :disabled="joinRequests.actingRequestId !== null"
            :aria-label="`Reject ${request.user.displayName}`"
            @click="respond(request, 'reject')"
          >
            {{ joinRequests.actingRequestId === request.id && acting === 'reject' ? 'Rejecting…' : 'Reject' }}
          </button>
          <button
            type="button"
            class="host-requests__accept"
            :disabled="joinRequests.actingRequestId !== null"
            :aria-label="`Accept ${request.user.displayName}`"
            @click="respond(request, 'accept')"
          >
            {{ joinRequests.actingRequestId === request.id && acting === 'accept' ? 'Accepting…' : 'Accept' }}
          </button>
        </div>
      </li>
    </ul>

    <template v-if="sections.history.length > 0">
      <h3 class="host-requests__history-title">Answered</h3>
      <ul class="host-requests__history">
        <li v-for="request in sections.history" :key="request.id">
          <router-link :to="`/profile/${request.user.username}`">{{ request.user.displayName }}</router-link>
          <span :class="`host-requests__status host-requests__status--${request.status.toLowerCase()}`">
            {{ JOIN_REQUEST_STATUS_LABELS[request.status] }}
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import SectionHeader from '@/components/common/SectionHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useJoinRequestsStore } from '@/stores/join-requests';
import type { ApiGame } from '@/types/game';
import type { HostJoinRequest } from '@/types/join-request';
import { showNotice } from '@/utils/notice';
import { JOIN_REQUEST_STATUS_LABELS, requesterSummary, splitHostJoinRequests } from '@/utils/join-requests';
import { formatTimeAgo } from '@/utils/time';

const props = defineProps<{ game: ApiGame }>();

const joinRequests = useJoinRequestsStore();
const acting = ref<'accept' | 'reject' | null>(null);
const now = Date.now();

const requests = computed(() => joinRequests.gameJoinRequests(props.game.id));
const sections = computed(() => splitHostJoinRequests(requests.value));
const status = computed(() => joinRequests.hostStatus[props.game.id] ?? 'idle');
const error = computed(() => joinRequests.hostError[props.game.id] ?? 'Could not load join requests.');
// The count on the game comes from the server; the list is a fallback while it refreshes.
const pendingCount = computed(() => props.game.pendingRequestCount ?? sections.value.pending.length);

function reload(): void {
  void joinRequests.fetchGameJoinRequests(props.game.id);
}

async function respond(request: HostJoinRequest, action: 'accept' | 'reject'): Promise<void> {
  if (joinRequests.actingRequestId !== null) {
    return;
  }

  acting.value = action;
  const result =
    action === 'accept'
      ? await joinRequests.acceptJoinRequest(props.game.id, request.id)
      : await joinRequests.rejectJoinRequest(props.game.id, request.id);
  acting.value = null;

  void showNotice(
    result.ok
      ? `${request.user.displayName}'s request was ${action === 'accept' ? 'accepted' : 'declined'}.`
      : result.message,
  );
}
</script>

<style scoped>
.host-requests {
  padding: 8px 16px 0;
}

.host-requests__count {
  margin: 0;
  font-size: 0.92rem;
}

.host-requests__note {
  margin: 2px 0 10px;
  color: var(--gora-muted);
  font-size: 0.76rem;
}

.host-requests__state {
  margin: 8px 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.host-requests__retry {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.host-requests__list,
.host-requests__history {
  margin: 0;
  padding: 0;
  list-style: none;
}

.host-requests__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
}

.host-requests__who {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ion-text-color);
  text-decoration: none;
}

.host-requests__who > span {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.host-requests__who > span span {
  color: var(--gora-muted);
  font-size: 0.76rem;
}

.host-requests__message {
  margin: 0;
  font-size: 0.86rem;
  white-space: pre-line;
}

.host-requests__buttons {
  display: flex;
  gap: 8px;
}

.host-requests__accept,
.host-requests__reject {
  flex: 1;
  padding: 10px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.host-requests__accept {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.host-requests__reject {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
}

.host-requests__accept:disabled,
.host-requests__reject:disabled {
  opacity: 0.6;
  cursor: default;
}

.host-requests__history-title {
  margin: 14px 0 6px;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.host-requests__history li {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--gora-line);
  font-size: 0.88rem;
}

.host-requests__history a {
  color: var(--ion-text-color);
  text-decoration: none;
}

.host-requests__status {
  color: var(--gora-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.host-requests__status--accepted {
  color: var(--ion-color-primary);
}

.host-requests__status--rejected {
  color: #ef5b5b;
}
</style>
