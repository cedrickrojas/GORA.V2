<template>
  <article class="server-game-card" :class="{ 'server-game-card--successful': game.status === 'COMPLETED', 'server-game-card--cancelled': game.status === 'CANCELLED' }">
    <div
      class="server-game-card__banner"
      :style="{
        backgroundColor: visual.gradient,
        backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,.08)), url('${getSportImage(game.sport.name)}')`,
      }"
    >
      <span class="server-game-card__sport"><ion-icon :icon="visual.icon" aria-hidden="true" />{{ game.sport.name }}</span>
      <GameStatusBadge v-if="game.status !== 'OPEN'" :status="game.status" />
    </div>
    <div class="server-game-card__body">
      <h3>{{ game.title }}</h3>
      <p class="server-game-card__line"><ion-icon :icon="timeOutline" aria-hidden="true" />{{ formatGameDay(game.gameDate) }}, {{ formatGameTimeRange(game.startTime, game.endTime) }}</p>
      <router-link
        v-if="game.latitude !== null && game.longitude !== null"
        :to="locationMapPath({ latitude: game.latitude, longitude: game.longitude, name: game.locationName }, game.id)"
        class="server-game-card__line server-game-card__location"
      >
        <ion-icon :icon="locationOutline" aria-hidden="true" />{{ game.locationName }}
      </router-link>
      <p v-else class="server-game-card__line"><ion-icon :icon="locationOutline" aria-hidden="true" />{{ game.locationName }}</p>
      <p class="server-game-card__players"><span>Players</span><strong>{{ game.currentPlayers }}/{{ game.requiredPlayers }}</strong><template v-if="game.status === 'OPEN'">· {{ game.remainingSlots }} left</template></p>
      <div class="server-game-card__actions">
        <router-link :to="`/games/${game.id}`" class="server-game-card__button">View Game</router-link>
        <button
          type="button"
          class="server-game-card__button server-game-card__button--primary"
          :class="{ 'server-game-card__button--quiet': action.kind !== 'request' }"
          :disabled="action.kind !== 'request' || busy"
          @click="requestOpen = true; requestError = null"
        >{{ joinLabel }}</button>
      </div>
      <p class="server-game-card__host">Hosted by {{ game.host.displayName }}<template v-if="game.club"> · {{ game.club.name }}</template></p>
    </div>

    <JoinRequestModal
      :is-open="requestOpen"
      :game-title="game.title"
      :host-name="game.host.displayName"
      :auto-accept="game.autoAccept"
      :is-submitting="busy"
      :error="requestError"
      @close="requestOpen = false"
      @send="sendRequest"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { locationOutline, timeOutline } from 'ionicons/icons';
import GameStatusBadge from '@/components/games/GameStatusBadge.vue';
import JoinRequestModal from '@/components/games/JoinRequestModal.vue';
import type { ApiGame } from '@/types/game';
import { useJoinRequestsStore } from '@/stores/join-requests';
import { formatGameDay, formatGameTimeRange } from '@/utils/game-form';
import { joinRequestAction } from '@/utils/join-requests';
import { locationMapPath } from '@/utils/location-map';
import { getSportImage, getSportVisual } from '@/utils/sports';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ game: ApiGame }>();
const joinRequests = useJoinRequestsStore();
const requestOpen = ref(false);
const requestError = ref<string | null>(null);
const visual = computed(() => getSportVisual(props.game.sport.name));
const mine = computed(() => joinRequests.myJoinRequest(props.game.id));
const action = computed(() => joinRequestAction(props.game, mine.value));
const busy = computed(() => joinRequests.submittingGameId === props.game.id);
const JOIN_LABELS = { request: 'Request to Join', pending: 'Request Pending', player: "You're playing", host: "You're hosting", declined: 'Request declined' } as const;
const joinLabel = computed(() => {
  if (busy.value) return 'Sending…';
  if (action.value.kind === 'request') return props.game.autoAccept ? 'Join Game' : 'Request to Join';
  if (action.value.kind === 'closed') return action.value.label;
  return JOIN_LABELS[action.value.kind];
});

onMounted(() => {
  if (!props.game.isHost && joinRequests.mineStatus[props.game.id] !== 'ready' && joinRequests.mineStatus[props.game.id] !== 'loading') {
    void joinRequests.fetchMyJoinRequest(props.game.id);
  }
});

async function sendRequest(message: string | null): Promise<void> {
  const result = await joinRequests.createJoinRequest(props.game.id, message);
  if (!result.ok) {
    requestError.value = result.message;
    return;
  }
  requestOpen.value = false;
  const accepted = joinRequests.myJoinRequest(props.game.id)?.status === 'ACCEPTED';
  void showNotice(accepted ? 'You joined the game. Your slot is confirmed.' : 'Join request sent.');
}
</script>

<style scoped>
.server-game-card{overflow:hidden;border:1px solid var(--gora-line);border-radius:var(--gora-radius-card);background:var(--gora-surface);box-shadow:var(--gora-shadow)}
.server-game-card--successful{border:2px solid #d8ad43;box-shadow:0 0 0 2px rgb(216 173 67 / 16%),0 8px 24px rgb(216 173 67 / 16%)}
.server-game-card--cancelled{filter:grayscale(.75);opacity:.72}
.server-game-card__banner{display:flex;min-height:136px;align-items:flex-end;justify-content:space-between;gap:8px;padding:10px 12px;background-position:center;background-size:cover}
.server-game-card__sport{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--gora-radius-control);background:rgba(0,0,0,.55);font-size:.72rem;font-weight:700;text-transform:capitalize}
.server-game-card__sport ion-icon{font-size:16px}
.server-game-card__body{padding:16px}
.server-game-card__body h3{margin:0 0 6px;font-size:1rem;font-weight:700}
.server-game-card__line{display:flex;align-items:center;gap:6px;margin:0 0 4px;color:var(--gora-muted);font-size:.8rem}
.server-game-card__location{text-decoration:none}
.server-game-card__location:hover{color:var(--ion-text-color);text-decoration:underline}
.server-game-card__players{display:flex;align-items:baseline;gap:6px;margin:10px 0 0;color:var(--gora-muted);font-size:.8rem}
.server-game-card__players span{font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.server-game-card__players strong{color:var(--ion-text-color);font-size:.95rem}
.server-game-card__actions{display:flex;gap:8px;margin-top:10px}
.server-game-card__button{display:flex;flex:1;align-items:center;justify-content:center;min-width:0;padding:8px 10px;border:1px solid var(--gora-line-strong);border-radius:var(--gora-radius-control);background:transparent;color:var(--ion-text-color);font:inherit;font-size:.8rem;font-weight:700;text-align:center;text-decoration:none;cursor:pointer}
.server-game-card__button--primary{border-color:var(--ion-color-primary);background:var(--ion-color-primary);color:var(--ion-color-primary-contrast)}
.server-game-card__button--quiet{background:transparent;color:var(--gora-muted)}
.server-game-card__button:disabled{cursor:default}
.server-game-card__host{margin:10px 0 0;color:#7d8a93;font-size:.72rem}
</style>
