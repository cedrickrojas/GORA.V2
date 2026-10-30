<template>
  <ion-page>
    <SubPageHeader title="My Games" />
    <ion-content ref="contentRef" :fullscreen="true">
      <div class="my-games">
        <div class="my-games__menu" role="tablist" aria-label="My Games sections">
          <button
            v-for="(section, index) in menuSections"
            :id="`my-games-tab-${section.id}`"
            :key="section.id"
            type="button"
            role="tab"
            class="my-games__menu-item"
            :class="{ 'my-games__menu-item--active': activeSection === section.id }"
            :aria-selected="activeSection === section.id"
            :aria-controls="`my-games-${section.id}`"
            :tabindex="activeSection === section.id ? 0 : -1"
            @click="selectSection(section.id)"
            @keydown="navigateMenu($event, index)"
          >
            <span>{{ section.label }}</span>
            <span v-if="section.count !== null" class="my-games__menu-count">{{ section.count }}</span>
          </button>
        </div>
        <p v-if="actionMessage" class="my-games__notice" role="status">{{ actionMessage }}</p>

        <section
          id="my-games-create"
          v-show="activeSection === 'create'"
          class="my-games__section my-games__create-panel"
          role="tabpanel"
          aria-labelledby="my-games-tab-create"
        >
          <SectionHeader title="Create Games" />
          <p class="my-games__description">
            Organize your next game. Choose a sport, set the schedule, and decide how players join.
          </p>
          <router-link to="/create/game" class="my-games__create">+ Create Game</router-link>
        </section>

        <section
          id="my-games-joined"
          v-show="activeSection === 'joined'"
          class="my-games__section"
          role="tabpanel"
          aria-labelledby="my-games-tab-joined"
        >
          <SectionHeader id="joined-games-title" title="Joined Games">
            <span class="my-games__count">{{ gamesStore.joinedGames.length }}</span>
          </SectionHeader>
          <p class="my-games__description">Your join requests, upcoming games, and game history.</p>
          <p v-if="gamesStore.joinedError" class="my-games__alert" role="alert">
            {{ gamesStore.joinedError }}
            <button type="button" @click="gamesStore.fetchJoinedGames()">Try again</button>
          </p>
          <p v-else-if="gamesStore.joinedStatus !== 'ready' && !gamesStore.joinedGames.length" class="my-games__empty">
            Loading joined games...
          </p>
          <p v-else-if="!gamesStore.joinedGames.length" class="my-games__empty">
            Games you request to join will appear here.
          </p>
          <template v-else>
            <div v-for="group in joinedGroups" :key="group.title" class="my-games__group">
              <h3>
                {{ group.title }} <span>{{ group.games.length }}</span>
              </h3>
              <p v-if="!group.games.length" class="my-games__empty">{{ group.empty }}</p>
              <div v-else class="my-games__stack">
                <div v-for="game in group.games" :key="game.id" class="my-games__joined-card">
                  <GamePreviewCard :game="game" :show-description="false" />
                  <div class="my-games__participation">
                    <div>
                      <span class="my-games__badge">{{ joinedGameLabel(game) }}</span>
                      <p v-if="game.joinedAt || game.requestedAt" class="my-games__date">
                        {{ game.joinedAt ? 'Joined' : 'Requested' }}
                        {{ historyDate(game.joinedAt ?? game.requestedAt) }}
                      </p>
                    </div>
                    <button
                      v-if="canCancelJoining(game, today)"
                      type="button"
                      class="my-games__cancel"
                      :disabled="actingGameId !== null"
                      :aria-label="`Cancel joining ${game.title}`"
                      @click="confirmCancelJoining(game)"
                    >
                      {{ actingGameId === game.id ? 'Sending...' : game.participationStatus === 'ACTIVE' && game.leaveRequestStatus === 'PENDING' ? 'Cancel Leave Request' : game.participationStatus === 'ACTIVE' ? 'Request to Leave' : 'Cancel Join Request' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </section>

        <section
          id="my-games-hosted"
          v-show="activeSection === 'hosted'"
          class="my-games__section"
          role="tabpanel"
          aria-labelledby="my-games-tab-hosted"
        >
          <SectionHeader id="hosted-games-title" title="Hosted Games">
            <span class="my-games__count">{{ gamesStore.hostedGames.length }}</span>
          </SectionHeader>
          <p class="my-games__description">Edit your games, manage join requests, or cancel a game.</p>
          <p v-if="gamesStore.hostedError" class="my-games__alert" role="alert">
            {{ gamesStore.hostedError }}
            <button type="button" @click="gamesStore.fetchMyGames()">Try again</button>
          </p>
          <p v-else-if="gamesStore.hostedStatus !== 'ready' && !gamesStore.hostedGames.length" class="my-games__empty">
            Loading hosted games...
          </p>
          <p v-else-if="!gamesStore.hostedGames.length" class="my-games__empty">You have not hosted any games yet.</p>
          <template v-else>
            <div v-for="group in hostedGroups" :key="group.title" class="my-games__group">
              <h3>
                {{ group.title }} <span>{{ group.games.length }}</span>
              </h3>
              <p v-if="!group.games.length" class="my-games__empty">{{ group.empty }}</p>
              <div v-else class="my-games__stack">
                <div v-for="game in group.games" :key="game.id" class="my-games__hosted-card">
                  <GamePreviewCard :game="game" :show-description="false" />
                  <div class="my-games__host-controls">
                    <label v-if="game.canEdit" class="my-games__approval" :for="`approval-${game.id}`">
                      Player approval
                      <select
                        :id="`approval-${game.id}`"
                        :value="game.autoAccept ? 'auto' : 'manual'"
                        :disabled="actingGameId !== null || gamesStore.isSaving"
                        @change="updateApproval(game, $event)"
                      >
                        <option value="manual">Manual Accept</option>
                        <option value="auto">Auto Accept</option>
                      </select>
                      <span>Applies to new requests. Review existing pending requests below.</span>
                    </label>
                    <p v-else class="my-games__date">{{ game.autoAccept ? 'Auto Accept' : 'Manual Accept' }}</p>
                    <div class="my-games__host-actions">
                      <router-link v-if="game.canEdit" :to="`/games/${game.id}/edit`" class="my-games__edit"
                        >Edit Game</router-link
                      >
                      <router-link :to="`/games/${game.id}`" class="my-games__edit">
                        Manage Requests<span v-if="game.pendingRequestCount"> ({{ game.pendingRequestCount }})</span>
                      </router-link>
                      <button
                        v-if="game.canCancel"
                        type="button"
                        class="my-games__host-cancel"
                        :disabled="actingGameId !== null || gamesStore.isSaving"
                        @click="confirmCancelHosted(game)"
                      >
                        {{ actingGameId === game.id ? 'Please wait...' : 'Cancel Game' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { alertController, IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import GamePreviewCard from '@/components/games/GamePreviewCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import { useGamePlayersStore } from '@/stores/game-players';
import { useGamesStore } from '@/stores/games';
import { useJoinRequestsStore } from '@/stores/join-requests';
import type { ApiGame, JoinedGame } from '@/types/game';
import { deviceMoment, splitHostedGames } from '@/utils/game-form';
import { canCancelJoining, joinedGameLabel, splitJoinedGames } from '@/utils/my-games';

const gamesStore = useGamesStore();
const auth = useAuthStore();
const gamePlayers = useGamePlayersStore();
const joinRequests = useJoinRequestsStore();
const today = ref(deviceMoment().date);
const actingGameId = ref<string | null>(null);
const actionMessage = ref('');
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
type GamesSection = 'create' | 'joined' | 'hosted';
const activeSection = ref<GamesSection>('joined');
const menuSections = computed(() => [
  { id: 'create' as const, label: 'Create Games', count: null },
  { id: 'joined' as const, label: 'Joined Games', count: gamesStore.joinedGames.length },
  { id: 'hosted' as const, label: 'Hosted Games', count: gamesStore.hostedGames.length },
]);

function selectSection(section: GamesSection): void {
  if (activeSection.value === section) return;
  activeSection.value = section;
  actionMessage.value = '';
  void nextTick(() => {
    void contentRef.value?.$el.scrollToTop?.(0);
  });
}

function navigateMenu(event: KeyboardEvent, index: number): void {
  let next: number;
  if (event.key === 'ArrowRight') next = (index + 1) % menuSections.value.length;
  else if (event.key === 'ArrowLeft') next = (index + menuSections.value.length - 1) % menuSections.value.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = menuSections.value.length - 1;
  else return;
  event.preventDefault();
  selectSection(menuSections.value[next].id);
  const menu = (event.currentTarget as HTMLElement).parentElement;
  menu?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

const hostedGroups = computed(() => {
  const hosted = splitHostedGames(gamesStore.hostedGames, today.value);
  return [
    { title: 'Upcoming & ongoing', games: hosted.upcoming, empty: 'You are not hosting any upcoming games.' },
    { title: 'Game history', games: hosted.past, empty: 'Past and cancelled hosted games will appear here.' },
  ];
});
const joinedGroups = computed(() => {
  const joined = splitJoinedGames(gamesStore.joinedGames, today.value);
  return [
    { title: 'Upcoming & pending', games: joined.upcoming, empty: 'No upcoming games or pending requests.' },
    { title: 'Game history', games: joined.past, empty: 'Past games and cancelled joins will appear here.' },
  ];
});

function historyDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
}

async function updateApproval(game: ApiGame, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  if (actingGameId.value !== null || !game.canEdit) {
    select.value = game.autoAccept ? 'auto' : 'manual';
    return;
  }
  const isCurrent = captureSession(auth);
  const autoAccept = select.value === 'auto';
  actingGameId.value = game.id;
  actionMessage.value = '';
  try {
    const result = await gamesStore.updateGame(game.id, { autoAccept });
    if (!isCurrent()) return;
    actionMessage.value = result.ok
      ? `${autoAccept ? 'Auto Accept' : 'Manual Accept'} saved. Existing pending requests still need your review.`
      : result.message;
    select.value = gamesStore.gameById(game.id)?.autoAccept ? 'auto' : 'manual';
  } finally {
    actingGameId.value = null;
  }
}

async function confirmCancelHosted(game: ApiGame): Promise<void> {
  if (actingGameId.value !== null || !game.canCancel) return;
  const isCurrent = captureSession(auth);
  actingGameId.value = game.id;
  actionMessage.value = '';
  try {
    const alert = await alertController.create({
      header: 'Cancel this game?',
      message: 'The game will be cancelled for all players and kept in your history. This cannot be undone.',
      buttons: [
        { text: 'Keep Game', role: 'cancel' },
        { text: 'Cancel Game', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive' || !isCurrent()) return;
    const result = await gamesStore.cancelGame(game.id);
    if (isCurrent()) actionMessage.value = result.ok ? 'Game cancelled and saved in your history.' : result.message;
  } finally {
    actingGameId.value = null;
  }
}

async function confirmCancelJoining(game: JoinedGame): Promise<void> {
  if (actingGameId.value !== null || !canCancelJoining(game, today.value)) return;
  const isCurrent = captureSession(auth);
  actingGameId.value = game.id;
  actionMessage.value = '';
  try {
    const alert = await alertController.create({
      header: game.participationStatus === 'ACTIVE' ? (game.leaveRequestStatus === 'PENDING' ? 'Cancel leave request?' : 'Request to leave?') : 'Cancel join request?',
      message: game.participationStatus === 'ACTIVE'
        ? game.leaveRequestStatus === 'PENDING'
          ? 'Your pending request to leave will be withdrawn.'
          : 'The host must approve before you leave. If approved, 1 GORA point will be deducted.'
        : 'Your pending request to join will be cancelled.',
      buttons: [
        { text: 'Go Back', role: 'cancel' },
        { text: game.participationStatus === 'ACTIVE' ? (game.leaveRequestStatus === 'PENDING' ? 'Withdraw Request' : 'Request to Leave') : 'Cancel Join Request', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive' || !isCurrent()) return;

    const result = game.participationStatus === 'ACTIVE'
      ? game.leaveRequestStatus === 'PENDING'
        ? await gamePlayers.cancelMyLeaveRequest(game.id)
        : await gamePlayers.requestLeaveGame(game.id)
      : await joinRequests.cancelJoinRequest(game.id);
    if (!isCurrent()) return;
    actionMessage.value = result.ok
      ? game.participationStatus === 'ACTIVE'
        ? game.leaveRequestStatus === 'PENDING' ? 'Your leave request was withdrawn.' : 'Your leave request was sent to the host. 1 GORA point will be deducted if approved.'
        : 'Your join request was cancelled.'
      : result.message;
    await gamesStore.fetchJoinedGames();
  } finally {
    actingGameId.value = null;
  }
}

onIonViewWillEnter(() => {
  today.value = deviceMoment().date;
  actionMessage.value = '';
  void gamesStore.fetchMyGames();
  void gamesStore.fetchJoinedGames();
});
</script>

<style scoped>
.my-games {
  padding: 12px 16px 32px;
}
.my-games__menu {
  position: sticky;
  z-index: 3;
  top: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--ion-background-color);
}
.my-games__menu-item {
  display: flex;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 6px;
  border: 0;
  border-radius: var(--gora-radius-control);
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: clamp(0.72rem, 2.8vw, 0.85rem);
  font-weight: 700;
  line-height: 1.3;
}
.my-games__menu-item--active {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
.my-games__menu-count {
  min-width: 20px;
  padding: 2px 5px;
  border-radius: 999px;
  background: var(--gora-surface-raised);
  color: var(--ion-text-color);
  font-size: 0.68rem;
}
.my-games__create-panel {
  padding: 20px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}
.my-games__create {
  display: block;
  padding: 11px;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 0.88rem;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
}
.my-games__section {
  margin-top: 24px;
}
.my-games__count {
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}
.my-games__description,
.my-games__empty {
  color: var(--gora-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}
.my-games__description {
  margin: 6px 0 16px;
}
.my-games__empty {
  margin: 12px 0;
}
.my-games__group {
  margin-top: 18px;
}
.my-games__group h3 {
  margin: 0 0 12px;
  font-size: 0.85rem;
  font-weight: 700;
}
.my-games__group h3 span {
  margin-left: 6px;
  color: var(--gora-muted);
  font-size: 0.75rem;
}
.my-games__stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.my-games__joined-card {
  min-width: 0;
}
.my-games__participation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  margin-top: 6px;
  border-radius: 12px;
  background: var(--gora-surface);
}
.my-games__badge {
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}
.my-games__date {
  margin: 4px 0 0;
  color: var(--gora-muted);
  font-size: 0.72rem;
}
.my-games__cancel,
.my-games__host-cancel {
  padding: 9px 12px;
  border: 1px solid var(--ion-color-danger, #ef5b5b);
  border-radius: var(--gora-radius-control);
  background: transparent;
  color: var(--ion-color-danger, #ef5b5b);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.my-games__cancel:disabled,
.my-games__host-cancel:disabled {
  opacity: 0.5;
  cursor: wait;
}
.my-games__notice {
  padding: 12px;
  border-radius: 12px;
  background: var(--gora-surface);
  font-size: 0.85rem;
}
.my-games__host-controls {
  padding: 12px;
  margin-top: 6px;
  border-radius: 12px;
  background: var(--gora-surface);
}
.my-games__approval {
  display: grid;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
}
.my-games__approval select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: var(--gora-radius-control);
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
}
.my-games__approval span {
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 400;
  line-height: 1.5;
}
.my-games__host-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.my-games__edit {
  padding: 9px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: var(--gora-radius-control);
  color: var(--ion-text-color);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}
.my-games__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
  font-size: 0.82rem;
}
.my-games__alert button {
  border: 0;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}
</style>
