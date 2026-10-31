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

        <section v-if="!isSearching || visibleGameCount > 0 || mapLoading" class="sport__section">
          <SectionHeader title="Games">
            <span class="sport__meta">{{ visibleGameCount }} {{ visibleGameCount === 1 ? 'game' : 'games' }} · {{ distanceLabel }}</span>
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

          <GameDiscoveryMap
            v-if="view === 'MAP'"
            :games="sportMapGames"
            :center="discovery.userLocation"
            :radius-km="discovery.userLocation ? filters.maxDistanceKm : null"
            :selected-game-id="selectedMapGameId"
            :loading="mapLoading"
            :error="mapError"
            :user-location="discovery.userLocation"
            :fit-markers="true"
            :busy-game-id="busyGameId"
            :join-action-of="joinActionOf"
            @select="selectedMapGameId = $event"
            @join="openJoin"
          />

          <template v-else>
            <p v-if="mapLoading" class="sport__empty">Loading games…</p>
            <p v-else-if="mapError" class="sport__empty" role="alert">{{ mapError }}</p>
            <p v-else-if="games.length === 0" class="sport__empty">
              No {{ date === 'ALL' ? 'upcoming ' : '' }}{{ sport.name.toLowerCase() }} games
              {{ date === 'ALL' ? '' : `${dateLabel.toLowerCase()} ` }}{{ distanceLabel.toLowerCase() }}.
            </p>
            <div v-else class="sport__stack">
              <DiscoveredGameCard
                v-for="game in games"
                :key="game.id"
                :game="game"
                :join-action="joinActionOf(game)"
                :busy="busyGameId === game.id"
                @join="openJoin"
              />
            </div>
          </template>
        </section>

        <section v-if="players.length" class="sport__section">
          <SectionHeader title="Players" />
          <ul class="sport__list">
            <PlayerRow v-for="player in players" :key="player.id" :player="player" />
          </ul>
        </section>

        <section v-if="reels.length" class="sport__section">
          <SectionHeader title="Reels" />
          <div class="sport__reels">
            <ReelThumb v-for="reel in reels" :key="reel.id" :reel="reel" />
          </div>
        </section>

        <section v-if="!isSearching || clubs.length" class="sport__section">
          <SectionHeader title="Available Clubs">
            <span class="sport__meta">{{ clubs.length }} {{ clubs.length === 1 ? 'club' : 'clubs' }}</span>
          </SectionHeader>
          <p v-if="clubs.length === 0" class="sport__empty">No available {{ sport.name.toLowerCase() }} clubs yet.</p>
          <ul class="sport__list">
            <ClubRow v-for="club in clubs" :key="club.id" :club="club" />
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonPage, IonSearchbar, onIonViewWillEnter } from '@ionic/vue';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import JoinRequestModal from '@/components/games/JoinRequestModal.vue';
import DiscoveredGameCard from '@/components/map/DiscoveredGameCard.vue';
import PlayerRow from '@/components/discover/PlayerRow.vue';
import PostCard from '@/components/feed/PostCard.vue';
import GameDiscoveryMap from '@/components/map/GameDiscoveryMap.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ReelThumb from '@/components/reels/ReelThumb.vue';
import { useDiscoveryJoin } from '@/composables/useDiscoveryJoin';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { useCatalogStore } from '@/stores/catalog';
import { useClubsStore } from '@/stores/clubs';
import { useAuthStore } from '@/stores/auth';
import { useDiscoveryStore } from '@/stores/discovery';
import { useFiltersStore } from '@/stores/filters';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useReelsStore } from '@/stores/reels';
import { useSportsStore } from '@/stores/sports';
import { discoverGames } from '@/services/games-api.service';
import { createAuthorizedCall } from '@/stores/authorized';
import type { DiscoveredGame } from '@/types/discovery';
import { describeApiError } from '@/utils/api-errors';
import { getClubJoinState } from '@/utils/clubs';
import { isWithinDistance, matchesSport } from '@/utils/filters';
import { DISCOVERY_DATES, buildDiscoveryQuery, type DiscoveryDate } from '@/utils/map-discovery';
import { formatDistanceFilter, matchesSearchQuery } from '@/utils/search';
import { getSportImage, toSportSlug } from '@/utils/sports';
import { formatCompactNumber } from '@/utils/time';

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
const sportsStore = useSportsStore();
const auth = useAuthStore();
const discovery = useDiscoveryStore();
const authorized = createAuthorizedCall(auth);
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();

const date = ref<DiscoveryDate>('ALL');
const view = ref<SportView>('MAP');
const query = ref('');
const mapGames = ref<DiscoveredGame[]>([]);
const mapLoading = ref(false);
const mapError = ref<string | null>(null);
const selectedMapGameId = ref<string | null>(null);
let mapRequest = 0;
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

const dateLabel = computed(() => DISCOVERY_DATES.find((option) => option.id === date.value)?.label ?? '');

const sportMapGames = computed(() => mapGames.value.filter((game) =>
  matches(game.title, game.locationName, game.host.displayName),
));
const visibleGameCount = computed(() => sportMapGames.value.length);
const distanceLabel = computed(() =>
  filters.maxDistanceKm === null ? 'Any distance' : `Within ${formatDistanceFilter(filters.maxDistanceKm)}`,
);

const { joiningGame, joinError, busyGameId, joinActionOf, openJoin, closeJoin, sendJoin } = useDiscoveryJoin(
  sportMapGames,
  (gameId, status, updatedGame) => {
    mapGames.value = mapGames.value.map((game) => game.id === gameId ? {
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

async function refreshSportMap(): Promise<void> {
  const selected = sport.value;
  if (!selected) return;
  const request = ++mapRequest;
  mapLoading.value = true;
  mapError.value = null;
  try {
    const result = await catalog.refreshSports();
    if (request !== mapRequest) return;
    if (!result.ok) {
      mapGames.value = [];
      mapError.value = result.message;
      return;
    }

    // The search catalog uses demo ids such as "sport-badminton". The games API
    // requires the UUID from GET /sports, so resolve the selected name first.
    const apiSport = sportsStore.activeSports.find(
      (candidate) => candidate.name.trim().toLowerCase() === selected.name.trim().toLowerCase(),
    );
    if (!apiSport) {
      mapGames.value = [];
      mapError.value = `GORA games for ${selected.name} are not available yet.`;
      return;
    }

    const query = buildDiscoveryQuery({
      sportId: apiSport.id,
      dateFilter: date.value,
      customDate: null,
      distanceKm: filters.maxDistanceKm,
      userLocation: discovery.userLocation,
    });
    const response = await authorized((token) => discoverGames(token, query));
    if (request !== mapRequest) return;
    mapGames.value = response.games;
    if (!response.games.some((game) => game.id === selectedMapGameId.value)) selectedMapGameId.value = null;
  } catch (caught) {
    if (request === mapRequest) mapError.value = describeApiError(caught);
  } finally {
    if (request === mapRequest) mapLoading.value = false;
  }
}

watch([date, () => filters.maxDistanceKm, () => discovery.userLocation], () => {
  void refreshSportMap();
}, { deep: true });

watch(view, (selectedView) => {
  if (selectedView === 'MAP' && !mapGames.value.length && !mapLoading.value) void refreshSportMap();
});

const games = sportMapGames;

const players = computed(() =>
  catalog.players.filter(
    (player) =>
      matchesSport(player.primarySport, sportName.value) &&
      isWithinDistance(player.distanceKm, filters.maxDistanceKm) &&
      matches(player.displayName, player.username, player.city),
  ),
);
const clubs = computed(() =>
  clubsStore.feedClubs
    .filter((club) => matchesSport([...(club.sport ? [club.sport] : []), ...club.additionalSports.map(({ name }) => name)], sportName.value))
    .filter((club) => ['JOIN', 'REQUEST'].includes(getClubJoinState(club)))
    .filter((club) => matches(club.name, club.slug, club.city ?? '', club.locationName ?? ''))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 10),
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
const resultCount = computed(
  () =>
    visibleGameCount.value +
    players.value.length +
    clubs.value.length +
    reels.value.length +
    posts.value.length,
);

const pageLoaded = ref(false);
onMounted(() => void loadSportPage());
onIonViewWillEnter(() => {
  if (pageLoaded.value) void Promise.all([refreshSportMap(), clubsStore.refreshFeedClubs()]);
});

async function loadSportPage(): Promise<void> {
  await auth.initialize();
  await Promise.all([catalog.load(), discovery.initLocation()]);
  await Promise.all([
    clubsStore.load(),
    gamesStore.load(),
    postsStore.load(),
    reelsStore.load(),
  ]);
  await refreshSportMap();
  pageLoaded.value = true;
}
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
