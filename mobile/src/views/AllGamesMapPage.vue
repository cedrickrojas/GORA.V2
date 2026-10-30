<template>
  <ion-page>
    <SubPageHeader title="Games Map" back-href="/discover" />
    <ion-content :fullscreen="true">
      <main class="all-games-map">
        <header class="all-games-map__heading">
          <div>
            <p class="all-games-map__eyebrow">DISCOVER ACROSS THE PHILIPPINES</p>
            <h1>Games near you and beyond</h1>
            <p>Tap a marker to see games at that location.</p>
          </div>
          <button type="button" class="all-games-map__refresh" :disabled="loading" @click="load">
            {{ loading ? 'Loading…' : 'Refresh' }}
          </button>
        </header>

        <p v-if="error" class="all-games-map__error" role="alert">{{ error }}</p>
        <p v-else-if="!loading && !games.length" class="all-games-map__empty">
          No active or upcoming games have map locations yet.
        </p>
        <GameDiscoveryMap
          v-else
          :games="games"
          :center="null"
          :radius-km="null"
          :fit-markers="true"
          :selected-game-id="selectedGameId"
          :loading="loading"
          :busy-game-id="busyGameId"
          :join-action-of="joinActionOf"
          @select="selectedGameId = $event"
          @view="viewGame"
          @join="openJoin"
        />

        <section v-if="!loading && games.length" class="all-games-map__list" aria-label="Games on this map">
          <h2>Games on the map <span>{{ games.length }}</span></h2>
          <DiscoveredGameCard
            v-for="game in games"
            :key="game.id"
            :game="game"
            :join-action="joinActionOf(game)"
            :highlighted="game.id === selectedGameId"
            :busy="busyGameId === game.id"
            @view="viewGame"
            @join="openJoin"
          />
        </section>
      </main>
      <JoinRequestModal
        :is-open="joiningGame !== null"
        :game-title="joiningGame?.title ?? ''"
        :host-name="joiningGame?.host.displayName ?? ''"
        :auto-accept="joiningGame?.autoAccept"
        :is-submitting="busyGameId !== null"
        :error="joinError"
        @close="closeJoin"
        @send="sendJoin"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonPage } from '@ionic/vue';
import JoinRequestModal from '@/components/games/JoinRequestModal.vue';
import DiscoveredGameCard from '@/components/map/DiscoveredGameCard.vue';
import GameDiscoveryMap from '@/components/map/GameDiscoveryMap.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useDiscoveryJoin } from '@/composables/useDiscoveryJoin';
import { useDiscoveryStore } from '@/stores/discovery';
import type { DiscoveredGame } from '@/types/discovery';

const router = useRouter();
const discovery = useDiscoveryStore();
const games = ref<DiscoveredGame[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const selectedGameId = ref<string | null>(null);
const { joiningGame, joinError, busyGameId, joinActionOf, openJoin, closeJoin, sendJoin } = useDiscoveryJoin(
  games,
  (gameId, status, updatedGame) => {
    games.value = games.value.map((game) => game.id === gameId ? {
      ...game,
      ...(updatedGame ? {
        isPlayer: updatedGame.isPlayer,
        currentPlayers: updatedGame.currentPlayers,
        remainingSlots: updatedGame.remainingSlots,
        status: updatedGame.status,
      } : {}),
      myJoinRequestStatus: status,
    } : game);
  },
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  const result = await discovery.discoverAll();
  if (result.ok) games.value = result.games;
  else error.value = result.message;
  loading.value = false;
}

function viewGame(gameId: string): void {
  void router.push(`/games/${gameId}`);
}

onMounted(() => void load());
</script>

<style scoped>
.all-games-map {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 14px 36px;
}

.all-games-map__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.all-games-map__eyebrow {
  margin: 0 0 5px;
  color: var(--ion-color-primary);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.all-games-map__heading h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.all-games-map__heading p:last-child {
  margin: 5px 0 0;
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.all-games-map__refresh {
  flex: none;
  padding: 8px 12px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
}

.all-games-map__refresh:disabled { opacity: 0.6; }
.all-games-map__error, .all-games-map__empty { margin: 0; color: var(--gora-muted); }
.all-games-map__error { color: #ef5b5b; }

.all-games-map__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.all-games-map__list h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
  font-size: 1rem;
}

.all-games-map__list h2 span {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.75rem;
}

@media (min-width: 700px) {
  .all-games-map { padding-inline: 24px; }
  .all-games-map__heading h1 { font-size: 1.65rem; }
}
</style>
