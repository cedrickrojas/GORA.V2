<template>
  <ion-page>
    <SubPageHeader title="My Games" />

    <ion-content :fullscreen="true">
      <div class="my-games">
        <ol class="my-games__flow" aria-label="How joining works">
          <li v-for="step in FLOW_STEPS" :key="step">{{ step }}</li>
        </ol>

        <router-link to="/create/game" class="my-games__create">+ Create Game</router-link>

        <p v-if="loadError" class="my-games__alert" role="alert">
          {{ loadError }}
          <button type="button" @click="refresh">Try again</button>
        </p>
        <p v-else-if="isFirstLoad" class="my-games__empty">Loading your games…</p>

        <template v-else>
          <section v-for="section in sections" :key="section.title" class="my-games__section">
            <SectionHeader :title="section.title">
              <span class="my-games__count">{{ section.games.length }}</span>
            </SectionHeader>
            <p v-if="section.games.length === 0" class="my-games__empty">{{ section.empty }}</p>
            <div v-else class="my-games__stack">
              <GamePreviewCard v-for="game in section.games" :key="game.id" :game="game" :show-description="false" />
            </div>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import GamePreviewCard from '@/components/games/GamePreviewCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useGamesStore } from '@/stores/games';
import { deviceMoment, splitHostedGames } from '@/utils/game-form';

const FLOW_STEPS = ['Request', 'Host accepts', 'Play', 'Completed', 'Activity + badges'] as const;

const gamesStore = useGamesStore();

const isFirstLoad = computed(
  () =>
    (gamesStore.hostedStatus !== 'ready' || gamesStore.playingStatus !== 'ready') &&
    gamesStore.hostedGames.length === 0 &&
    gamesStore.playingGames.length === 0,
);
const loadError = computed(() => gamesStore.hostedError ?? gamesStore.playingError);
/** Hosted games and games you are an ACTIVE player in; left or removed games are not listed. */
const sections = computed(() => {
  const today = deviceMoment().date;
  const hosted = splitHostedGames(gamesStore.hostedGames, today);
  const playing = splitHostedGames(gamesStore.playingGames, today);
  const hostedIds = new Set(gamesStore.hostedGames.map((game) => game.id));
  const everything = [...gamesStore.hostedGames, ...gamesStore.playingGames.filter((game) => !hostedIds.has(game.id))];

  return [
    { title: 'Hosting', games: hosted.upcoming, empty: 'You are not hosting any upcoming games.' },
    { title: 'Playing', games: playing.upcoming, empty: 'Games you were accepted into show up here.' },
    {
      title: 'Past & cancelled',
      games: splitHostedGames(everything, today).past,
      empty: 'Games that are over or cancelled show up here.',
    },
  ];
});

function refresh(): void {
  void gamesStore.fetchMyGames();
  void gamesStore.fetchPlayingGames();
}

onIonViewWillEnter(refresh);
</script>

<style scoped>
.my-games {
  padding: 12px 16px 32px;
}

.my-games__flow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.72rem;
  list-style: none;
}

.my-games__flow li:not(:last-child)::after {
  margin-left: 6px;
  color: var(--ion-color-primary);
  content: '→';
}

.my-games__create {
  display: block;
  margin-top: 14px;
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

.my-games__stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.my-games__empty {
  margin: 16px 0 0;
  color: #7d8a93;
  font-size: 0.85rem;
}

.my-games__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 16px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
  font-size: 0.82rem;
  font-weight: 600;
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
