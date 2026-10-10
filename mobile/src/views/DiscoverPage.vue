<template>
  <ion-page>
    <AppHeader />

    <ion-content :fullscreen="true">
      <div class="discover">
        <h1 class="discover__title">Discover</h1>
        <p v-if="filters.isActive" class="discover__filters">
          Showing {{ filters.sport ?? 'all sports' }} within {{ formatDistanceFilter(filters.maxDistanceKm) }}
          <button type="button" @click="filters.reset()">Clear</button>
        </p>

        <div class="discover__tabs">
          <SegmentTabs v-model="tab" :options="DISCOVER_TABS" aria-label="Discover feed" />
        </div>

        <template v-if="tab === 'FRIENDS'">
          <p class="discover__intro">Posts, games, reels, and activity from your friends and the people you follow.</p>
          <p v-if="friendsFeed.length === 0" class="discover__empty">
            Nothing from friends matches your filters yet. Add friends or follow players to fill this feed.
          </p>
          <div class="discover__feed">
            <FeedEntry
              v-for="item in friendsFeed"
              :key="item.id"
              :item="item"
              :now-ms="now"
              @like="likePost"
              @comment="commentOnPost"
              @share="sharePost"
              @join="joinGame"
            />
          </div>
        </template>

        <template v-else-if="tab === 'CLUBS'">
          <section class="discover__section">
            <SectionHeader title="Your clubs">
              <router-link to="/profile/clubs" class="discover__accent discover__link">My Clubs</router-link>
            </SectionHeader>
            <p v-if="feedClubs.length === 0" class="discover__empty">
              Join or follow a club to see its announcements, games, and reels here.
            </p>
            <ul class="discover__rail discover__club-rail">
              <li v-for="club in feedClubs" :key="club.id">
                <router-link :to="`/clubs/${club.id}`" class="discover__club-chip">
                  <ClubAvatar :club="club" :image-url="club.profileImageUrl" :size="52" />
                  <span>{{ club.name }}</span>
                </router-link>
              </li>
            </ul>
          </section>
          <p v-if="feedClubs.length > 0 && clubsFeed.length === 0" class="discover__empty">
            Your clubs have nothing that matches your filters.
          </p>
          <div class="discover__feed">
            <FeedEntry
              v-for="item in clubsFeed"
              :key="item.id"
              :item="item"
              :now-ms="now"
              @like="likePost"
              @comment="commentOnPost"
              @share="sharePost"
              @join="joinGame"
            />
          </div>
        </template>

        <template v-else>
          <section class="discover__section">
            <SectionHeader title="Popular Players" />
            <ul class="discover__rail">
              <li v-for="player in feed.popularPlayers" :key="player.id" class="discover__player">
                <router-link :to="`/profile/${player.username}`" class="discover__profile-link">
                  <UserAvatar :user="player" :size="64" />
                  <strong>{{ player.displayName }}</strong>
                </router-link>
                <span>{{ player.primarySport }}</span>
                <span class="discover__accent">{{ formatCompactNumber(player.followers) }} followers</span>
              </li>
            </ul>
          </section>

          <section class="discover__section">
            <SectionHeader title="Trending Sports" />
            <div class="discover__grid">
              <SportTile
                v-for="sport in feed.trendingSports"
                :key="sport.id"
                :sport="sport"
                show-stats
                @select="openSportSearch"
              />
            </div>
          </section>

          <section class="discover__section">
            <SectionHeader title="Popular Games" />
            <div class="discover__rail discover__rail--cards">
              <GameCard
                v-for="game in feed.popularGames"
                :key="game.id"
                :game="game"
                :now-ms="now"
                class="discover__game"
                @join="joinGame"
              />
            </div>
          </section>

          <section class="discover__section">
            <SectionHeader title="Trending Reels" />
            <div class="discover__rail discover__rail--reels">
              <ReelThumb v-for="reel in feed.trendingReels" :key="reel.id" :reel="reel" class="discover__reel" />
            </div>
          </section>

          <NearbyGamesSection />


          <section class="discover__section">
            <SectionHeader title="Featured Athletes" />
            <ul class="discover__stack discover__featured-list">
              <li
                v-for="athlete in feed.featuredAthletes"
                :key="athlete.id"
                class="discover__featured"
                :style="{ background: getSportVisual(athlete.primarySport).gradient }"
              >
                <UserAvatar :user="athlete" :size="56" />
                <span class="discover__featured-text">
                  <router-link :to="`/profile/${athlete.username}`" class="discover__profile-link">
                    <strong>{{ athlete.displayName }}</strong>
                  </router-link>
                  <span>{{ athlete.primarySport }} · {{ athlete.city }}</span>
                  <span>{{ athlete.gamesCompleted }} games completed · {{ formatCompactNumber(athlete.followers) }} followers</span>
                </span>
                <ion-icon :icon="star" class="discover__featured-star" aria-label="Featured" />
              </li>
            </ul>
          </section>

          <section class="discover__section">
            <SectionHeader title="Popular Clubs" />
            <p v-if="feed.popularClubs.length === 0" class="discover__empty">No clubs match your filters.</p>
            <ul class="discover__stack discover__club-list">
              <ClubRow v-for="club in feed.popularClubs" :key="club.id" :club="club" />
            </ul>
          </section>

          <section class="discover__section">
            <SectionHeader title="Public Posts" />
            <div class="discover__stack">
              <PostCard
                v-for="post in feed.publicPosts"
                :key="post.id"
                :post="post"
                :now-ms="now"
                @like="likePost"
                @comment="commentOnPost"
                @share="sharePost"
              />
            </div>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage } from '@ionic/vue';
import { star } from 'ionicons/icons';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import NearbyGamesSection from '@/components/discover/NearbyGamesSection.vue';
import SportTile from '@/components/discover/SportTile.vue';
import FeedEntry from '@/components/feed/FeedEntry.vue';
import PostCard from '@/components/feed/PostCard.vue';
import GameCard from '@/components/games/GameCard.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ReelThumb from '@/components/reels/ReelThumb.vue';
import { useJoinGame } from '@/composables/useJoinGame';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { useCatalogStore } from '@/stores/catalog';
import { useClubsStore } from '@/stores/clubs';
import { useDiscoveryStore } from '@/stores/discovery';
import { useFiltersStore } from '@/stores/filters';
import { useFollowsStore } from '@/stores/follows';
import { useFriendsStore } from '@/stores/friends';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import type { DiscoveryDateFilter } from '@/types/discovery';
import type { SportCategory } from '@/types/sport';
import { DISCOVER_TABS, type DiscoverTab, buildDiscoverFeed } from '@/utils/discover';
import { buildClubsFeed, buildFriendsFeed, type HomeFeedSources } from '@/utils/feed';
import { formatDistanceFilter } from '@/utils/search';
import { getSportVisual, toSportSlug } from '@/utils/sports';
import { formatCompactNumber } from '@/utils/time';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();
const discovery = useDiscoveryStore();
const catalog = useCatalogStore();
const gamesStore = useGamesStore();
const reelsStore = useReelsStore();
const postsStore = usePostsStore();
const clubsStore = useClubsStore();
const friendsStore = useFriendsStore();
const followsStore = useFollowsStore();
const filters = useFiltersStore();
const { joinGame } = useJoinGame();
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();

const tab = ref<DiscoverTab>('ALL');

const activeFilters = computed(() => ({ maxDistanceKm: filters.maxDistanceKm, sport: filters.sport }));

const HANDOFF_DATES: readonly DiscoveryDateFilter[] = ['ALL', 'TODAY', 'TOMORROW', 'THIS_WEEK'];

/** Search -> sport -> "Open the map" arrives as /discover?sport=Volleyball&date=TODAY&view=map. */
function applyRouteHandoff(): void {
  const sport = typeof route.query.sport === 'string' ? route.query.sport : null;
  const date = HANDOFF_DATES.find((option) => option === route.query.date) ?? null;

  if (route.path !== '/discover' || (!sport && !date && !route.query.view)) {
    return;
  }

  tab.value = 'ALL';

  if (sport) {
    filters.sport = sport;
  }

  if (date) {
    discovery.selectedDate = date;
    discovery.customDate = null;
  }

  discovery.setViewMode(route.query.view === 'list' ? 'LIST' : 'MAP');
  void router.replace('/discover');
  void discovery.fetchNearbyGames();
}

watch(() => route.fullPath, applyRouteHandoff, { immediate: true });

const feed = computed(() =>
  buildDiscoverFeed(
    {
      players: catalog.players,
      sports: catalog.sports,
      games: gamesStore.games,
      reels: reelsStore.feedReels,
      clubs: clubsStore.clubs,
      posts: postsStore.visiblePosts,
    },
    activeFilters.value,
  ),
);

const sources = computed<HomeFeedSources>(() => ({
  posts: postsStore.visiblePosts,
  games: gamesStore.games,
  reels: reelsStore.feedReels,
  activities: catalog.activities,
}));

/** Accepted friends plus followed accounts; the two relationships stay separate. */
const circleIds = computed(() => {
  const ids = new Set([...friendsStore.friends.map((friend) => friend.id), ...followsStore.followingIds]);

  if (session.me) {
    ids.delete(session.me.id);
  }

  return [...ids];
});

const friendsFeed = computed(() => buildFriendsFeed(sources.value, circleIds.value, activeFilters.value));
const feedClubs = computed(() =>
  clubsStore.clubs.filter((club) => clubsStore.feedClubIds.includes(club.id)),
);
const clubsFeed = computed(() => buildClubsFeed(sources.value, clubsStore.feedClubIds, activeFilters.value));

function openSportSearch(sport: SportCategory): void {
  void router.push(`/search/${toSportSlug(sport.name)}`);
}

onMounted(() => {
  void session.load();
  void catalog.load();
  void gamesStore.load();
  void reelsStore.load();
  void postsStore.load();
  void clubsStore.load();
  void friendsStore.load();
  void followsStore.load();
});
</script>

<style scoped>
.discover {
  padding: 8px 16px 32px;
}

.discover__title {
  margin: 4px 0 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.discover__section {
  margin-top: 24px;
}

.discover__tabs {
  margin-top: 14px;
}

.discover__intro {
  margin: 14px 0 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.discover__feed {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 16px;
}

.discover__link {
  text-decoration: none;
}

.discover__club-rail {
  margin-top: 0;
}

.discover__club-chip {
  display: flex;
  width: 88px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--ion-text-color);
  font-size: 0.7rem;
  text-align: center;
  text-decoration: none;
}

.discover__club-chip span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.discover__club-list {
  margin: 0;
  padding: 0;
}

.discover__filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.discover__filters button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.discover__empty {
  margin: 0;
  color: #7d8a93;
  font-size: 0.85rem;
}

.discover__accent {
  color: var(--ion-color-primary);
  font-size: 0.72rem;
  font-weight: 600;
}

.discover__rail {
  display: flex;
  gap: 12px;
  margin: 0 -16px;
  padding: 0 16px 4px;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: none;
}

.discover__profile-link {
  display: contents;
  color: inherit;
  text-decoration: none;
}

.discover__player {
  display: flex;
  width: 104px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 8px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  text-align: center;
}

.discover__player strong {
  margin-top: 8px;
  overflow: hidden;
  max-width: 100%;
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover__player span {
  color: var(--gora-muted);
  font-size: 0.7rem;
}

.discover__grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.discover__game {
  width: 280px;
  flex-shrink: 0;
}

.discover__reel {
  width: 120px;
  flex-shrink: 0;
}

.discover__stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discover__featured-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.discover__featured {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: var(--gora-radius-card);
}

.discover__featured-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.discover__featured-text strong {
  font-size: 1rem;
}

.discover__featured-text span {
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.75rem;
}

.discover__featured-star {
  position: absolute;
  top: 12px;
  right: 12px;
  color: var(--ion-color-primary);
  font-size: 18px;
}
</style>
