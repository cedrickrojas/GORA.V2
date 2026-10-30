<template>
  <ion-page>
    <SubPageHeader class="game-details-header" :title="pageTitle" back-href="/home" />

    <ion-content class="game-details-content" :fullscreen="true">
      <ServerGameDetails v-if="isServerGame" :game-id="gameId" />

      <p v-else-if="isLoaded && !details" class="game__missing">This game is not available.</p>

      <div v-else-if="details" class="game">
        <header class="game__hero" :style="{ background: visual.gradient }">
          <span class="game__sport">
            <span aria-hidden="true">{{ marker }}</span>
            {{ details.sport }}
          </span>
          <button type="button" class="game__share" @click="shareDemoGame">
            <ion-icon :icon="shareSocialOutline" aria-hidden="true" /> Share
          </button>
          <h1 class="game__title">{{ details.title }}</h1>
          <router-link
            :to="locationMapPath(details.location, details.id)"
            class="game__meta game__location"
            :aria-label="`Location: ${details.location.name}. Open map`"
          >
            <ion-icon :icon="locationOutline" aria-hidden="true" />
            {{ details.location.name }}
            <ion-icon :icon="chevronForward" class="game__location-go" aria-hidden="true" />
          </router-link>
          <p class="game__meta">
            <ion-icon :icon="timeOutline" aria-hidden="true" />
            {{ formatStartTime(Date.parse(details.startsAt), now) }} · {{ details.skillLevel }}
          </p>
        </header>

        <GameLocationPreview
          :name="details.location.name"
          :latitude="details.location.latitude"
          :longitude="details.location.longitude"
          :map-path="locationMapPath(details.location, details.id)"
        />

        <section class="game__capacity" aria-label="Player capacity">
          <p class="game__count">
            <span class="game__count-label">Players</span>
            <strong>{{ formatPlayerCount(details) }}</strong>
          </p>
          <p class="game__remaining">{{ remainingLabel }}</p>
          <div
            class="game__bar"
            role="progressbar"
            :aria-valuenow="getPlayerCount(details)"
            aria-valuemin="0"
            :aria-valuemax="details.requiredPlayers"
          >
            <span :style="{ width: `${(getPlayerCount(details) / details.requiredPlayers) * 100}%` }" />
          </div>
        </section>

        <section class="game__section">
          <SectionHeader title="Host" />
          <div class="game__host">
            <UserAvatar :user="details.host" :size="44" />
            <div>
              <p class="game__host-name">{{ details.host.displayName }}</p>
              <p class="game__host-role">Organizer · {{ hostIsPlaying ? 'also playing' : 'not playing' }}</p>
            </div>
          </div>
          <router-link v-if="details.club" :to="`/clubs/${details.club.id}`" class="game__club">
            <ClubAvatar :club="details.club" :size="36" />
            <span>
              <strong>{{ details.club.name }}</strong>
              <span>Club game</span>
            </span>
          </router-link>
        </section>

        <section class="game__section">
          <SectionHeader title="Roster" />
          <ol class="roster">
            <li v-for="slot in slots" :key="slot.label" class="roster__slot" :class="{ 'roster__slot--open': !slot.player }">
              <span class="roster__number">{{ slot.label }}</span>
              <template v-if="slot.player">
                <UserAvatar :user="slot.player.user" :size="32" />
                <span class="roster__name">{{ slot.player.user.displayName }}</span>
                <span v-if="slot.player.isHost" class="roster__tag">Host</span>
                <span v-if="slot.player.user.id === currentUserId" class="roster__tag roster__tag--you">You</span>
              </template>
              <span v-else class="roster__open">Open</span>
            </li>
          </ol>
        </section>
      </div>
    </ion-content>

    <ion-footer
      v-if="!isServerGame && game && game.status !== 'COMPLETED' && game.status !== 'CANCELLED'"
      class="ion-no-border"
    >
      <div class="game__cta">
        <button type="button" class="game__join" :disabled="!canRequestToJoin(game)" @click="joinGame(game)">
          {{ game.status === 'FULL' && game.participation === 'NONE' ? 'Game is full' : PARTICIPATION_LABELS[game.participation] }}
        </button>
      </div>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import { IonContent, IonFooter, IonIcon, IonPage, onIonViewWillEnter } from '@ionic/vue';
import { chevronForward, locationOutline, shareSocialOutline, timeOutline } from 'ionicons/icons';
import SectionHeader from '@/components/common/SectionHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import ServerGameDetails from '@/components/games/ServerGameDetails.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useJoinGame } from '@/composables/useJoinGame';
import { useNow } from '@/composables/useNow';
import { fetchGameDetails } from '@/services/game.service';
import { useGamePlayersStore } from '@/stores/game-players';
import { useGamesStore } from '@/stores/games';
import { useJoinRequestsStore } from '@/stores/join-requests';
import { useSessionStore } from '@/stores/session';
import type { GameDetails } from '@/types/game';
import { isServerGameId } from '@/utils/game-form';
import {
  PARTICIPATION_LABELS,
  buildRosterSlots,
  canRequestToJoin,
  formatPlayerCount,
  getPlayerCount,
  getSpotsLeft,
} from '@/utils/games';
import { locationMapPath } from '@/utils/location-map';
import GameLocationPreview from '@/components/map/GameLocationPreview.vue';
import { getSportMarker, getSportVisual } from '@/utils/sports';
import { formatStartTime } from '@/utils/time';
import { showNotice } from '@/utils/notice';
import { shareLink } from '@/utils/share-link';

// Ionic keeps pages alive, so the id is read once for this page instance.
const gameId = String(useRoute().params.gameId ?? '');
/** Games created in GORA come from the API; other ids are the demo feed's games. */
const isServerGame = isServerGameId(gameId);

const gamesStore = useGamesStore();
const joinRequestsStore = useJoinRequestsStore();
const gamePlayersStore = useGamePlayersStore();
const sessionStore = useSessionStore();
const { joinGame } = useJoinGame();
const now = useNow();
const details = ref<GameDetails | null>(null);
const isLoaded = ref(false);

/** The store copy tracks the viewer's join state after a request is sent. */
const game = computed(() => gamesStore.games.find((candidate) => candidate.id === gameId) ?? null);
const currentUserId = computed(() => sessionStore.currentUser?.id ?? '');
const pageTitle = computed(() =>
  isServerGame ? (gamesStore.gameById(gameId)?.sport.name ?? 'Game') : (details.value?.sport ?? 'Game'),
);
const visual = computed(() => getSportVisual(details.value?.sport ?? ''));
const marker = computed(() => getSportMarker(details.value?.sport ?? ''));
const slots = computed(() => (details.value ? buildRosterSlots(details.value.requiredPlayers, details.value.players) : []));
const hostIsPlaying = computed(() => details.value?.players.some((player) => player.isHost) ?? false);
const remainingLabel = computed(() => {
  const left = details.value ? getSpotsLeft(details.value) : 0;

  return left === 0 ? 'No slots left' : `${left} ${left === 1 ? 'slot' : 'slots'} left`;
});

async function shareDemoGame(): Promise<void> {
  if (!details.value) return;
  try {
    const result = await shareLink(details.value.title, `/games/${encodeURIComponent(gameId)}`);
    if (result !== 'cancelled') void showNotice(result === 'copied' ? 'Game link copied.' : 'Game shared.');
  } catch {
    void showNotice('Could not share this game. Please try again.');
  }
}

/**
 * The roster for everyone; the host also loads the requests on the game, everyone else
 * their own request and participation.
 */
async function refreshServerGame(): Promise<void> {
  const result = await gamesStore.fetchGame(gameId);

  if (!result.ok) {
    return;
  }

  const roster = gamePlayersStore.fetchPlayers(gameId);

  if (gamesStore.gameById(gameId)?.isHost) {
    await Promise.all([roster, joinRequestsStore.fetchGameJoinRequests(gameId)]);
  } else {
    await Promise.all([
      roster,
      joinRequestsStore.fetchMyJoinRequest(gameId),
      gamePlayersStore.fetchMyParticipation(gameId),
    ]);
  }
}

onIonViewWillEnter(() => {
  if (isServerGame) {
    void refreshServerGame();
  }
});

onMounted(async () => {
  if (isServerGame) {
    return;
  }

  void gamesStore.load();
  void sessionStore.load();
  details.value = await fetchGameDetails(gameId);
  isLoaded.value = true;
});
</script>

<style scoped>
.game {
  padding-bottom: 24px;
}

ion-content.game-details-content {
  --padding-start: 0;
  --padding-end: 0;
}

ion-header.game-details-header ion-toolbar {
  --padding-start: max(8px, calc((100% - var(--gora-column)) / 2));
  --padding-end: max(8px, calc((100% - var(--gora-column)) / 2));
}

.game__missing {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.game__hero {
  position: relative;
  padding: 20px 16px 18px;
}

.game__share {
  position: absolute;
  top: 18px;
  right: 16px;
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

.game__sport {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.game__title {
  margin: 12px 0 8px;
  font-size: 1.35rem;
  font-weight: 800;
}

.game__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
  color: rgba(245, 247, 242, 0.85);
  font-size: 0.85rem;
}

.game__location {
  width: fit-content;
  text-decoration: none;
}

.game__location:hover {
  text-decoration: underline;
}

.game__location-go {
  font-size: 0.8rem;
  opacity: 0.7;
}

.game__capacity {
  margin: 16px;
  padding: 14px 16px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
}

.game__count {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.game__count-label {
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.game__count strong {
  font-size: 1.5rem;
}

.game__remaining {
  margin: 2px 0 10px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.game__bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--gora-line);
}

.game__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ion-color-primary);
}

.game__section {
  padding: 0 16px;
}

.game__club {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  text-decoration: none;
}

.game__club > span {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.game__club > span span {
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.game__host {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.game__host-name {
  margin: 0;
  font-weight: 700;
}

.game__host-role {
  margin: 2px 0 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.roster {
  margin: 0;
  padding: 0;
  list-style: none;
}

.roster__slot {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--gora-line);
}

.roster__number {
  width: 24px;
  color: var(--gora-muted);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.roster__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roster__open {
  color: #7d8a93;
  font-size: 0.85rem;
}

.roster__tag {
  padding: 2px 8px;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.4);
  border-radius: 999px;
  color: var(--ion-color-primary);
  font-size: 0.68rem;
  font-weight: 700;
}

.roster__tag--you {
  border-color: var(--gora-line-strong);
  color: var(--ion-text-color);
}

.game__cta {
  padding: 8px 16px 12px;
  background: var(--ion-background-color);
}

.game__join {
  width: 100%;
  padding: 13px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.game__join:disabled {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--gora-muted);
  cursor: default;
}

@media (min-width: 768px) {
  ion-content.game-details-content {
    --padding-start: max(24px, calc((100% - var(--gora-column, 680px)) / 2));
    --padding-end: max(24px, calc((100% - var(--gora-column, 680px)) / 2));
  }

  ion-header.game-details-header ion-toolbar {
    --padding-start: max(24px, calc((100% - var(--gora-column, 680px)) / 2));
    --padding-end: max(24px, calc((100% - var(--gora-column, 680px)) / 2));
  }

  .game__cta {
    box-sizing: border-box;
    width: 100%;
    max-width: var(--gora-column, 680px);
    margin-inline: auto;
    padding: 8px 16px 12px;
    background: transparent;
  }

  .game {
    display: grid;
    max-width: var(--gora-column, 680px);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    column-gap: 24px;
    row-gap: 18px;
    margin-inline: auto;
  }

  .game__hero {
    grid-column: 1 / -1;
    padding: 34px 38px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
  }

  .game__title {
    max-width: 760px;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .game__capacity {
    grid-column: 1;
    grid-row: 3;
    margin: 0;
    padding: 22px;
    border-radius: 20px;
  }

  .game__section {
    grid-column: 1;
    padding: 0 4px;
  }
}
</style>
