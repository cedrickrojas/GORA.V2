<template>
  <PostCard
    v-if="item.type === 'POST'"
    :post="item.post"
    :now-ms="nowMs"
    @like="emit('like', $event)"
    @comment="emit('comment', $event)"
    @share="emit('share', $event)"
  />

  <article v-else-if="item.type === 'GAME'" class="feed-entry">
    <header class="feed-entry__header">
      <UserAvatar :user="item.game.host" :size="38" />
      <span class="feed-entry__meta">
        <strong>{{ item.game.host.displayName }}</strong>
        <span>posted a game · {{ formatTimeAgo(item.at, nowMs) }}</span>
      </span>
    </header>
    <p v-if="item.game.description" class="feed-entry__text">{{ item.game.description }}</p>
    <GameCard :game="item.game" :now-ms="nowMs" @join="emit('join', $event)" />
  </article>

  <article v-else-if="item.type === 'SERVER_GAME'" class="feed-entry">
    <header class="feed-entry__header">
      <UserAvatar :user="gameHostSummary(item.game)" :size="38" />
      <span class="feed-entry__meta">
        <strong>{{ item.game.host.displayName }}</strong>
        <span>posted a game · {{ formatTimeAgo(item.at, nowMs) }}</span>
      </span>
    </header>
    <p v-if="item.game.description" class="feed-entry__text">{{ item.game.description }}</p>
    <ServerGameFeedCard :game="item.game" />
  </article>

  <article v-else-if="item.type === 'REEL'" class="feed-entry">
    <header class="feed-entry__header">
      <UserAvatar :user="item.reel.author" :size="38" />
      <span class="feed-entry__meta">
        <strong>{{ item.reel.author.displayName }}</strong>
        <span>shared a reel · {{ formatTimeAgo(item.at, nowMs) }}</span>
      </span>
    </header>
    <router-link to="/reels" class="feed-entry__reel">
      <span class="feed-entry__reel-thumb" :style="{ background: getSportVisual(item.reel.sport).gradient }">
        <ion-icon :icon="playCircle" aria-hidden="true" />
        <span>{{ formatDuration(item.reel.durationSeconds) }}</span>
      </span>
      <span class="feed-entry__reel-info">
        <strong>{{ item.reel.caption }}</strong>
        <span>{{ item.reel.sport }} · {{ item.reel.locationName }}</span>
        <span>
          <ion-icon :icon="eyeOutline" aria-hidden="true" />
          {{ formatCompactNumber(item.reel.views) }} views
        </span>
      </span>
    </router-link>
  </article>

  <article v-else-if="item.type === 'CLUB'" class="feed-entry">
    <header class="feed-entry__header">
      <UserAvatar :user="item.club.owner" :size="38" />
      <span class="feed-entry__meta">
        <strong>{{ item.club.owner.displayName }}</strong>
        <span>created a club · {{ formatTimeAgo(item.at, nowMs) }}</span>
      </span>
    </header>
    <ul class="feed-entry__club-list"><ClubRow :club="item.club" /></ul>
  </article>

  <article v-else class="feed-entry feed-entry--activity">
    <span class="feed-entry__activity-icon" aria-hidden="true">
      <ion-icon :icon="ACTIVITY_ICONS[item.activity.kind]" />
    </span>
    <p class="feed-entry__activity-text">
      <span><strong>{{ item.activity.actor.displayName }}</strong> {{ item.activity.summary }}</span>
      <span class="feed-entry__activity-meta">{{ item.activity.sport }} · {{ formatTimeAgo(item.at, nowMs) }}</span>
    </p>
  </article>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { enterOutline, eyeOutline, playCircle, ribbonOutline, trophyOutline } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import GameCard from '@/components/games/GameCard.vue';
import ServerGameFeedCard from './ServerGameFeedCard.vue';
import ClubRow from '@/components/clubs/ClubRow.vue';
import PostCard from './PostCard.vue';
import type { FeedActivityKind, HomeFeedItem } from '@/types/feed';
import type { Game } from '@/types/game';
import type { FeedPost } from '@/types/post';
import { getSportVisual } from '@/utils/sports';
import { gameHostSummary } from '@/utils/game-form';
import { formatCompactNumber, formatDuration, formatTimeAgo } from '@/utils/time';

const ACTIVITY_ICONS: Record<FeedActivityKind, string> = {
  GAME_COMPLETED: trophyOutline,
  BADGE_UNLOCKED: ribbonOutline,
  GAME_JOINED: enterOutline,
};

defineProps<{ item: HomeFeedItem; nowMs: number }>();
const emit = defineEmits<{
  like: [post: FeedPost];
  comment: [post: FeedPost];
  share: [post: FeedPost];
  join: [game: Game];
}>();
</script>

<style scoped>
.feed-entry {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-entry__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feed-entry__meta {
  display: flex;
  flex-direction: column;
  font-size: 0.88rem;
}

.feed-entry__meta span {
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.feed-entry__text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
}

.feed-entry__club-list {
  margin: 0;
  padding: 0;
}

.feed-entry__reel {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--gora-line);
  border-radius: 18px;
  background: var(--gora-surface);
  color: inherit;
  text-decoration: none;
}

.feed-entry__reel-thumb {
  position: relative;
  display: flex;
  width: 84px;
  flex-shrink: 0;
  aspect-ratio: 9 / 14;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 30px;
}

.feed-entry__reel-thumb span {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  font-size: 0.62rem;
  font-weight: 700;
}

.feed-entry__reel-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  font-size: 0.8rem;
}

.feed-entry__reel-info strong {
  font-size: 0.9rem;
  line-height: 1.35;
}

.feed-entry__reel-info span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.feed-entry--activity {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--gora-line-strong);
  border-radius: 16px;
}

.feed-entry__activity-icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: 18px;
}

.feed-entry__activity-text {
  display: flex;
  flex-direction: column;
  margin: 0;
  font-size: 0.85rem;
}

.feed-entry__activity-meta {
  color: var(--gora-muted);
  font-size: 0.72rem;
}
</style>
