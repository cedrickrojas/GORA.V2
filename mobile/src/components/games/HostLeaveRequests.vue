<template>
  <section class="leave-requests" aria-label="Leave requests">
    <SectionHeader title="Leave Requests" />
    <p class="leave-requests__note">Approving a request removes the player and deducts 1 GORA point from their balance.</p>
    <p v-if="loading && !requests.length" class="leave-requests__state">Loading requests…</p>
    <p v-else-if="error" class="leave-requests__state" role="alert">{{ error }} <button type="button" @click="reload">Retry</button></p>
    <p v-else-if="pending.length === 0" class="leave-requests__state">No pending leave requests.</p>
    <ul v-else class="leave-requests__list">
      <li v-for="request in pending" :key="request.id" class="leave-requests__item">
        <router-link v-if="request.user" :to="`/profile/${request.user.username}`" class="leave-requests__who">
          <UserAvatar :user="{ id: request.user.id, username: request.user.username, displayName: request.user.displayName, avatarUrl: request.user.profileImageUrl }" :size="40" />
          <span><strong>{{ request.user.displayName }}</strong><small>@{{ request.user.username }} · requested {{ formatTimeAgo(Date.parse(request.createdAt), now) }}</small></span>
        </router-link>
        <div class="leave-requests__actions">
          <button type="button" class="leave-requests__reject" :disabled="busy" @click="respond(request.userId, 'reject')">Decline</button>
          <button type="button" class="leave-requests__approve" :disabled="busy" @click="respond(request.userId, 'approve')">{{ busyUser === request.userId ? 'Approving…' : 'Approve Leave' }}</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import SectionHeader from '@/components/common/SectionHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useGamePlayersStore } from '@/stores/game-players';
import type { ApiGame } from '@/types/game';
import { formatTimeAgo } from '@/utils/time';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ game: ApiGame }>();
const gamePlayers = useGamePlayersStore();
const now = Date.now();
const busyUser = ref<string | null>(null);
const requests = computed(() => gamePlayers.hostLeaveRequestsByGame[props.game.id] ?? []);
const pending = computed(() => requests.value.filter((request) => request.status === 'PENDING'));
const loading = computed(() => !(props.game.id in gamePlayers.hostLeaveRequestsByGame));
const error = ref('');
const busy = computed(() => busyUser.value !== null);

async function reload(): Promise<void> {
  const result = await gamePlayers.fetchHostLeaveRequests(props.game.id);
  error.value = result.ok ? '' : result.message;
}

async function respond(userId: string, action: 'approve' | 'reject'): Promise<void> {
  if (busy.value) return;
  busyUser.value = userId;
  const result = await gamePlayers.respondToLeaveRequest(props.game.id, userId, action);
  busyUser.value = null;
  void showNotice(result.ok ? action === 'approve' ? 'Player removed. 1 GORA point deducted.' : 'Leave request declined.' : result.message);
}

onMounted(() => { void reload(); });
</script>

<style scoped>
.leave-requests { padding: 8px 16px 0; }
.leave-requests__note,.leave-requests__state { margin: 2px 0 10px; color: var(--gora-muted); font-size: .78rem; }
.leave-requests__state button { border: 0; background: transparent; color: var(--ion-color-primary); font: inherit; font-weight: 700; }
.leave-requests__list { margin: 0; padding: 0; list-style: none; }
.leave-requests__item { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; padding: 12px; border: 1px solid var(--gora-line); border-radius: 16px; background: var(--gora-surface); }
.leave-requests__who { display: flex; align-items: center; gap: 10px; color: var(--ion-text-color); text-decoration: none; }
.leave-requests__who > span { display: flex; min-width: 0; flex-direction: column; font-size: .9rem; }
.leave-requests__who small { color: var(--gora-muted); font-size: .76rem; }
.leave-requests__actions { display: flex; gap: 8px; }
.leave-requests__actions button { flex: 1; min-height: 40px; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 800; }
.leave-requests__approve { border: 0; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
.leave-requests__reject { border: 1px solid var(--gora-line-strong); background: transparent; color: var(--ion-text-color); }
.leave-requests__actions button:disabled { opacity: .6; }
</style>
