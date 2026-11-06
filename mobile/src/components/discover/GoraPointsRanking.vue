<template>
  <section
    class="points-ranking"
    aria-label="GORA Points Ranking"
    :aria-busy="ranking.isLoading"
  >
    <SectionHeader title="GORA Points Ranking">
      <button
        class="points-ranking__refresh"
        type="button"
        aria-label="Refresh ranking"
        :disabled="ranking.isLoading"
        @click="ranking.load(true)"
      >
        <ion-icon :icon="refreshOutline" aria-hidden="true" />
      </button>
    </SectionHeader>
    <div class="points-ranking__card">
      <div class="points-ranking__intro">
        <ion-icon :icon="trophyOutline" aria-hidden="true" />
        <div>
          <strong>Play. Connect. Climb.</strong>
          <p>All-time points from active GORA players.</p>
        </div>
      </div>

      <router-link
        v-if="ranking.currentPlayer"
        to="/profile"
        class="points-ranking__own"
      >
        <span
          >Your rank
          <strong
            >#{{ ranking.currentPlayer.rank.toLocaleString() }}</strong
          ></span
        >
        <GoraPointsBadge :points="ranking.currentPlayer.goraPoints" />
      </router-link>

      <div
        v-if="ranking.isLoading && !ranking.isLoaded"
        class="points-ranking__loading"
        role="status"
      >
        <span>Loading rankings...</span>
        <div
          v-for="row in 3"
          :key="row"
          class="points-ranking__skeleton"
          aria-hidden="true"
        />
      </div>
      <p
        v-else-if="ranking.isLoaded && ranking.players.length === 0"
        class="points-ranking__message"
      >
        No players to rank yet. Earn points and start the leaderboard.
      </p>

      <ol
        v-if="ranking.players.length"
        class="points-ranking__list"
        aria-label="Ranked players"
      >
        <li
          v-for="player in ranking.players"
          :key="player.id"
          :value="player.rank"
        >
          <router-link
            :to="
              player.id === auth.currentUser?.id
                ? '/profile'
                : `/profile/${encodeURIComponent(player.username)}`
            "
            class="points-ranking__player"
            :class="{
              'points-ranking__player--me': player.id === auth.currentUser?.id,
            }"
          >
            <span
              class="points-ranking__rank"
              :class="{ 'points-ranking__rank--top': player.rank <= 3 }"
              >#{{ player.rank.toLocaleString() }}</span
            >
            <UserAvatar :user="player" :size="40" />
            <span class="points-ranking__name">
              <strong>{{ player.displayName }}</strong>
              <span>@{{ player.username }}</span>
            </span>
            <GoraPointsBadge :points="player.goraPoints" />
          </router-link>
        </li>
      </ol>

      <div v-if="ranking.error" class="points-ranking__error" role="alert">
        <p>{{ ranking.error }}</p>
        <button
          type="button"
          :disabled="ranking.isLoading"
          @click="ranking.load(true)"
        >
          Try again
        </button>
      </div>
      <button
        v-else-if="ranking.hasMore"
        class="points-ranking__more"
        type="button"
        :disabled="ranking.isLoading"
        @click="ranking.loadMore()"
      >
        {{ ranking.isLoading ? "Loading..." : "Load more players" }}
      </button>
      <p class="points-ranking__note">
        Earn points by logging in, posting, and playing games. Tied scores share
        a rank.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";
import { refreshOutline, trophyOutline } from "ionicons/icons";
import { RouterLink } from "vue-router";
import GoraPointsBadge from "@/components/common/GoraPointsBadge.vue";
import SectionHeader from "@/components/common/SectionHeader.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import { useAuthStore } from "@/stores/auth";
import { useGoraRankingStore } from "@/stores/gora-ranking";

const auth = useAuthStore();
const ranking = useGoraRankingStore();
</script>

<style scoped>
.points-ranking {
  margin-top: 24px;
}
.points-ranking__card {
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}
.points-ranking__intro {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
}
.points-ranking__intro > ion-icon {
  flex: none;
  color: var(--ion-color-primary);
  font-size: 28px;
}
.points-ranking__intro strong {
  font-size: 1rem;
}
.points-ranking__intro p {
  margin: 4px 0 0;
  color: var(--gora-muted);
  font-size: 0.75rem;
}
.points-ranking__refresh {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--gora-line);
  border-radius: 8px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font-size: 18px;
}
.points-ranking__own {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 12px 10px;
  padding: 14px;
  border: 1px solid
    color-mix(in srgb, var(--ion-color-primary) 45%, var(--gora-line));
  border-radius: 8px;
  background: color-mix(
    in srgb,
    var(--ion-color-primary) 8%,
    var(--gora-surface)
  );
  color: var(--ion-text-color);
  text-decoration: none;
  font-size: 0.8rem;
}
.points-ranking__own strong {
  margin-left: 8px;
  color: var(--ion-color-primary);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}
.points-ranking__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.points-ranking__player {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 12px 16px;
  border-top: 1px solid var(--gora-line);
  color: var(--ion-text-color);
  text-decoration: none;
  transition: background 0.15s ease;
}
.points-ranking__player:hover,
.points-ranking__player:focus-visible {
  background: color-mix(
    in srgb,
    var(--ion-color-primary) 8%,
    var(--gora-surface)
  );
}
.points-ranking__player--me {
  background: color-mix(
    in srgb,
    var(--ion-color-primary) 4%,
    var(--gora-surface)
  );
}
.points-ranking__rank {
  flex: none;
  min-width: 32px;
  color: var(--gora-muted);
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.points-ranking__rank--top {
  color: var(--ion-color-primary);
}
.points-ranking__name {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.points-ranking__name strong,
.points-ranking__name > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.points-ranking__name strong {
  font-size: 0.85rem;
}
.points-ranking__name > span {
  color: var(--gora-muted);
  font-size: 0.72rem;
}
.points-ranking__card :deep(.gora-points-badge) {
  gap: 4px;
  padding: 5px 8px;
  font-size: 0.78rem;
}
.points-ranking__more {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 12px;
  border: 0;
  border-top: 1px solid var(--gora-line);
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
}
.points-ranking__note,
.points-ranking__message {
  margin: 0;
  padding: 14px 16px;
  color: var(--gora-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}
.points-ranking__note {
  border-top: 1px solid var(--gora-line);
}
.points-ranking__loading {
  padding: 0 16px 14px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}
.points-ranking__skeleton {
  height: 48px;
  margin-top: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--gora-muted) 12%, var(--gora-surface));
}
.points-ranking__error {
  padding: 12px 16px;
  color: var(--ion-color-danger);
  font-size: 0.8rem;
}
.points-ranking__error p {
  margin: 0 0 8px;
}
.points-ranking__error button {
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid var(--gora-line);
  border-radius: 8px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
@media (max-width: 380px) {
  .points-ranking__player {
    gap: 8px;
    padding-inline: 12px;
  }
  .points-ranking__rank {
    min-width: 28px;
    font-size: 0.75rem;
  }
}
</style>
