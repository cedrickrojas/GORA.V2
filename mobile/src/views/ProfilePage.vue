<template>
  <ion-page>
    <AppHeader />

    <ion-content :fullscreen="true">
      <div v-if="!profile && profileStore.loading" class="profile-skeleton" aria-busy="true" aria-label="Loading profile">
        <ion-skeleton-text :animated="true" class="profile-skeleton__cover" />
        <ion-skeleton-text :animated="true" class="profile-skeleton__avatar" />
        <ion-skeleton-text :animated="true" class="profile-skeleton__line profile-skeleton__line--wide" />
        <ion-skeleton-text :animated="true" class="profile-skeleton__line" />
        <div class="profile-skeleton__stats">
          <ion-skeleton-text v-for="n in 3" :key="n" :animated="true" class="profile-skeleton__stat" />
        </div>
      </div>

      <div v-else-if="!profile" class="profile-error" role="alert">
        <h2>We couldn't load your profile</h2>
        <p>{{ profileStore.error ?? 'Please try again.' }}</p>
        <ion-button fill="outline" @click="loadProfile">Try again</ion-button>
      </div>

      <template v-else>
        <ProfileHeader :profile="profile" editable :has-active-story="profile.sections.stories > 0">
          <template #cover-actions>
            <button type="button" class="profile-cover-menu" aria-label="Profile archive and saved posts" @click="coverMenuEvent = $event">
              <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
            </button>
          </template>
          <template #actions>
            <router-link to="/profile/edit" class="profile-action profile-action--primary">
              <ion-icon :icon="createOutline" aria-hidden="true" />
              Edit Profile
            </router-link>
          </template>
        </ProfileHeader>

        <ion-popover :is-open="coverMenuEvent !== null" :event="coverMenuEvent" side="bottom" alignment="end" @did-dismiss="coverMenuEvent = null">
          <nav class="profile-cover-menu__links" aria-label="Profile options">
            <button type="button" class="profile-cover-menu__link" @click="shareProfile">Share Profile</button>
            <router-link to="/profile/archive" class="profile-cover-menu__link" @click="coverMenuEvent = null">Archive</router-link>
            <router-link to="/profile/saved" class="profile-cover-menu__link" @click="coverMenuEvent = null">Saved Posts</router-link>
          </nav>
        </ion-popover>

        <nav class="profile-stats" aria-label="Profile summary">
          <router-link v-for="stat in stats" :key="stat.label" :to="stat.to" class="profile-stats__item">
            <strong>{{ formatCompactNumber(stat.value) }}</strong>
            <span>{{ stat.label }}</span>
          </router-link>
        </nav>

        <nav class="profile-links" aria-label="Profile sections">
          <router-link v-for="row in sections.visible" :key="row.key" :to="row.to" class="profile-links__item">
            {{ row.title }}
          </router-link>
          <button
            type="button"
            class="profile-links__item profile-links__more"
            aria-haspopup="menu"
            :aria-expanded="moreEvent !== null"
            @click="moreEvent = $event"
          >
            More
            <ion-icon :icon="chevronDown" aria-hidden="true" />
          </button>
        </nav>

        <ion-popover
          class="gora-popover"
          :is-open="moreEvent !== null"
          :event="moreEvent"
          side="bottom"
          alignment="end"
          @did-dismiss="moreEvent = null"
        >
          <nav class="profile-more" aria-label="More profile sections">
            <router-link
              v-for="row in sections.more"
              :key="row.key"
              :to="row.to"
              class="profile-more__item"
              @click="moreEvent = null"
            >
              <strong>{{ row.title }}</strong>
              <span>{{ row.summary }}</span>
            </router-link>
          </nav>
        </ion-popover>

        <div class="profile-section profile-section--flush">
          <MySportsSection
            :sports="sportsStore.mySports"
            editable
            :busy-id="sportsStore.busyId"
            :loading="sportsStore.mySportsStatus === 'loading'"
            :error="sportsStore.mySportsError"
            @add="openAddSport"
            @edit="openEditSport"
            @remove="confirmRemoveSport"
            @retry="sportsStore.fetchMySports({ force: true })"
          />
        </div>

        <section class="profile-section" aria-label="My clubs">
          <SectionHeader title="My Clubs">
            <span class="profile-section__meta">{{ myClubs.length }} {{ myClubs.length === 1 ? 'club' : 'clubs' }}</span>
          </SectionHeader>
          <p v-if="myClubs.length === 0" class="profile-section__empty">
            You haven't joined any clubs yet. <router-link to="/search">Find a club</router-link> for your sport.
          </p>
          <ul v-else class="profile-clubs">
            <li v-for="club in myClubs" :key="club.id">
              <router-link :to="`/clubs/${club.id}`" class="profile-clubs__item">
                <ClubAvatar :club="club" :image-url="club.profileImageUrl" :size="40" />
                <span class="profile-clubs__text">
                  <strong>{{ club.name }}</strong>
                  <span>
                    {{ club.memberCount }}/{{ club.maxMembers }} Members
                    <template v-if="club.viewerMembership?.role !== 'MEMBER'">
                      · {{ CLUB_ROLE_LABELS[club.viewerMembership!.role] }}
                    </template>
                  </span>
                </span>
              </router-link>
            </li>
          </ul>
          <router-link v-if="myClubs.length > 0" to="/profile/clubs" class="profile-section__meta profile-clubs__all">
            See all clubs
          </router-link>
        </section>

        <section class="profile-section">
          <SectionHeader title="Highlights">
            <router-link to="/profile/reels" class="profile-section__meta">See all</router-link>
          </SectionHeader>
          <p v-if="highlights.length === 0" class="profile-section__empty">
            No highlights yet. <router-link to="/create/reel">Upload a reel</router-link>
          </p>
          <HighlightGrid v-else :highlights="highlights" :editable-reels="reelsStore.myReels" />
        </section>

        <section class="profile-section profile-section--last">
          <SectionHeader title="My Feed">
            <span class="profile-section__meta">{{ myFeed.length }} {{ myFeed.length === 1 ? 'update' : 'updates' }}</span>
            <router-link to="/profile/games" class="profile-section__meta">Manage games</router-link>
          </SectionHeader>
          <router-link to="/create/post" class="profile-composer">
            <UserAvatar v-if="profileStore.account" :user="profileStore.account" :size="38" />
            <span class="profile-composer__prompt">Share a game moment…</span>
            <ion-icon :icon="imageOutline" class="profile-composer__icon" aria-label="Add photos" />
          </router-link>
          <p v-if="myFeed.length === 0" class="profile-section__empty">
            No posts or games yet. <router-link to="/create/post">Create your first post</router-link>
          </p>
          <div class="profile-feed">
            <FeedEntry
              v-for="item in myFeed"
              :key="item.id"
              :item="item"
              :now-ms="now"
              @like="likePost"
              @comment="commentOnPost"
              @share="sharePost"
            />
          </div>
        </section>
      </template>
    </ion-content>

    <SportEditorModal
      :is-open="editor.open"
      :entry="editor.entry"
      :options="sportsStore.addable"
      :options-loading="sportsStore.sportsStatus === 'loading'"
      :options-error="sportsStore.sportsError"
      :no-sports-available="sportsStore.sportsStatus === 'ready' && sportsStore.activeSports.length === 0"
      :save="saveSport"
      @close="editor.open = false"
      @retry="sportsStore.fetchSports({ force: true })"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonPopover,
  IonSkeletonText,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue';
import { chevronDown, createOutline, ellipsisHorizontal, imageOutline } from 'ionicons/icons';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import FeedEntry from '@/components/feed/FeedEntry.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import HighlightGrid from '@/components/profile/HighlightGrid.vue';
import MySportsSection from '@/components/profile/MySportsSection.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import SportEditorModal from '@/components/profile/SportEditorModal.vue';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { useClubsStore } from '@/stores/clubs';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { type ActionResult, useProfileStore } from '@/stores/profile';
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import { useSportsStore } from '@/stores/sports';
import type { AddSportInput, UserSportEntry } from '@/types/profile';
import type { HomeFeedItem } from '@/types/feed';
import { CLUB_ROLE_LABELS, groupMyClubs } from '@/utils/clubs';
import { toHighlight } from '@/utils/media-api';
import { showNotice } from '@/utils/notice';
import { shareLink } from '@/utils/share-link';
import { buildProfileSections, splitProfileSections } from '@/utils/profile-sections';
import { formatCompactNumber } from '@/utils/time';

const profileStore = useProfileStore();
const sportsStore = useSportsStore();
const postsStore = usePostsStore();
const clubsStore = useClubsStore();
const gamesStore = useGamesStore();
const reelsStore = useReelsStore();
const session = useSessionStore();
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();

const profile = computed(() => profileStore.currentProfile);
const editor = reactive<{ open: boolean; entry: UserSportEntry | null }>({ open: false, entry: null });

const stats = computed(() =>
  profile.value
    ? [
        { label: 'Friends', value: profile.value.stats.friends, to: '/profile/friends' },
        { label: 'Followers', value: profile.value.stats.followers, to: '/profile/followers' },
        { label: 'Following', value: profile.value.stats.following, to: '/profile/following' },
      ]
    : [],
);
const sections = computed(() =>
  splitProfileSections(profile.value ? buildProfileSections(profile.value.stats, profile.value.sections) : []),
);
/** The click that opened the More menu, used to anchor it. Null when closed. */
const moreEvent = ref<Event | null>(null);
const coverMenuEvent = ref<Event | null>(null);
/** Every club you are an ACTIVE member of (the same list as My Clubs → Your clubs), owner first. */
const myClubs = computed(() => groupMyClubs(clubsStore.clubs).joined);

async function shareProfile(): Promise<void> {
  coverMenuEvent.value = null;
  const current = profile.value;
  if (!current) return;
  try {
    const result = await shareLink(`${current.displayName}'s GORA profile`, `/profile/${encodeURIComponent(current.username)}`);
    if (result !== 'cancelled') void showNotice(result === 'copied' ? 'Profile link copied.' : 'Profile shared.');
  } catch {
    void showNotice('Could not share this profile. Please try again.');
  }
}

/** The 3 newest of your own reels (the demo highlights only when nobody is signed in). */
const highlights = computed(() =>
  reelsStore.savesToServer
    ? reelsStore.myReels.slice(0, 3).map(toHighlight)
    : (profileStore.profile?.highlights.slice(0, 3) ?? []),
);
/** Own posts and every game you hosted, shown together in newest-first order. */
const myFeed = computed<HomeFeedItem[]>(() => [
  ...postsStore.myPosts.map((post) => ({
    type: 'POST' as const,
    id: `post:${post.id}`,
    at: Date.parse(post.createdAt),
    post,
  })),
  ...gamesStore.hostedGames.map((game) => ({
    type: 'SERVER_GAME' as const,
    id: `game:${game.id}`,
    at: Date.parse(game.createdAt),
    game,
  })),
].sort((a, b) => b.at - a.at));

async function loadProfile(): Promise<void> {
  await profileStore.fetchMyProfile();
}

function openAddSport(): void {
  void sportsStore.fetchSports();
  editor.entry = null;
  editor.open = true;
}

function openEditSport(sport: UserSportEntry): void {
  editor.entry = sport;
  editor.open = true;
}

async function saveSport(draft: AddSportInput): Promise<ActionResult> {
  const editing = editor.entry;
  const result = editing
    ? await sportsStore.updateSport(draft.sportId, { skillLevel: draft.skillLevel, position: draft.position })
    : await sportsStore.addSport(draft);

  if (result.ok) {
    const name = editing?.name ?? sportsStore.sportName(draft.sportId) ?? 'Sport';
    void showNotice(editing ? `${name} updated.` : `${name} added to your sports.`);
  }

  return result;
}

async function confirmRemoveSport(sport: UserSportEntry): Promise<void> {
  const alert = await alertController.create({
    header: `Remove ${sport.name} from your sports?`,
    message: 'It will no longer show on your profile. You can add it again anytime.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Remove', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  const result = await sportsStore.removeSport(sport.sportId);
  void showNotice(result.ok ? `${sport.name} removed from your sports.` : result.message);
}

onIonViewWillEnter(() => {
  void clubsStore.load();
  void gamesStore.fetchMyGames();

  if (reelsStore.isLoaded) {
    void reelsStore.refresh();
  }
});

onMounted(() => {
  void loadProfile();
  void profileStore.load();
  void session.load();
  void postsStore.load();
  void reelsStore.load();
});
</script>

<style scoped>
.profile-action {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.profile-action ion-icon {
  font-size: 18px;
}

.profile-action--primary {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.profile-stats {
  display: grid;
  gap: 8px;
  margin: 16px 16px 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-stats__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  color: var(--ion-text-color);
  text-decoration: none;
}

.profile-stats__item:hover {
  background: color-mix(in srgb, var(--gora-surface) 80%, #fff 6%);
}

.profile-stats__item strong {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.profile-stats__item span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.profile-section {
  margin: 0 16px;
  padding: 22px 0;
  border-top: 1px solid var(--gora-line);
}

.profile-section:first-of-type {
  margin-top: 16px;
}

.profile-section.profile-section--flush {
  margin-top: 0;
  border-top: 0;
}

.profile-clubs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-clubs__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  color: var(--ion-text-color);
  text-decoration: none;
}

.profile-clubs__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.profile-clubs__text strong {
  overflow: hidden;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-clubs__text span {
  color: var(--ion-color-primary);
  font-size: 0.74rem;
  font-weight: 600;
}

.profile-clubs__all {
  display: inline-block;
  margin-top: 10px;
}

.profile-section--last {
  padding-bottom: 32px;
}

.profile-section__meta {
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.profile-section__empty {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.profile-section__empty a {
  color: var(--ion-color-primary);
}

.profile-links {
  display: flex;
  gap: 4px;
  margin: 12px 16px 0;
  overflow-x: auto;
  border-top: 1px solid var(--gora-line);
  border-bottom: 1px solid var(--gora-line);
  scrollbar-width: none;
}

.profile-links::-webkit-scrollbar {
  display: none;
}

.profile-links__item {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.profile-links__item:hover {
  background: rgba(245, 247, 242, 0.06);
  color: var(--ion-text-color);
}

.profile-links__more {
  margin-left: auto;
}

.profile-links__more ion-icon {
  font-size: 14px;
}

.profile-more {
  display: flex;
  flex-direction: column;
  padding: 6px;
}

.profile-more__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 8px;
  color: var(--ion-text-color);
  text-decoration: none;
}

.profile-more__item strong {
  font-size: 0.92rem;
}

.profile-more__item span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.profile-more__item:hover {
  background: rgba(245, 247, 242, 0.06);
}

.profile-section__meta {
  text-decoration: none;
}

.profile-composer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.88rem;
  text-decoration: none;
}

.profile-composer__prompt {
  flex: 1;
}

.profile-composer__icon {
  color: var(--ion-color-primary);
  font-size: 22px;
}

.profile-feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-error {
  padding: 48px 24px;
  text-align: center;
}

.profile-error p {
  color: var(--gora-muted);
}

.profile-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 24px;
}

.profile-skeleton__cover {
  height: 190px;
  margin: 0;
}

.profile-skeleton__avatar {
  width: 112px;
  height: 112px;
  margin: -64px 16px 0;
  border-radius: 50%;
}

.profile-skeleton__line {
  width: 35%;
  height: 16px;
  margin: 0 16px;
}

.profile-skeleton__line--wide {
  width: 55%;
  height: 24px;
}

.profile-skeleton__stats {
  display: grid;
  gap: 8px;
  margin: 8px 16px 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-skeleton__stat {
  height: 56px;
  margin: 0;
  border-radius: var(--gora-radius-card);
}

.profile-cover-menu {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 50%;
  background: rgb(8 19 31 / 78%);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}

.profile-cover-menu__links {
  display: grid;
  min-width: 170px;
  padding: 6px;
}

.profile-cover-menu__link {
  padding: 12px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  color: var(--gora-text);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  text-align: left;
}

.profile-cover-menu__link:hover {
  background: var(--gora-surface);
}
</style>
