<template>
  <ion-page>
    <AppHeader :title="sportName" back-href="/search" />

    <ion-content :fullscreen="true">
      <p v-if="catalog.isLoaded && !sport" class="sport__missing">This sport is not on GORA yet.</p>

      <div v-else-if="sport" class="sport">
        <header class="sport__hero">
          <img :src="sportImage" alt="" class="sport__hero-image" decoding="async" />
          <h1 class="sport__name">{{ sport.name }}</h1>
          <p class="sport__stats">
            {{ formatCompactNumber(sport.activePlayers) }} active players · {{ sport.openGames }} open games
          </p>
        </header>

        <ion-searchbar
          v-model="query"
          class="sport__search"
          :placeholder="`Search in ${sport.name}`"
          :debounce="150"
          show-clear-button="focus"
        />

        <p v-if="isSearching && resultCount === 0" class="sport__empty">
          Nothing in {{ sport.name }} matches “{{ query.trim() }}”.
        </p>

        <section v-if="!isSearching || games.length" class="sport__section">
          <SectionHeader title="Games">
            <span class="sport__meta">{{ games.length }} {{ games.length === 1 ? 'game' : 'games' }} · {{ distanceLabel }}</span>
          </SectionHeader>

          <div class="sport__chips" role="group" aria-label="Date">
            <button
              v-for="option in DISCOVERY_DATES"
              :key="option.id"
              type="button"
              class="chip"
              :class="{ 'chip--active': date === option.id }"
              :aria-pressed="date === option.id"
              @click="date = option.id"
            >
              {{ option.label }}
            </button>
          </div>

          <SegmentTabs v-model="view" :options="VIEW_OPTIONS" class="sport__views" />

          <div v-if="view === 'MAP'" class="sport__map">
            <p class="sport__map-markers" aria-hidden="true">{{ marker }}</p>
            <strong>{{ sport.name }} games on the GORA map</strong>
            <span>
              The map shows real {{ sport.name.toLowerCase() }} games created on GORA, filtered by date and distance.
            </span>
            <button type="button" class="sport__map-list" @click="openDiscoveryMap">Open the {{ sport.name }} map</button>
          </div>

          <template v-else>
            <p v-if="games.length === 0" class="sport__empty">
              No {{ date === 'ALL' ? 'upcoming ' : '' }}{{ sport.name.toLowerCase() }} games
              {{ date === 'ALL' ? '' : `${dateLabel.toLowerCase()} ` }}{{ distanceLabel.toLowerCase() }}.
            </p>
            <div v-else class="sport__stack">
              <GameCard v-for="game in games" :key="game.id" :game="game" :now-ms="now" @join="joinGame" />
            </div>
          </template>
        </section>

        <section v-if="players.length" class="sport__section">
          <SectionHeader title="Players" />
          <ul class="sport__list">
            <PlayerRow v-for="player in players" :key="player.id" :player="player" />
          </ul>
        </section>

        <section v-if="clubs.length" class="sport__section">
          <SectionHeader title="Clubs" />
          <ul class="sport__list">
            <ClubRow v-for="club in clubs" :key="club.id" :club="club" />
          </ul>
        </section>

        <section v-if="reels.length" class="sport__section">
          <SectionHeader title="Reels" />
          <div class="sport__reels">
            <ReelThumb v-for="reel in reels" :key="reel.id" :reel="reel" />
          </div>
        </section>

        <section v-if="locations.length" class="sport__section">
          <SectionHeader title="Locations" />
          <ul class="sport__list">
            <li v-for="location in locations" :key="location.id" class="sport__location">
              <span class="sport__location-icon">
                <ion-icon :icon="locationOutline" aria-hidden="true" />
              </span>
              <span class="sport__location-text">
                <strong>{{ location.name }}</strong>
                <span>{{ location.city }}</span>
              </span>
              <span class="sport__location-distance">{{ formatDistanceKm(location.distanceKm) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="!isSearching || posts.length" class="sport__section">
          <SectionHeader title="Posts">
            <span class="sport__meta">{{ posts.length }} {{ posts.length === 1 ? 'post' : 'posts' }}</span>
          </SectionHeader>
          <p v-if="posts.length === 0" class="sport__empty">
            No {{ sport.name.toLowerCase() }} posts yet.
            <router-link to="/create/post">Share the first one</router-link>
          </p>
          <div v-else class="sport__stack">
            <PostCard
              v-for="post in posts"
              :key="post.id"
              :post="post"
              :now-ms="now"
              @like="likePost"
              @comment="commentOnPost"
              @share="sharePost"
            />
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, IonSearchbar } from '@ionic/vue';
import { locationOutline } from 'ionicons/icons';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import PlayerRow from '@/components/discover/PlayerRow.vue';
import PostCard from '@/components/feed/PostCard.vue';
import GameCard from '@/components/games/GameCard.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ReelThumb from '@/components/reels/ReelThumb.vue';
import { useJoinGame } from '@/composables/useJoinGame';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { useCatalogStore } from '@/stores/catalog';
import { useClubsStore } from '@/stores/clubs';
import { useFiltersStore } from '@/stores/filters';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useReelsStore } from '@/stores/reels';
import { rankPopularClubs } from '@/utils/clubs';
import { isWithinDistance, matchesSport } from '@/utils/filters';
import { DISCOVERY_DATES, selectSportDiscoveryGames, type DiscoveryDate } from '@/utils/map-discovery';
import { formatDistanceFilter, matchesSearchQuery } from '@/utils/search';
import { getSportImage, getSportMarker, toSportSlug } from '@/utils/sports';
import { formatCompactNumber, formatDistanceKm } from '@/utils/time';

type SportView = 'MAP' | 'LIST';

const VIEW_OPTIONS: readonly { id: SportView; label: string }[] = [
  { id: 'MAP', label: 'Map' },
  { id: 'LIST', label: 'List' },
];

const route = useRoute();
const router = useRouter();
/** Fixed per page instance; Ionic keeps earlier sport pages cached while the route changes. */
const pageSlug = String(route.params.sport ?? '');
const catalog = useCatalogStore();
const clubsStore = useClubsStore();
const gamesStore = useGamesStore();
const postsStore = usePostsStore();
const reelsStore = useReelsStore();
const filters = useFiltersStore();
const { joinGame } = useJoinGame();
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();

const date = ref<DiscoveryDate>('ALL');
const view = ref<SportView>('LIST');
const query = ref('');
const isSearching = computed(() => query.value.trim().length > 0);
const matches = (...fields: string[]): boolean => matchesSearchQuery(query.value, ...fields);

const sport = computed(() => catalog.sports.find((candidate) => toSportSlug(candidate.name) === pageSlug));

// Picking another sport in the header filter opens that sport's section.
watch(
  () => filters.sport,
  (selected) => {
    if (selected && route.params.sport === pageSlug && toSportSlug(selected) !== pageSlug) {
      void router.replace(`/search/${toSportSlug(selected)}`);
    }
  },
);
const sportName = computed(() => sport.value?.name ?? 'Sport');
const sportImage = computed(() => getSportImage(sportName.value));
const marker = computed(() => getSportMarker(sportName.value));

const dateLabel = computed(() => DISCOVERY_DATES.find((option) => option.id === date.value)?.label ?? '');

/** Search -> sport -> date -> Discover's map of real games, with this sport and date. */
function openDiscoveryMap(): void {
  const params = new URLSearchParams({ sport: sportName.value, date: date.value, view: 'map' });
  void router.push(`/discover?${params.toString()}`);
}
const distanceLabel = computed(() =>
  filters.maxDistanceKm === null ? 'Any distance' : `Within ${formatDistanceFilter(filters.maxDistanceKm)}`,
);

const games = computed(() =>
  selectSportDiscoveryGames(
    gamesStore.games,
    { sport: sportName.value, date: date.value, maxDistanceKm: filters.maxDistanceKm },
    now.value,
  ).filter((game) =>
    matches(game.title, game.description ?? '', game.location.name, game.location.city, game.host.displayName),
  ),
);

const players = computed(() =>
  catalog.players.filter(
    (player) =>
      matchesSport(player.primarySport, sportName.value) &&
      isWithinDistance(player.distanceKm, filters.maxDistanceKm) &&
      matches(player.displayName, player.username, player.city),
  ),
);
const clubs = computed(() =>
  rankPopularClubs(clubsStore.clubs, { sport: sportName.value, maxDistanceKm: filters.maxDistanceKm }, 10).filter(
    (club) => matches(club.name, club.slug, club.city ?? '', club.locationName ?? ''),
  ),
);
const reels = computed(() =>
  reelsStore.feedReels.filter(
    (reel) =>
      matchesSport(reel.sport, sportName.value) &&
      matches(reel.caption, reel.author.displayName, reel.locationName),
  ),
);
/** Every post about the sport the viewer may see, newest first; no date narrowing. */
const posts = computed(() =>
  postsStore.visiblePosts
    .filter(
      (post) =>
        matchesSport(post.sport, sportName.value) &&
        matches(post.body, post.author.displayName, post.location?.name ?? ''),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
);
const locations = computed(() =>
  catalog.locations.filter(
    (location) =>
      matchesSport(location.sports, sportName.value) &&
      isWithinDistance(location.distanceKm, filters.maxDistanceKm) &&
      matches(location.name, location.city),
  ),
);
const resultCount = computed(
  () =>
    games.value.length +
    players.value.length +
    clubs.value.length +
    reels.value.length +
    posts.value.length +
    locations.value.length,
);

onMounted(() => {
  void catalog.load();
  void clubsStore.load();
  void gamesStore.load();
  void postsStore.load();
  void reelsStore.load();
});
</script>

<style scoped>
.sport {
  padding: 8px 16px 32px;
}

.sport__missing {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.sport__hero {
  position: relative;
  display: flex;
  min-height: 200px;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  padding: 20px 18px;
  border-radius: 18px;
  background: var(--gora-surface-raised);
}

.sport__hero::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.85));
  content: '';
}

.sport__hero-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 35%;
}

.sport__name,
.sport__stats {
  position: relative;
  z-index: 1;
}

.sport__name {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 800;
}

.sport__stats {
  margin: 6px 0 0;
  color: rgba(245, 247, 242, 0.8);
  font-size: 0.8rem;
}

.sport__search {
  --background: #f5f7f2;
  --color: #08131f;
  --icon-color: #08131f;
  --placeholder-color: #4a5560;
  --border-radius: 10px;
  margin-top: 14px;
  padding: 0;
}

.sport__section {
  margin-top: 24px;
}

.sport__meta {
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.sport__chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.chip {
  flex-shrink: 0;
  padding: 7px 14px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}

.chip--active {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.sport__views {
  margin: 12px 0;
}

.sport__map {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
  text-align: center;
}

.sport__map-markers {
  margin: 0 0 6px;
  font-size: 28px;
  letter-spacing: 6px;
}

.sport__map span {
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.sport__map-list {
  margin-top: 10px;
  padding: 7px 16px;
  border: 1px solid var(--ion-color-primary);
  border-radius: 10px;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}

.sport__empty {
  margin: 20px 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
  text-align: center;
}

.sport__empty a {
  color: var(--ion-color-primary);
}

.sport__stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sport__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.sport__reels {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sport__location {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.sport__location-icon {
  display: flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  font-size: 20px;
}

.sport__location-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  font-size: 0.9rem;
}

.sport__location-text span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.sport__location-distance {
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}
</style>
