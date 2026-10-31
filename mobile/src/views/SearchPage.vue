<template>
  <ion-page>
    <AppHeader />

    <ion-content :fullscreen="true">
      <div class="search">
        <h1 class="search__title">Search</h1>
        <ion-searchbar
          v-model="query"
          class="search__bar"
          placeholder="Players, sports, games, clubs, places"
          :debounce="150"
          show-clear-button="focus"
        />

        <div
          ref="searchChips"
          class="search__chips"
          :class="{ 'search__chips--dragging': isDraggingCategories }"
          role="group"
          aria-label="Search in"
          @wheel="scrollCategoriesWithWheel"
          @pointerdown="startCategoryDrag"
          @pointermove="moveCategoryDrag"
          @pointerup="endCategoryDrag"
          @pointercancel="endCategoryDrag"
          @click.capture="preventClickAfterDrag"
        >
          <button
            v-for="option in SEARCH_CATEGORIES"
            :key="option.id"
            type="button"
            class="chip"
            :class="{ 'chip--active': category === option.id }"
            :aria-pressed="category === option.id"
            @click="category = option.id"
          >
            {{ option.label }}
          </button>
        </div>

        <section v-if="isBrowsing" class="search__section">
          <SectionHeader title="Browse all sports" />
          <div class="search__tiles">
            <SportTile
              v-for="sport in catalog.sports"
              :key="sport.id"
              :sport="sport"
              show-stats
              @select="browseSport"
            />
          </div>
        </section>

        <template v-else>
          <section
            v-if="auth.isAuthenticated && (category === 'ALL' || category === 'PLAYERS') && query.trim().length >= 2"
            class="search__section"
          >
            <SectionHeader title="GORA players" />
            <p v-if="searchingPlayers" class="search__post-time" aria-live="polite">Finding players…</p>
            <p v-else-if="playersError" class="search__post-time" role="alert">{{ playersError }}</p>
            <p v-else-if="apiPlayers.length === 0" class="search__post-time">
              No accounts found. Try their username or name.
            </p>
            <ul v-else class="search__list">
              <PlayerRow v-for="player in apiPlayers" :key="player.id" :player="player" />
            </ul>
          </section>
          <p v-if="resultCount === 0" class="search__empty">
            No results{{ query ? ` for “${query}”` : '' }} within {{ formatDistanceFilter(filters.maxDistanceKm) }}.
          </p>

          <section v-if="results.players.length" class="search__section">
            <SectionHeader title="Players" />
            <ul class="search__list">
              <PlayerRow v-for="player in results.players" :key="player.id" :player="player" />
            </ul>
          </section>

          <section v-if="results.sports.length" class="search__section">
            <SectionHeader title="Sports" />
            <div class="search__tiles">
              <SportTile
                v-for="sport in results.sports"
                :key="sport.id"
                :sport="sport"
                show-stats
                @select="browseSport"
              />
            </div>
          </section>

          <section v-if="results.games.length" class="search__section">
            <SectionHeader title="Games" />
            <div class="search__stack">
              <GameCard v-for="game in results.games" :key="game.id" :game="game" :now-ms="now" @join="joinGame" />
            </div>
          </section>

          <section v-if="results.locations.length" class="search__section">
            <SectionHeader title="Locations" />
            <ul class="search__list">
              <li v-for="location in results.locations" :key="location.id" class="search__location">
                <span class="search__location-icon">
                  <ion-icon :icon="locationOutline" aria-hidden="true" />
                </span>
                <span class="search__location-text">
                  <strong>{{ location.name }}</strong>
                  <span>{{ location.city }} · {{ location.sports.join(', ') }}</span>
                </span>
                <span class="search__location-distance">{{ formatDistanceKm(location.distanceKm) }}</span>
              </li>
            </ul>
          </section>

          <section v-if="results.posts.length" class="search__section">
            <SectionHeader title="Posts" />
            <ul class="search__list">
              <li v-for="post in results.posts" :key="post.id" class="search__post">
                <UserAvatar :user="post.author" :size="32" />
                <span>
                  <strong>{{ post.author.displayName }}</strong>
                  <span class="search__post-time">· {{ formatTimeAgo(Date.parse(post.createdAt), now) }}</span>
                  <p>{{ post.body }}</p>
                </span>
              </li>
            </ul>
          </section>

          <section v-if="results.reels.length" class="search__section">
            <SectionHeader title="Reels" />
            <div class="search__reels">
              <ReelThumb v-for="reel in results.reels" :key="reel.id" :reel="reel" />
            </div>
          </section>

          <section v-if="results.clubs.length" class="search__section">
            <SectionHeader title="Clubs" />
            <ul class="search__list">
              <ClubRow v-for="club in results.clubs" :key="club.id" :club="club" />
            </ul>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, IonSearchbar, onIonViewWillEnter } from '@ionic/vue';
import { locationOutline } from 'ionicons/icons';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PlayerRow from '@/components/discover/PlayerRow.vue';
import SportTile from '@/components/discover/SportTile.vue';
import GameCard from '@/components/games/GameCard.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ReelThumb from '@/components/reels/ReelThumb.vue';
import { useJoinGame } from '@/composables/useJoinGame';
import { useNow } from '@/composables/useNow';
import { useCatalogStore } from '@/stores/catalog';
import { useClubsStore } from '@/stores/clubs';
import { useFiltersStore } from '@/stores/filters';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useReelsStore } from '@/stores/reels';
import { useAuthStore } from '@/stores/auth';
import { searchPlayers } from '@/services/friends-api.service';
import type { PlayerSummary } from '@/types/player';
import { describeApiError } from '@/utils/api-errors';
import type { SportCategory } from '@/types/sport';
import {
  SEARCH_CATEGORIES,
  countResults,
  formatDistanceFilter,
  searchCatalog,
  type SearchCategory,
} from '@/utils/search';
import { toSportSlug } from '@/utils/sports';
import { formatDistanceKm, formatTimeAgo } from '@/utils/time';

const router = useRouter();
const auth = useAuthStore();
const apiPlayers = ref<PlayerSummary[]>([]);
const searchingPlayers = ref(false);
const playersError = ref<string | null>(null);
const catalog = useCatalogStore();
const clubsStore = useClubsStore();
const gamesStore = useGamesStore();
const postsStore = usePostsStore();
const reelsStore = useReelsStore();
const filters = useFiltersStore();
const { joinGame } = useJoinGame();
const now = useNow();

const query = ref('');
const category = ref<SearchCategory>('ALL');
const searchChips = ref<HTMLDivElement | null>(null);
const isDraggingCategories = ref(false);
let categoryDragStartX = 0;
let categoryDragScrollLeft = 0;
let categoryWasDragged = false;

watch([query, category, () => auth.accessToken], ([text, category, token], _, onCleanup) => {
  let current = true;
  apiPlayers.value = [];
  playersError.value = null;
  searchingPlayers.value = false;
  if (!token || text.trim().length < 2 || (category !== 'ALL' && category !== 'PLAYERS')) return;
  searchingPlayers.value = true;
  const timer = setTimeout(async () => {
    try {
      const players = await searchPlayers(token, text);
      if (current) apiPlayers.value = players;
    } catch (caught) {
      if (current) playersError.value = describeApiError(caught, 'Could not search players.');
    } finally {
      if (current) searchingPlayers.value = false;
    }
  }, 250);
  onCleanup(() => {
    current = false;
    clearTimeout(timer);
  });
});

const isBrowsing = computed(() => query.value.trim() === '' && category.value === 'ALL');

const results = computed(() =>
  searchCatalog(
    {
      players: auth.isAuthenticated ? [] : catalog.players,
      sports: catalog.sports,
      games: gamesStore.games,
      locations: catalog.locations,
      posts: postsStore.visiblePosts,
      reels: reelsStore.feedReels,
      clubs: clubsStore.clubs,
    },
    {
      query: query.value,
      category: category.value,
      maxDistanceKm: filters.maxDistanceKm,
      sport: filters.sport,
    },
  ),
);

const resultCount = computed(
  () => countResults(results.value) + apiPlayers.value.length + (searchingPlayers.value ? 1 : 0),
);

function scrollCategoriesWithWheel(event: WheelEvent): void {
  const element = searchChips.value;
  if (!element || element.scrollWidth <= element.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  element.scrollLeft += event.deltaY;
}

function startCategoryDrag(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || event.button !== 0 || !searchChips.value) return;
  isDraggingCategories.value = true;
  categoryWasDragged = false;
  categoryDragStartX = event.clientX;
  categoryDragScrollLeft = searchChips.value.scrollLeft;
  const button = event.target instanceof HTMLElement ? event.target.closest('button') : null;
  (button ?? searchChips.value).setPointerCapture(event.pointerId);
}

function moveCategoryDrag(event: PointerEvent): void {
  if (!isDraggingCategories.value || !searchChips.value) return;
  const delta = event.clientX - categoryDragStartX;
  if (Math.abs(delta) > 4) categoryWasDragged = true;
  if (categoryWasDragged) {
    event.preventDefault();
    searchChips.value.scrollLeft = categoryDragScrollLeft - delta;
  }
}

function endCategoryDrag(): void {
  if (!isDraggingCategories.value) return;
  isDraggingCategories.value = false;
  if (categoryWasDragged) window.setTimeout(() => { categoryWasDragged = false; }, 0);
}

function preventClickAfterDrag(event: MouseEvent): void {
  if (!categoryWasDragged) return;
  event.preventDefault();
  event.stopPropagation();
  categoryWasDragged = false;
}

function browseSport(sport: SportCategory): void {
  void router.push(`/search/${toSportSlug(sport.name)}`);
}

onMounted(() => {
  void catalog.load();
  void clubsStore.load();
  void gamesStore.load();
  void postsStore.load();
  void reelsStore.load();
});

onIonViewWillEnter(() => {
  if (catalog.isLoaded) void catalog.refreshSports();
});
</script>

<style scoped>
.search {
  padding: 8px 16px 32px;
}

.search__title {
  margin: 4px 0 8px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.search__bar {
  --background: #f5f7f2;
  --color: #08131f;
  --icon-color: #08131f;
  --placeholder-color: #4a5560;
  --border-radius: 10px;
  padding: 0;
}

.search__chips {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  overflow-x: auto;
  padding: 2px 0 7px;
  cursor: grab;
  scrollbar-color: var(--gora-muted) transparent;
  scrollbar-width: thin;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.search__chips::-webkit-scrollbar {
  height: 6px;
}

.search__chips::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--gora-muted);
}

.search__chips--dragging {
  cursor: grabbing;
  user-select: none;
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

@media (max-width: 640px) {
  .search__chips {
    scrollbar-width: none;
  }

  .search__chips::-webkit-scrollbar {
    display: none;
  }
}

.search__section {
  margin-top: 24px;
}

.search__tiles {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.search__stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search__reels {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.search__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.search__empty {
  margin: 32px 0;
  color: var(--gora-muted);
  text-align: center;
}

.search__location,
.search__post {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.search__post {
  align-items: flex-start;
  font-size: 0.85rem;
}

.search__post p {
  margin: 4px 0 0;
  color: var(--gora-muted);
}

.search__post-time {
  color: #7d8a93;
  font-size: 0.75rem;
}

.search__location-icon {
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

.search__location-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  font-size: 0.9rem;
}

.search__location-text span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.search__location-distance {
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}
</style>
