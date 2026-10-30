<template>
  <p v-if="!game && status === 'error'" class="server-game__missing" role="alert">{{ error }}</p>
  <p v-else-if="!game" class="server-game__missing">Loading game…</p>

  <div v-else class="server-game">
    <header class="server-game__hero" :style="{ background: visual.gradient }">
      <div class="server-game__chips">
        <span class="server-game__sport">
          <SportIcon :name="game.sport.name" :icon-url="game.sport.iconUrl" :size="22" />
          {{ game.sport.name }}
        </span>
        <GameStatusBadge :status="game.status" />
        <div class="server-game__header-actions">
          <button type="button" class="server-game__share" @click="shareGame">
            <ion-icon :icon="shareSocialOutline" aria-hidden="true" /> Share
          </button>
          <button
            v-if="game.isHost && (game.canEdit || game.canCancel)"
            type="button"
            class="server-game__more"
            aria-label="More game options"
            :disabled="gamesStore.cancellingId === game.id"
            @click="openHostActions"
          >
            <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
          </button>
        </div>
      </div>
      <h1 class="server-game__title">{{ game.title }}</h1>
      <p v-if="game.description" class="server-game__description">{{ game.description }}</p>
    </header>

    <section class="server-game__facts" aria-label="When and where">
      <p>{{ game.autoAccept ? 'Auto Accept: join instantly while slots are available.' : 'Manual Accept: the host reviews join requests.' }}</p>
      <p><span aria-hidden="true">📅</span> {{ formatGameDay(game.gameDate) }}</p>
      <p><span aria-hidden="true">⏰</span> {{ formatGameTimeRange(game.startTime, game.endTime) }}</p>
      <router-link
        v-if="mapPath"
        :to="mapPath"
        class="server-game__location"
        :aria-label="`Location: ${game.locationName}. Open map`"
      >
        <span aria-hidden="true">📍</span> {{ game.locationName }}
        <ion-icon :icon="chevronForward" aria-hidden="true" />
      </router-link>
      <p v-else><span aria-hidden="true">📍</span> {{ game.locationName }}</p>
      <router-link v-if="mapPath" :to="mapPath" class="server-game__map-button">
        <span aria-hidden="true">🗺️</span> View on Map
      </router-link>
    </section>

    <GameLocationPreview
      v-if="mapPath && game.latitude !== null && game.longitude !== null"
      :name="game.locationName"
      :latitude="game.latitude"
      :longitude="game.longitude"
      :map-path="mapPath"
    />

    <p v-if="game.status === 'CANCELLED'" class="server-game__notice server-game__notice--cancelled">
      The host cancelled this game.
    </p>
    <p v-else-if="game.status === 'COMPLETED'" class="server-game__notice">This game has been played.</p>

    <section class="server-game__capacity" aria-label="Player capacity">
      <p class="server-game__count">
        <span class="server-game__count-label">Players</span>
        <strong>{{ game.currentPlayers }}/{{ game.requiredPlayers }}</strong>
      </p>
      <p class="server-game__remaining">{{ remainingLabel }}</p>
      <div
        class="server-game__bar"
        role="progressbar"
        :aria-valuenow="game.currentPlayers"
        aria-valuemin="0"
        :aria-valuemax="game.requiredPlayers"
      >
        <span :style="{ width: `${(game.currentPlayers / game.requiredPlayers) * 100}%` }" />
      </div>
    </section>

    <section class="server-game__section server-game__section--host">
      <SectionHeader title="Host" />
      <router-link :to="`/profile/${game.host.username}`" class="server-game__host">
        <UserAvatar :user="gameHostSummary(game)" :size="44" />
        <span>
          <strong>{{ game.host.displayName }}</strong>
          <span>@{{ game.host.username }} · Organizer</span>
        </span>
      </router-link>
      <router-link v-if="club" :to="`/clubs/${club.id}`" class="server-game__club">
        <ClubAvatar :club="club" :image-url="game.club?.profileImageUrl ?? null" :size="36" />
        <span>
          <strong>{{ club.name }}</strong>
          <span>Club game</span>
        </span>
      </router-link>
    </section>

    <section class="server-game__section server-game__section--roster" aria-label="Player roster">
      <SectionHeader title="Player Roster" />
      <p v-if="rosterStatus === 'error' && !roster" class="server-game__hint" role="alert">
        {{ rosterError }}
        <button type="button" class="server-game__link" @click="reloadRoster">Try again</button>
      </p>
      <ol class="server-game__roster">
        <li v-for="slot in slots" :key="slot.label" class="server-game__slot">
          <span class="server-game__slot-number">{{ slot.label }}</span>
          <template v-if="slot.player">
            <router-link :to="`/profile/${slot.player.username}`" class="server-game__player">
              <UserAvatar :user="rosterPlayerSummary(slot.player)" :size="30" />
              <span>
                <strong>{{ slot.player.displayName }}</strong>
                <span v-if="slot.player.id === viewerId" class="server-game__you">You</span>
              </span>
            </router-link>
            <div v-if="game.isHost && game.status === 'COMPLETED'" class="server-game__attendance">
              <span v-if="slot.player.attendanceStatus === 'ATTENDED'" class="server-game__attendance-state server-game__attendance-state--present">Attended · +3 GORA</span>
              <span v-else-if="slot.player.attendanceStatus === 'NO_SHOW'" class="server-game__attendance-state server-game__attendance-state--absent">Reported no-show · −2 GORA</span>
              <template v-else>
                <button type="button" class="server-game__attendance-present" :disabled="gamePlayers.attendanceUserId !== null" @click="confirmAttendance(slot.player, 'attended')">{{ gamePlayers.attendanceUserId === slot.player.id ? 'Saving…' : 'Confirm Attended (+3)' }}</button>
                <button type="button" class="server-game__attendance-absent" :disabled="gamePlayers.attendanceUserId !== null" @click="confirmAttendance(slot.player, 'no_show')">Report No-show (−2)</button>
              </template>
            </div>
            <button
              v-else-if="game.isHost && isManaging && game.status !== 'COMPLETED'"
              type="button"
              class="server-game__remove"
              :disabled="gamePlayers.removingUserId !== null"
              :aria-label="`Remove ${slot.player.displayName}`"
              @click="confirmRemove(slot.player)"
            >
              {{ gamePlayers.removingUserId === slot.player.id ? 'Removing…' : 'Remove Player' }}
            </button>
          </template>
          <span v-else class="server-game__slot-open">Open</span>
        </li>
      </ol>
    </section>

    <HostJoinRequests v-if="game.isHost" class="server-game__requests" :game="game" />
    <HostLeaveRequests v-if="game.isHost" class="server-game__requests" :game="game" />

    <div class="server-game__actions">
      <template v-if="game.isHost">
        <button
          v-if="roster && roster.players.length > 0 && game.status !== 'COMPLETED'"
          type="button"
          class="server-game__secondary"
          :aria-pressed="isManaging"
          @click="isManaging = !isManaging"
        >
          {{ isManaging ? 'Done Managing' : 'Manage Players' }}
        </button>
      </template>
      <template v-else-if="action.kind === 'player'">
        <p class="server-game__hint">✓ You're playing in this game.</p>
        <button
          v-if="game.status === 'OPEN' || game.status === 'FULL' || game.status === 'CANCELLED'"
          type="button"
          :class="leaveRequest?.status === 'PENDING' ? 'server-game__secondary' : 'server-game__danger'"
          :disabled="isLeaveRequestBusy"
          @click="confirmLeave(game)"
        >
          {{ isLeaveRequestBusy ? 'Please wait…' : leaveRequest?.status === 'PENDING' ? 'Cancel Leave Request' : 'Request to Leave' }}
        </button>
      </template>
      <button v-else-if="!isRequestKnown" type="button" class="server-game__primary" disabled>
        Checking your request…
      </button>
      <template v-else-if="action.kind === 'request'">
        <p v-if="pastNote" class="server-game__hint">{{ pastNote }}</p>
        <button type="button" class="server-game__primary" :disabled="isSubmitting" @click="openRequestModal">
          {{ game.autoAccept ? 'Join Game' : 'Request to Join' }}
        </button>
      </template>
      <template v-else-if="action.kind === 'pending'">
        <button type="button" class="server-game__primary" disabled>Request Pending</button>
        <button type="button" class="server-game__secondary" :disabled="isSubmitting" @click="confirmCancelRequest">
          {{ isSubmitting ? 'Cancelling…' : 'Cancel Request' }}
        </button>
      </template>
      <p v-else-if="action.kind === 'declined'" class="server-game__declined" role="status">Request declined</p>
      <button
        v-else-if="action.kind === 'closed' && (game.status === 'FULL' || game.status === 'ACTIVE')"
        type="button"
        class="server-game__primary"
        disabled
      >
        {{ action.label }}
      </button>
    </div>

    <JoinRequestModal
      :is-open="isRequestModalOpen"
      :game-title="game.title"
      :host-name="game.host.displayName"
      :auto-accept="game.autoAccept"
      :is-submitting="isSubmitting"
      :error="requestError"
      @close="isRequestModalOpen = false"
      @send="sendRequest"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { actionSheetController, IonIcon, alertController } from '@ionic/vue';
import { chevronForward, createOutline, ellipsisHorizontal, shareSocialOutline, trashOutline } from 'ionicons/icons';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SportIcon from '@/components/sports/SportIcon.vue';
import { useGameShare } from '@/composables/useGameShare';
import { useAuthStore } from '@/stores/auth';
import { useGamePlayersStore } from '@/stores/game-players';
import { useGamesStore } from '@/stores/games';
import { useJoinRequestsStore } from '@/stores/join-requests';
import type { ApiGame } from '@/types/game';
import type { RosterPlayer } from '@/types/game-player';
import {
  formatGameDay,
  formatGameTimeRange,
  gameClubSummary,
  gameHostSummary,
} from '@/utils/game-form';
import { buildRosterSlots } from '@/utils/games';
import { joinRequestAction, pastParticipationNote, rosterPlayerSummary } from '@/utils/join-requests';
import { locationMapPath } from '@/utils/location-map';
import { showNotice } from '@/utils/notice';
import { getSportVisual } from '@/utils/sports';
import GameStatusBadge from './GameStatusBadge.vue';
import GameLocationPreview from '@/components/map/GameLocationPreview.vue';
import HostJoinRequests from './HostJoinRequests.vue';
import HostLeaveRequests from './HostLeaveRequests.vue';
import JoinRequestModal from './JoinRequestModal.vue';

const props = defineProps<{ gameId: string }>();
const router = useRouter();

const auth = useAuthStore();
const gamesStore = useGamesStore();
const joinRequests = useJoinRequestsStore();
const gamePlayers = useGamePlayersStore();
const { shareGame: openGameShare } = useGameShare();
const isRequestModalOpen = ref(false);
const isManaging = ref(false);
const requestError = ref<string | null>(null);

const game = computed(() => gamesStore.gameById(props.gameId));
const myRequest = computed(() => joinRequests.myJoinRequest(props.gameId));
const participation = computed(() => gamePlayers.participationOf(props.gameId));
const leaveRequest = computed(() => gamePlayers.leaveRequestByGame[props.gameId] ?? null);
const isLeaveRequestBusy = ref(false);
const isRequestKnown = computed(() => {
  const loadStatus = joinRequests.mineStatus[props.gameId];
  return loadStatus === 'ready' || loadStatus === 'error' || props.gameId in joinRequests.mineByGame;
});
const action = computed(() =>
  game.value ? joinRequestAction(game.value, myRequest.value, participation.value) : { kind: 'host' as const },
);
const pastNote = computed(() => pastParticipationNote(participation.value));
const roster = computed(() => gamePlayers.rosterOf(props.gameId));
const rosterStatus = computed(() => gamePlayers.rosterStatus[props.gameId] ?? 'idle');
const rosterError = computed(() => gamePlayers.rosterError[props.gameId] ?? 'Could not load the roster.');
const viewerId = computed(() => auth.currentUser?.id ?? null);
const isSubmitting = computed(() => joinRequests.submittingGameId === props.gameId);
const status = computed(() => gamesStore.detailStatus[props.gameId]);
const error = computed(() => gamesStore.detailError[props.gameId] ?? 'This game is not available.');
const visual = computed(() => getSportVisual(game.value?.sport.name ?? ''));
const club = computed(() => (game.value ? gameClubSummary(game.value) : null));
// ACTIVE players from the server fill the first slots; the rest are generated as Open.
const slots = computed(() =>
  game.value ? buildRosterSlots<RosterPlayer>(game.value.requiredPlayers, roster.value?.players ?? []) : [],
);
const remainingLabel = computed(() => {
  const left = game.value?.remainingSlots ?? 0;
  return left === 0 ? 'No slots left' : `${left} ${left === 1 ? 'slot' : 'slots'} left`;
});

async function confirmAttendance(player: RosterPlayer, action: 'attended' | 'no_show'): Promise<void> {
  const attended = action === 'attended';
  const alert = await alertController.create({
    header: attended ? `Confirm ${player.displayName} attended?` : `Report ${player.displayName} as no-show?`,
    message: attended ? 'The player will receive 3 GORA points.' : 'The player will lose 2 GORA points. Confirm only if they did not attend the venue.',
    buttons: [{ text: 'Go Back', role: 'cancel' }, { text: attended ? 'Confirm Attendance' : 'Report No-show', role: 'destructive' }],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'destructive') return;
  const result = await gamePlayers.setAttendance(props.gameId, player.id, action);
  void showNotice(result.ok ? attended ? `${player.displayName} confirmed. 3 GORA points awarded.` : `${player.displayName} reported as no-show. 2 GORA points deducted.` : result.message);
}

onMounted(() => {
  void gamePlayers.fetchMyParticipation(props.gameId);
  void gamePlayers.fetchMyLeaveRequest(props.gameId);
  void gamePlayers.fetchPlayers(props.gameId);
  if (game.value?.isHost) void gamePlayers.fetchHostLeaveRequests(props.gameId);
});

async function shareGame(): Promise<void> {
  const current = game.value;
  if (!current) return;
  await openGameShare({
    id: current.id,
    title: current.title,
    sport: current.sport.name,
    locationName: current.locationName,
    when: `${formatGameDay(current.gameDate)} · ${formatGameTimeRange(current.startTime, current.endTime)}`,
  });
}

async function openHostActions(): Promise<void> {
  const current = game.value;
  if (!current?.isHost) return;
  const buttons = [];
  if (current.canEdit) {
    buttons.push({
      text: 'Edit Game',
      icon: createOutline,
      handler: () => void router.push(`/games/${current.id}/edit`),
    });
  }
  if (current.canCancel) {
    buttons.push({
      text: 'Cancel Game',
      role: 'destructive' as const,
      icon: trashOutline,
      handler: () => void confirmCancel(current),
    });
  }
  buttons.push({ text: 'Close', role: 'cancel' as const });
  const sheet = await actionSheetController.create({ header: 'Game options', buttons });
  await sheet.present();
}
const mapPath = computed(() => {
  const value = game.value;

  if (!value || value.latitude === null || value.longitude === null) {
    return null;
  }

  return locationMapPath({ name: value.locationName, latitude: value.latitude, longitude: value.longitude });
});

async function confirmCancel(target: ApiGame): Promise<void> {
  const alert = await alertController.create({
    header: `Cancel "${target.title}"?`,
    message: 'The game stays visible as cancelled. This cannot be undone.',
    buttons: [
      { text: 'Keep Game', role: 'cancel' },
      { text: 'Cancel Game', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  const result = await gamesStore.cancelGame(target.id);
  void showNotice(result.ok ? 'Game cancelled.' : result.message);
}

function reloadRoster(): void {
  void gamePlayers.fetchPlayers(props.gameId);
}

async function confirmLeave(target: ApiGame): Promise<void> {
  if (isLeaveRequestBusy.value) return;
  const pending = leaveRequest.value?.status === 'PENDING';
  const alert = await alertController.create({
    header: pending ? 'Withdraw leave request?' : 'Request to leave?',
    message: pending ? 'The host will no longer see your request.' : 'The host must approve before your slot is released. One GORA point will be deducted if approved.',
    buttons: [
      { text: 'Go Back', role: 'cancel' },
      { text: pending ? 'Withdraw Request' : 'Send Request', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  isLeaveRequestBusy.value = true;
  const result = pending ? await gamePlayers.cancelMyLeaveRequest(target.id) : await gamePlayers.requestLeaveGame(target.id);
  isLeaveRequestBusy.value = false;
  void showNotice(result.ok ? (pending ? 'Your leave request was withdrawn.' : 'Your leave request was sent to the host.') : result.message);
}

async function confirmRemove(player: RosterPlayer): Promise<void> {
  const alert = await alertController.create({
    header: `Remove ${player.displayName}?`,
    message: 'Their slot opens again. They can send a new request later.',
    buttons: [
      { text: 'Keep Player', role: 'cancel' },
      { text: 'Remove Player', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  const result = await gamePlayers.removePlayer(props.gameId, player.id);
  void showNotice(result.ok ? `${player.displayName} was removed.` : result.message);
}

function openRequestModal(): void {
  requestError.value = null;
  isRequestModalOpen.value = true;
}

async function sendRequest(message: string | null): Promise<void> {
  if (isSubmitting.value) {
    return;
  }

  const result = await joinRequests.createJoinRequest(props.gameId, message);

  if (result.ok) {
    isRequestModalOpen.value = false;
    void showNotice(myRequest.value?.status === 'ACCEPTED'
      ? 'You joined the game. Your slot is confirmed.'
      : `Request sent. ${game.value?.host.displayName ?? 'The host'} will review it.`);
  } else {
    requestError.value = result.message;
  }
}

async function confirmCancelRequest(): Promise<void> {
  const alert = await alertController.create({
    header: 'Cancel your request?',
    message: 'The host will no longer see it. You can ask again later while the game is open.',
    buttons: [
      { text: 'Keep Request', role: 'cancel' },
      { text: 'Cancel Request', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  const result = await joinRequests.cancelJoinRequest(props.gameId);
  void showNotice(result.ok ? 'Request cancelled.' : result.message);
}
</script>

<style scoped>
.server-game {
  padding-bottom: 32px;
}

.server-game__section--host,
.server-game__section--roster {
  margin-bottom: 18px;
}

.server-game__requests {
  display: block;
  margin: 0 16px 18px;
}

.server-game__missing {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.server-game__hero {
  padding: 20px clamp(16px, 4vw, 38px) 22px;
}

.server-game__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.server-game__header-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
}

.server-game__sport {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.server-game__share {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
}

.server-game__more {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  cursor: pointer;
  font-size: 22px;
}

.server-game__more:disabled { opacity: 0.55; cursor: progress; }

.server-game__title {
  margin: 12px 0 6px;
  font-size: clamp(1.4rem, 5.5vw, 2.2rem);
  font-weight: 800;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.server-game__description {
  margin: 0;
  color: rgba(245, 247, 242, 0.85);
  font-size: 0.88rem;
  white-space: pre-line;
}

.server-game__facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px 0;
  font-size: 0.9rem;
}

.server-game__facts p {
  margin: 0;
}

.server-game__location {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: var(--ion-text-color);
  text-decoration: none;
}

.server-game__location:hover {
  text-decoration: underline;
}

.server-game__map-button {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 7px 14px;
  border: 1px solid var(--ion-color-primary);
  border-radius: 999px;
  color: var(--ion-color-primary);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
}

.server-game__notice {
  margin: 14px 16px 0;
  padding: 10px 12px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.server-game__notice--cancelled {
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
}

.server-game__capacity {
  margin: 16px;
  padding: 14px 16px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}

.server-game__count {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.server-game__count-label {
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.server-game__count strong {
  font-size: 1.5rem;
}

.server-game__remaining {
  margin: 2px 0 10px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.server-game__bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--gora-line);
}

.server-game__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ion-color-primary);
}

.server-game__section {
  padding: 0 16px;
}

.server-game__host,
.server-game__club {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ion-text-color);
  text-decoration: none;
}

.server-game__host {
  margin-bottom: 12px;
}

.server-game__club {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}

.server-game__host > span,
.server-game__club > span {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.server-game__host > span span,
.server-game__club > span span {
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.server-game__roster {
  margin: 0;
  padding: 0;
  list-style: none;
}

.server-game__slot {
  display: flex;
  flex-wrap: wrap;
  min-height: 44px;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--gora-line);
}

.server-game__slot-number {
  width: 28px;
  color: var(--gora-muted);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.server-game__slot-open {
  color: #7d8a93;
  font-size: 0.85rem;
}

.server-game__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 16px 0;
}

.server-game__primary,
.server-game__secondary,
.server-game__danger {
  display: block;
  padding: 13px 16px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
}

.server-game__primary {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.server-game__primary:disabled {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--gora-muted);
  cursor: default;
}

.server-game__player {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  color: var(--ion-text-color);
  font-size: 0.9rem;
  text-decoration: none;
}

.server-game__player:hover strong {
  text-decoration: underline;
}

.server-game__you {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  font-size: 0.7rem;
  font-weight: 700;
}

.server-game__remove {
  margin-left: auto;
  padding: 5px 10px;
  border: 1px solid rgba(239, 91, 91, 0.5);
  border-radius: 999px;
  background: transparent;
  color: #ef5b5b;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
}

.server-game__remove:disabled {
  opacity: 0.6;
  cursor: default;
}

.server-game__attendance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.server-game__attendance-state {
  font-size: .72rem;
  font-weight: 800;
}

.server-game__attendance-state--present { color: #e4b74e; }
.server-game__attendance-state--absent { color: #ff8b75; }

.server-game__attendance-present,
.server-game__attendance-absent {
  min-height: 34px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: .7rem;
  font-weight: 800;
}

.server-game__attendance-present {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.server-game__attendance-absent {
  border: 1px solid #a84d46;
  background: transparent;
  color: #ff9a8d;
}

.server-game__attendance-present:disabled,
.server-game__attendance-absent:disabled { opacity: .55; cursor: default; }

.server-game__link {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.server-game__secondary {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
}

.server-game__secondary:disabled {
  opacity: 0.6;
  cursor: default;
}

.server-game__hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
  text-align: center;
}

.server-game__declined {
  margin: 0;
  padding: 12px 16px;
  border-radius: var(--gora-radius-card);
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
  font-weight: 700;
  text-align: center;
}

.server-game__danger {
  border: 1px solid rgba(239, 91, 91, 0.5);
  background: transparent;
  color: #ef5b5b;
}

.server-game__danger:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (min-width: 768px) {
  .server-game {
    max-width: 1180px;
    margin-inline: auto;
    padding: 20px 24px 48px;
  }

  .server-game__hero {
    grid-column: 1 / -1;
    grid-row: 1;
    min-height: clamp(220px, 28vw, 340px);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 30px 38px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 24px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
  }

  .server-game__title {
    max-width: 780px;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1.1;
  }

  .server-game__description {
    max-width: 720px;
    font-size: 1rem;
    line-height: 1.55;
  }

  .server-game__facts,
  .server-game__capacity,
  .server-game__section--host,
  .server-game__section--roster,
  .server-game__requests,
  .server-game__actions,
  .server-game__notice {
    box-sizing: border-box;
    margin: 0;
    padding: 20px;
    border: 1px solid var(--gora-line);
    border-radius: 20px;
    background: var(--gora-surface);
  }

  .server-game__facts {
    gap: 12px;
    padding: 22px 24px;
    font-size: 0.95rem;
  }

  .server-game__capacity {
    padding: 22px;
  }

  .server-game__notice {
    align-self: start;
  }

  .server-game__section--host {
    padding: 20px 24px;
  }

  .server-game__section--roster {
    padding: 20px 24px;
  }

  .server-game__requests {
    display: block;
  }

  .server-game__actions {
    position: static;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
  }

  .server-game__host {
    min-height: 52px;
  }

  .server-game__club {
    margin: 14px 0 0;
  }

  .server-game__slot {
    min-height: 52px;
  }

  .server-game__slot-number {
    width: 34px;
  }

  .server-game__primary,
  .server-game__secondary,
  .server-game__danger {
    width: 100%;
  }
}

@media (min-width: 1000px) {
  .server-game {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
    align-items: start;
    column-gap: 20px;
    row-gap: 18px;
  }

  .server-game__hero { grid-column: 1 / -1; grid-row: 1; }
  .server-game__facts { grid-column: 1; grid-row: 2; }
  .server-game__capacity { grid-column: 2; grid-row: 2; }
  .server-game > .game-location-preview { grid-column: 1; grid-row: 3; }
  .server-game__section--host { grid-column: 2; grid-row: 3; }
  .server-game__section--roster { grid-column: 1; grid-row: 4; }
  .server-game__requests { grid-column: 2; grid-row: 4; }
  .server-game__notice { grid-column: 1 / -1; }
  .server-game__actions { grid-column: 2; grid-row: 5; }
}

@media (max-width: 420px) {
  .server-game__hero { padding-inline: 14px; }
  .server-game__chips { gap: 6px; }
  .server-game__sport { max-width: 100%; }
  .server-game__facts { font-size: 0.84rem; }
  .server-game__capacity { margin-inline: 12px; }
}
</style>
