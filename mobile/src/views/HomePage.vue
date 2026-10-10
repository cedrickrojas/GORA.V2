<template>
  <ion-page>
    <AppHeader />

    <ion-content :fullscreen="true">
      <div class="home__intro">
        <div>
          <span class="home__eyebrow">YOUR COMMUNITY</span>
          <h1>Stay in the game.</h1>
          <p>Catch up with your people. Find your next game.</p>
        </div>
        <router-link to="/profile/friends" class="home__friends-link"
          ><ion-icon :icon="peopleOutline" aria-hidden="true" /> {{ friendsStore.friends.length }}
          {{ friendsStore.friends.length === 1 ? 'friend' : 'friends' }}</router-link
        >
      </div>
      <StoryRail
        :viewer="storiesStore.viewer"
        :own="storyFeed.own"
        :others="storyFeed.others"
        :now-ms="now"
        @open="openStories"
        @add="router.push('/create/story')"
      />

      <router-link to="/create/post" class="home__composer">
        <UserAvatar v-if="postsStore.me" :user="postsStore.me" :size="38" />
        <span class="home__composer-prompt">Share a game moment…</span>
        <ion-icon :icon="imageOutline" class="home__composer-icon" aria-label="Add photos" />
      </router-link>

      <section class="home__section">
        <div class="home__feed-heading">
          <nav class="home__tabs" aria-label="Home feed">
            <button
              v-for="option in feedOptions"
              :key="option.id"
              type="button"
              :aria-pressed="scope === option.id"
              :class="{ 'home__tab--active': scope === option.id }"
              @click="scope = option.id"
            >
              {{ option.label }}
            </button>
          </nav>
          <button
            type="button"
            class="home__refresh"
            :disabled="refreshing"
            aria-label="Refresh feed"
            @click="refreshFeed"
          >
            <ion-icon :icon="refreshOutline" aria-hidden="true" :class="{ home__spinning: refreshing }" />
          </button>
        </div>
        <p class="home__feed-note">
          {{
            scope === 'FRIENDS'
              ? 'Posts from you and your mutual friends · Newest first'
              : `${filters.sport ?? 'All sports'} · Nearby games within ${nearbyRadiusKm} km`
          }}
        </p>
        <div v-if="postsStore.serverError || friendsStore.error" class="home__error" role="alert">
          <span>{{ postsStore.serverError || friendsStore.error }}</span
          ><button type="button" @click="refreshFeed">Try again</button>
        </div>
        <div v-if="feed.length === 0" class="home__empty" :aria-busy="refreshing">
          <ion-icon :icon="scope === 'FRIENDS' ? peopleOutline : newspaperOutline" aria-hidden="true" />
          <h2>
            {{
              refreshing
                ? 'Loading your feed…'
                : scope === 'FRIENDS'
                  ? 'Your circle starts here'
                  : 'You’re all caught up'
            }}
          </h2>
          <p>
            {{
              scope === 'FRIENDS'
                ? 'Once a friend request is accepted, their Public and Friends posts appear here.'
                : 'Share a game moment or try another sport to see more updates.'
            }}
          </p>
          <router-link v-if="!refreshing" :to="scope === 'FRIENDS' ? '/search' : '/create/post'">{{
            scope === 'FRIENDS' ? 'Find friends' : 'Create a post'
          }}</router-link>
        </div>
        <div class="home__stack">
          <FeedEntry
            v-for="item in feed"
            :key="item.id"
            :item="item"
            :now-ms="now"
            @like="likePost"
            @comment="commentOnPost"
            @share="sharePost"
            @join="joinGame"
          />
        </div>
        <button
          v-if="hasMore"
          type="button"
          class="home__load-more"
          :disabled="postsStore.loadingMore || refreshing"
          @click="postsStore.loadMore(scope)"
        >
          {{ postsStore.loadingMore ? 'Loading…' : 'Load more posts' }}
        </button>
      </section>

      <StoryViewer
        :is-open="viewerGroups.length > 0"
        :groups="viewerGroups"
        :start-index="viewerStartIndex"
        :now-ms="now"
        @close="closeStories"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, onIonViewWillEnter, onIonViewDidLeave } from '@ionic/vue';
import { imageOutline, peopleOutline, refreshOutline, newspaperOutline } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import FeedEntry from '@/components/feed/FeedEntry.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import StoryRail from '@/components/stories/StoryRail.vue';
import StoryViewer from '@/components/stories/StoryViewer.vue';
import { useJoinGame } from '@/composables/useJoinGame';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { useCatalogStore } from '@/stores/catalog';
import { useFiltersStore } from '@/stores/filters';
import { useFriendsStore } from '@/stores/friends';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import { useStoriesStore } from '@/stores/stories';
import type { StoryGroup } from '@/types/story';
import { getNearbyRadiusKm } from '@/utils/discover';
import { buildHomeFeed } from '@/utils/feed';

const router = useRouter();
const session = useSessionStore();
const storiesStore = useStoriesStore();
const postsStore = usePostsStore();
const gamesStore = useGamesStore();
const reelsStore = useReelsStore();
const catalog = useCatalogStore();
const filters = useFiltersStore();
const friendsStore = useFriendsStore();
const scope = ref<'ALL' | 'FRIENDS'>('ALL');
const feedOptions = [
  { id: 'ALL' as const, label: 'All updates' },
  { id: 'FRIENDS' as const, label: 'Friends' },
];
const refreshing = computed(() => postsStore.serverStatus === 'loading' || friendsStore.loading);
const hasMore = computed(() => (scope.value === 'ALL' ? !!postsStore.nextCursor : !!postsStore.friendsNextCursor));
const { joinGame } = useJoinGame();
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();

const activeFilters = computed(() => ({ maxDistanceKm: filters.maxDistanceKm, sport: filters.sport }));
const nearbyRadiusKm = computed(() => getNearbyRadiusKm(activeFilters.value));

const feed = computed(() => {
  if (scope.value === 'FRIENDS') {
    const posts = postsStore.savesToServer
      ? postsStore.friendPosts
      : postsStore.visiblePosts.filter(
          (post) => friendsStore.friendIds.has(post.author.id) || post.author.id === postsStore.me?.id,
        );
    return buildHomeFeed({ posts, games: [], reels: [], activities: [] });
  }
  return buildHomeFeed(
    {
      posts: postsStore.visiblePosts,
      games: gamesStore.games,
      reels: reelsStore.feedReels,
      activities: catalog.activities,
    },
    activeFilters.value,
  );
});

const storyFeed = computed(() => storiesStore.getFeedAt(now.value));

/** Snapshot taken on open, so expiry ticks do not reshuffle an open viewer. */
const viewerGroups = ref<StoryGroup[]>([]);
const viewerStartIndex = ref(0);

function openStories(group: StoryGroup): void {
  const groups = storyFeed.value.own ? [storyFeed.value.own, ...storyFeed.value.others] : [...storyFeed.value.others];

  viewerStartIndex.value = Math.max(
    0,
    groups.findIndex((candidate) => candidate.user.id === group.user.id),
  );
  viewerGroups.value = groups;
}

function closeStories(): void {
  viewerGroups.value = [];
}

/** Coming back to Home picks up posts and stories added or deleted since the last visit. */
async function refreshFeed(): Promise<void> {
  await friendsStore.refresh();
  await postsStore.refresh();
  if (storiesStore.isLoaded) void storiesStore.refresh();
}

let refreshTimer: ReturnType<typeof setInterval> | undefined;
function stopRefreshing(): void {
  clearInterval(refreshTimer);
  refreshTimer = undefined;
}
onIonViewWillEnter(() => {
  if (postsStore.isLoaded) void refreshFeed();
  stopRefreshing();
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshFeed();
  }, 30_000);
});
onIonViewDidLeave(stopRefreshing);
onUnmounted(stopRefreshing);

onMounted(() => {
  void session.load();
  void storiesStore.load();
  void postsStore.load();
  void gamesStore.load();
  void reelsStore.load();
  void catalog.load();
});
</script>

<style scoped>
.home__intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 16px 12px;
}
.home__eyebrow {
  color: var(--ion-color-primary);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}
.home__intro h1 {
  margin: 5px 0 6px;
  font-size: clamp(1.45rem, 3vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.04em;
}
.home__intro p {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}
.home__friends-link {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  color: var(--gora-muted);
  text-decoration: none;
  font-size: 0.75rem;
}
.home__feed-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--gora-line);
}
.home__tabs {
  display: flex;
  gap: 24px;
}
.home__tabs button {
  padding: 13px 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gora-muted);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}
.home__tabs .home__tab--active {
  color: var(--ion-color-primary);
  border-bottom-color: var(--ion-color-primary);
}
.home__refresh {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--gora-line);
  border-radius: 50%;
  background: var(--gora-surface);
  color: var(--gora-muted);
  cursor: pointer;
}
.home__feed-note {
  margin: 12px 0 16px;
  color: var(--gora-muted);
  font-size: 0.72rem;
  line-height: 1.5;
}
.home__error {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--gora-accent-line);
  border-radius: 10px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}
.home__error button {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
}
.home__empty {
  padding: 32px 20px;
  border: 1px solid var(--gora-line);
  border-radius: 14px;
  background: var(--gora-surface);
  text-align: center;
}
.home__empty > ion-icon {
  font-size: 28px;
  color: var(--ion-color-primary);
}
.home__empty h2 {
  margin: 14px 0 8px;
  color: var(--ion-text-color);
  font-size: 1.05rem;
}
.home__empty p {
  max-width: 340px;
  margin: 0 auto 18px;
  color: var(--gora-muted);
  font-size: 0.82rem;
  line-height: 1.6;
}
.home__empty a {
  display: inline-block;
  padding: 9px 16px;
  border-radius: 8px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}
.home__load-more {
  display: block;
  margin: 20px auto 0;
  padding: 10px 20px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.home__spinning {
  animation: home-spin 1s linear infinite;
}
@keyframes home-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .home__spinning {
    animation: none;
  }
}
@media (max-width: 420px) {
  .home__friends-link {
    padding: 8px;
  }
  .home__intro {
    gap: 8px;
  }
}
.home__composer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 16px 8px;
  padding: 16px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.88rem;
  text-decoration: none;
}

.home__composer-prompt {
  flex: 1;
}

.home__composer-icon {
  color: var(--ion-color-primary);
  font-size: 22px;
}

.home__section {
  padding: 8px 16px 32px;
}

.home__stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style>
