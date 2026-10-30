<template>
  <ion-page>
    <SubPageHeader :title="header?.displayName ?? 'Profile'" back-href="/home" />

    <ion-content :fullscreen="true">
      <div v-if="isLoading" class="user-profile__state" aria-busy="true">
        <ion-spinner name="crescent" aria-label="Loading profile" />
      </div>

      <div v-else-if="loadError" class="user-profile__missing" role="alert">
        <h2>We couldn't load this profile</h2>
        <p>{{ loadError }}</p>
        <ion-button fill="outline" @click="loadProfile">Try again</ion-button>
      </div>

      <div v-else-if="!header" class="user-profile__missing">
        <h2>This profile isn't available</h2>
        <p>The link may be broken, or the account may no longer be active.</p>
        <router-link to="/search" class="user-profile__link">Search for players</router-link>
      </div>

      <template v-else>
        <ProfileHeader :profile="header">
          <template #cover-actions>
            <div v-if="relationship !== 'SELF'" class="user-profile__menu-wrap">
              <button
                type="button"
                class="user-profile__menu-trigger"
                aria-label="More profile options"
                aria-haspopup="menu"
                :aria-expanded="profileMenuOpen"
                @click="profileMenuOpen = !profileMenuOpen"
              >
                <ion-icon :icon="ellipsisHorizontalOutline" aria-hidden="true" />
              </button>
              <div v-if="profileMenuOpen" class="user-profile__menu" role="menu" aria-label="Profile options">
                <button type="button" role="menuitem" @click="openReport">
                  <ion-icon :icon="flagOutline" aria-hidden="true" />
                  Report
                </button>
                <button
                  v-if="!isBlocked"
                  type="button"
                  class="user-profile__menu-danger"
                  role="menuitem"
                  @click="confirmBlock"
                >
                  <ion-icon :icon="banOutline" aria-hidden="true" />
                  Block
                </button>
              </div>
            </div>
          </template>
          <template #actions>
            <button
              v-for="action in actions"
              :key="action"
              type="button"
              class="user-profile__action"
              :class="ACTION_STYLES[action]"
              :disabled="!!friendsStore.busyId"
              @click="runAction(action)"
            >
              <ion-icon :icon="ACTION_ICONS[action]" aria-hidden="true" />
              {{ ACTION_LABELS[action] }}
            </button>
          </template>
        </ProfileHeader>

        <p v-if="isBlocked" class="user-profile__blocked">
          You blocked @{{ header.username }}. They can't see your posts or message you, and you won't see theirs.
          Unblock to see their profile again.
        </p>

        <template v-else>
          <nav class="user-profile__stats" aria-label="Profile summary">
            <span v-for="stat in stats" :key="stat.label" class="user-profile__stat">
              <strong>{{ formatCompactNumber(stat.value) }}</strong>
              <span>{{ stat.label }}</span>
            </span>
          </nav>

          <section class="user-profile__section">
            <MySportsSection v-if="apiProfile" :sports="apiProfile.sports" />
            <template v-else-if="demoProfile">
              <SectionHeader title="Sports" />
              <SportList :sports="demoProfile.sports" />
            </template>
          </section>

          <section
            v-if="apiProfile?.sections"
            class="user-profile__section user-profile__section--last"
            aria-labelledby="user-profile-counts"
          >
            <h2 id="user-profile-counts" class="user-profile__title">On GORA</h2>
            <ul class="user-profile__counts">
              <li v-for="item in sectionCounts" :key="item.label">
                <strong>{{ formatCompactNumber(item.value) }}</strong>
                <span>{{ item.label }}</span>
              </li>
            </ul>
            <p class="user-profile__note">Only what you're allowed to see is counted.</p>
            <SectionHeader title="Posts" />
            <p v-if="profilePostsError" class="user-profile__empty" role="alert">{{ profilePostsError }}</p>
            <div class="user-profile__list">
              <p v-if="apiPosts.length === 0 && !profilePostsError" class="user-profile__empty">
                No posts you can see yet.
              </p>
              <PostCard
                v-for="post in apiPosts"
                :key="post.id"
                :post="post"
                :now-ms="now"
                @like="likePost"
                @comment="commentOnPost"
                @share="sharePost"
              />
              <ion-button
                v-if="profilePostsCursor"
                fill="outline"
                :disabled="loadingProfilePosts"
                @click="loadProfilePosts(true)"
                >Load more posts</ion-button
              >
            </div>
          </section>

          <section v-else-if="demoProfile" class="user-profile__section user-profile__section--last">
            <SegmentTabs v-model="tab" :options="tabs" aria-label="Profile content" />

            <div v-if="tab === 'POSTS'" class="user-profile__list">
              <p v-if="posts.length === 0" class="user-profile__empty">No posts you can see yet.</p>
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

            <div v-else-if="tab === 'GAMES'" class="user-profile__list">
              <p v-if="games.length === 0" class="user-profile__empty">No games hosted yet.</p>
              <GameCard v-for="game in games" :key="game.id" :game="game" :now-ms="now" />
            </div>

            <div v-else-if="tab === 'REELS'" class="user-profile__reels">
              <p v-if="reels.length === 0" class="user-profile__empty">No reels yet.</p>
              <ReelThumb v-for="reel in reels" :key="reel.id" :reel="reel" />
            </div>

            <ul v-else-if="tab === 'CLUBS'" class="user-profile__clubs">
              <li v-if="clubs.length === 0" class="user-profile__empty">No clubs to show.</li>
              <ClubRow v-for="club in clubs" :key="club.id" :club="club" />
            </ul>

            <ul v-else class="user-profile__activity">
              <li v-if="activities.length === 0" class="user-profile__empty">No recent activity.</li>
              <li v-for="activity in activities" :key="activity.id" class="user-profile__activity-item">
                <strong>{{ header.firstName }}</strong> {{ activity.summary }}
                <span>{{ activity.sport }} · {{ formatTimeAgo(Date.parse(activity.createdAt), now) }}</span>
              </li>
            </ul>
          </section>
        </template>
      </template>
    </ion-content>
    <ReportUserModal :user="reportTarget" @close="reportTarget = null" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonButton, IonContent, IonIcon, IonPage, IonSpinner, alertController, onIonViewWillEnter } from '@ionic/vue';
import {
  checkmarkOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  banOutline,
  ellipsisHorizontalOutline,
  flagOutline,
  lockOpenOutline,
  personAddOutline,
  peopleOutline,
  timeOutline,
} from 'ionicons/icons';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import PostCard from '@/components/feed/PostCard.vue';
import GameCard from '@/components/games/GameCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import MySportsSection from '@/components/profile/MySportsSection.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import ReportUserModal from '@/components/profile/ReportUserModal.vue';
import SportList from '@/components/profile/SportList.vue';
import ReelThumb from '@/components/reels/ReelThumb.vue';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { fetchPublicProfile } from '@/services/profile.service';
import { listUserPosts } from '@/services/posts-api.service';
import { useAuthStore } from '@/stores/auth';
import { captureSession, createAuthorizedCall } from '@/stores/authorized';
import { useCatalogStore } from '@/stores/catalog';
import { useChatStore } from '@/stores/chat';
import { useClubsStore } from '@/stores/clubs';
import { useFriendsStore } from '@/stores/friends';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useProfileStore } from '@/stores/profile';
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import type { PlayerSummary } from '@/types/player';
import { describeApiError } from '@/utils/api-errors';
import { toFeedPost } from '@/utils/post-api';
import type { OtherProfile, ProfileIdentity, PublicProfile } from '@/types/profile';
import { formatDisplayName, toUserSummary } from '@/utils/display-name';
import { showLaterPhaseNotice, showNotice } from '@/utils/notice';
import {
  messageAccessFor,
  profileActionsFor,
  type MessageAccess,
  type ProfileAction,
  type RelationshipState,
} from '@/utils/relationship';
import { formatCompactNumber, formatTimeAgo } from '@/utils/time';

type ProfileTab = 'POSTS' | 'GAMES' | 'REELS' | 'CLUBS' | 'ACTIVITY';

const ACTION_LABELS: Record<ProfileAction, string> = {
  ADD_FRIEND: 'Add Friend',
  REQUEST_SENT: 'Request Sent',
  ACCEPT: 'Accept',
  DELETE: 'Delete',
  FRIENDS: 'Friends',
  MESSAGE: 'Message',
  UNBLOCK: 'Unblock',
};

const ACTION_ICONS: Record<ProfileAction, string> = {
  ADD_FRIEND: personAddOutline,
  REQUEST_SENT: timeOutline,
  ACCEPT: checkmarkOutline,
  DELETE: closeOutline,
  FRIENDS: peopleOutline,
  MESSAGE: chatbubbleEllipsesOutline,
  UNBLOCK: lockOpenOutline,
};

const ACTION_STYLES: Record<ProfileAction, string> = {
  ADD_FRIEND: 'user-profile__action--primary',
  REQUEST_SENT: '',
  ACCEPT: 'user-profile__action--primary',
  DELETE: '',
  FRIENDS: '',
  MESSAGE: '',
  UNBLOCK: 'user-profile__action--primary',
};

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const session = useSessionStore();
const profileStore = useProfileStore();
const friendsStore = useFriendsStore();
const chatStore = useChatStore();
const postsStore = usePostsStore();
const gamesStore = useGamesStore();
const reelsStore = useReelsStore();
const clubsStore = useClubsStore();
const catalog = useCatalogStore();
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();
const reportTarget = ref<ProfileIdentity | null>(null);
const profileMenuOpen = ref(false);

/** Ionic keeps one cached page per URL, so each instance stays on the user it opened with. */
const pageUsername = String(route.params.username ?? '')
  .trim()
  .toLowerCase();
/** A real account from GET /profiles/:username. */
const apiProfile = ref<OtherProfile | null>(null);
const apiPostIds = ref<string[]>([]);
const apiPosts = computed(() =>
  apiPostIds.value.flatMap((id) => {
    const post = postsStore.findPost(id);
    return post ? [post] : [];
  }),
);
const profilePostsError = ref<string | null>(null);
const profilePostsCursor = ref<string | null>(null);
const loadingProfilePosts = ref(false);

async function loadProfilePosts(more = false): Promise<void> {
  if (!auth.accessToken || loadingProfilePosts.value) return;
  const isCurrent = captureSession(auth);
  loadingProfilePosts.value = true;
  profilePostsError.value = null;
  try {
    const page = await createAuthorizedCall(auth)((token) =>
      listUserPosts(token, pageUsername, more ? (profilePostsCursor.value ?? undefined) : undefined),
    );
    postsStore.rememberProfilePosts(page.posts.map(toFeedPost));
    apiPostIds.value = [...new Set([...(more ? apiPostIds.value : []), ...page.posts.map((post) => post.id)])];
    profilePostsCursor.value = page.nextCursor;
  } catch (caught) {
    if (!isCurrent()) return;
    if (!more) apiPostIds.value = [];
    profilePostsError.value = describeApiError(caught, 'Could not load these posts.');
  } finally {
    if (isCurrent()) loadingProfilePosts.value = false;
  }
}
/** A sample user from the demo feeds, used only when the API has no such account. */
const demoProfile = ref<PublicProfile | null>(null);
const isLoading = ref(true);
const loadError = ref<string | null>(null);
const tab = ref<ProfileTab>('POSTS');

watch(
  [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
  () => {
    apiProfile.value = null;
    apiPostIds.value = [];
    demoProfile.value = null;
    loadingProfilePosts.value = false;
    loadError.value = null;
    isLoading.value = false;
  },
  { flush: 'sync' },
);

/** The server decides the relationship for real accounts; never the client. */
const relationship = computed<RelationshipState>(() => {
  if (apiProfile.value) {
    return apiProfile.value.relationship.state;
  }

  const viewerId = session.me?.id;
  return demoProfile.value && viewerId ? friendsStore.relationshipWith(viewerId, demoProfile.value.id) : 'SELF';
});
const messageAccess = computed<MessageAccess>(
  () => apiProfile.value?.relationship.messageAccess ?? messageAccessFor(relationship.value),
);
const isBlocked = computed(() => relationship.value === 'BLOCKED');
const actions = computed(() => profileActionsFor(relationship.value));

const header = computed<ProfileIdentity | null>(() => {
  if (apiProfile.value) {
    return apiProfile.value;
  }

  const demo = demoProfile.value;

  return demo
    ? {
        id: demo.id,
        username: demo.username,
        firstName: demo.firstName,
        lastName: demo.lastName,
        displayName: formatDisplayName(demo),
        profileImageUrl: demo.avatarUrl,
        coverImageUrl: demo.coverImageUrl,
        bio: isBlocked.value ? null : demo.bio,
        city: demo.city,
      }
    : null;
});

const stats = computed(() => {
  const counts = apiProfile.value
    ? apiProfile.value.stats
    : demoProfile.value && {
        friends: demoProfile.value.friendsCount,
        followers: demoProfile.value.followersCount,
        following: demoProfile.value.followingCount,
      };

  return counts
    ? [
        { label: 'Friends', value: counts.friends },
        { label: 'Followers', value: counts.followers },
        { label: 'Following', value: counts.following },
      ]
    : [];
});

const sectionCounts = computed(() => {
  const sections = apiProfile.value?.sections;

  return sections
    ? [
        { label: 'Posts', value: sections.posts },
        { label: 'Games', value: sections.games },
        { label: 'Reels', value: sections.reels },
        { label: 'Clubs', value: sections.clubs },
        { label: 'Badges', value: sections.badges },
      ]
    : [];
});

/** Demo profiles only: posts this viewer may see (never ONLY_ME, CUSTOM only when chosen). */
const posts = computed(() => (demoProfile.value ? postsStore.byAuthor(demoProfile.value.id) : []));
const games = computed(() => gamesStore.games.filter((game) => game.host.id === demoProfile.value?.id));
const reels = computed(() => reelsStore.feedReels.filter((reel) => reel.author.id === demoProfile.value?.id));
const activities = computed(() => catalog.activities.filter((activity) => activity.actor.id === demoProfile.value?.id));
/** Private clubs stay hidden unless the viewer is also an active member. */
const clubs = computed(() =>
  clubsStore.clubs.filter(
    (club) =>
      (club.isPublic || club.viewerMembership?.status === 'ACTIVE') &&
      (clubsStore.members[club.id] ?? []).some((member) => member.user.id === demoProfile.value?.id),
  ),
);

const tabs = [
  { id: 'POSTS' as const, label: 'Posts' },
  { id: 'GAMES' as const, label: 'Games' },
  { id: 'REELS' as const, label: 'Reels' },
  { id: 'CLUBS' as const, label: 'Clubs' },
  { id: 'ACTIVITY' as const, label: 'Activity' },
];

function asPlayer(user: PublicProfile): PlayerSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    primarySport: user.sports[0]?.name ?? '',
    city: user.city ?? '',
    distanceKm: 0,
    followers: user.followersCount,
    gamesCompleted: user.gamesCompleted,
    featured: false,
  };
}

/**
 * Friends open the direct conversation. Anyone else opens the same chat screen, where the first
 * message becomes their one message request. Blocked users get nothing.
 */
async function message(identity: ProfileIdentity): Promise<void> {
  const partner = toUserSummary(identity);
  const name = identity.firstName || partner.displayName;

  await chatStore.load();
  const existing = chatStore.findDirectWith(partner.id);
  if (existing && messageAccess.value !== 'NONE') {
    await router.push(`/chat/${existing.id}`);
    return;
  }

  if (messageAccess.value === 'DIRECT') {
    const id = await chatStore.openDirect(partner, now.value);
    if (id) await router.push(`/chat/${id}`);
    else void showNotice(chatStore.error ?? 'Could not open this chat.');
    return;
  }

  if (messageAccess.value === 'NONE') {
    return;
  }

  if (chatStore.requests.some((request) => request.sender.id === partner.id)) {
    void showNotice(`${name} already sent you a message request. Accept it in Requests.`);
    await router.push({ path: '/chat', query: { section: 'requests' } });
    return;
  }

  await router.push(chatStore.openRequest(partner));
}

function openReport(): void {
  if (header.value) reportTarget.value = header.value;
  profileMenuOpen.value = false;
}

async function confirmBlock(): Promise<void> {
  const identity = header.value;
  if (!identity) return;
  profileMenuOpen.value = false;
  const alert = await alertController.create({
    header: `Block @${identity.username}?`,
    message:
      'They will not be able to see your profile or message you. You will no longer see their profile or activity.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Block', role: 'destructive', handler: () => void blockProfileUser(identity) },
    ],
  });
  await alert.present();
}

async function blockProfileUser(identity: ProfileIdentity): Promise<void> {
  const ok = await friendsStore.block(identity.id, identity.username);
  if (!ok) {
    if (friendsStore.error) void showNotice(friendsStore.error);
    return;
  }
  void showNotice(`@${identity.username} has been blocked.`);
  if (apiProfile.value) {
    const result = await profileStore.fetchProfile(pageUsername);
    if (result.status === 'found' && !result.profile.isOwnProfile) apiProfile.value = result.profile;
  }
}

async function runAction(action: ProfileAction): Promise<void> {
  const identity = header.value;

  if (!identity) {
    return;
  }

  if (action === 'MESSAGE') {
    await message(identity);
    return;
  }

  if (apiProfile.value) {
    if (action === 'FRIENDS') {
      const alert = await alertController.create({
        header: `Unfriend ${identity.firstName}?`,
        message: 'You will no longer see each other’s Friends posts.',
        buttons: [
          { text: 'Keep friend', role: 'cancel' },
          {
            text: 'Unfriend',
            role: 'destructive',
            handler: () => {
              void changeFriendship(action);
            },
          },
        ],
      });
      await alert.present();
    } else await changeFriendship(action);
    return;
  }

  const user = demoProfile.value;
  const viewerId = session.me?.id;

  if (!user || !viewerId) {
    return;
  }

  const request = friendsStore.requestWith(user.id);

  switch (action) {
    case 'ADD_FRIEND':
      if (await friendsStore.sendRequest(viewerId, asPlayer(user), now.value)) {
        void showNotice(`Friend request sent to ${user.firstName}.`);
      }
      break;
    case 'REQUEST_SENT':
      if (request) {
        await friendsStore.dismiss(request.id);
        void showNotice('Friend request canceled.');
      }
      break;
    case 'ACCEPT':
      if (request) {
        await friendsStore.accept(request.id);
        void showNotice(`You and ${user.firstName} are now friends.`);
      }
      break;
    case 'DELETE':
      if (request) {
        await friendsStore.dismiss(request.id);
        void showNotice('Friend request deleted.');
      }
      break;
    case 'FRIENDS':
      void showLaterPhaseNotice('Unfriend');
      break;
    case 'UNBLOCK':
      await friendsStore.unblock(user.id);
      void showNotice(`You unblocked @${user.username}.`);
      break;
  }
}

async function changeFriendship(action: Exclude<ProfileAction, 'MESSAGE'>): Promise<void> {
  const identity = header.value;
  const viewerId = auth.currentUser?.id;
  if (!identity || !viewerId || friendsStore.busyId) return;
  await friendsStore.refresh();
  const request = friendsStore.requestWith(identity.id);
  let ok = false;
  switch (action) {
    case 'ADD_FRIEND':
      ok = await friendsStore.sendRequest(
        viewerId,
        {
          ...toUserSummary(identity),
          city: identity.city ?? '',
          primarySport: '',
          distanceKm: 0,
          followers: 0,
          gamesCompleted: 0,
          featured: false,
        },
        now.value,
      );
      break;
    case 'ACCEPT':
      if (request) ok = await friendsStore.accept(request.id);
      break;
    case 'REQUEST_SENT':
    case 'DELETE':
      if (request) ok = await friendsStore.dismiss(request.id);
      break;
    case 'FRIENDS':
      ok = await friendsStore.unfriend(identity.username);
      break;
    case 'UNBLOCK':
      ok = await friendsStore.unblock(identity.id, identity.username);
      break;
  }
  if (!ok && friendsStore.error) void showNotice(friendsStore.error);
  if (ok) {
    const notices = {
      ADD_FRIEND: 'Friend request sent.',
      ACCEPT: `You and ${identity.firstName} are now friends.`,
      REQUEST_SENT: 'Friend request canceled.',
      DELETE: 'Friend request declined.',
      FRIENDS: 'Friend removed.',
      UNBLOCK: 'Player unblocked.',
    };
    void showNotice(notices[action]);
  }
  const result = await profileStore.fetchProfile(pageUsername);
  if (result.status === 'found' && !result.profile.isOwnProfile) apiProfile.value = result.profile;
  await loadProfilePosts();
}

function isOwnUsername(username: string): boolean {
  return username === session.me?.username;
}

async function loadDemoContent(): Promise<void> {
  void gamesStore.load();
  void reelsStore.load();
  void catalog.load();
  await clubsStore.load();
  await Promise.all(clubsStore.clubs.map((club) => clubsStore.loadMembers(club.id)));
}

async function loadProfile(): Promise<void> {
  const isCurrent = captureSession(auth);
  isLoading.value = true;
  loadError.value = null;
  apiProfile.value = null;
  apiPostIds.value = [];
  demoProfile.value = null;

  try {
    await Promise.all([session.load(), friendsStore.load(), chatStore.load(), postsStore.load()]);
    if (!isCurrent()) return;

    if (isOwnUsername(pageUsername)) {
      await router.replace('/profile');
      return;
    }

    const result = await profileStore.fetchProfile(pageUsername);
    if (!isCurrent()) return;

    if (result.status === 'error') {
      loadError.value = result.message;
      return;
    }

    if (result.status === 'found') {
      if (result.profile.isOwnProfile) {
        await router.replace('/profile');
        return;
      }

      apiProfile.value = result.profile;
      await loadProfilePosts();
      return;
    }

    demoProfile.value = await fetchPublicProfile(pageUsername);

    if (demoProfile.value) {
      await loadDemoContent();
    }
  } finally {
    if (isCurrent()) isLoading.value = false;
  }
}

onIonViewWillEnter(() => {
  if (!isLoading.value) void loadProfile();
});
onMounted(() => {
  void loadProfile();
});
</script>

<style scoped>
.user-profile__state {
  display: flex;
  justify-content: center;
  padding: 64px 16px;
}

.user-profile__action {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border: 0;
  border-radius: 10px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
}

.user-profile__action ion-icon {
  font-size: 18px;
}

.user-profile__action--primary {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.user-profile__menu-wrap {
  position: relative;
}

.user-profile__menu-trigger {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  background: rgba(8, 19, 31, 0.78);
  color: #fff;
  cursor: pointer;
}

.user-profile__menu-trigger ion-icon {
  font-size: 22px;
}

.user-profile__menu {
  position: absolute;
  z-index: 4;
  top: 48px;
  right: 0;
  width: 190px;
  padding: 6px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  background: var(--gora-surface-raised);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.user-profile__menu button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 11px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.user-profile__menu button:hover,
.user-profile__menu button:focus-visible {
  background: var(--gora-surface);
}

.user-profile__menu .user-profile__menu-danger {
  color: #ff8585;
}

.user-profile__menu button ion-icon {
  font-size: 18px;
}

.user-profile__blocked {
  margin: 20px 16px;
  padding: 14px;
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.user-profile__stats {
  display: grid;
  gap: 8px;
  margin: 16px 16px 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.user-profile__stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border-radius: 14px;
  background: var(--gora-surface);
}

.user-profile__stat strong {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.user-profile__stat span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.user-profile__section {
  margin: 0 16px;
  padding: 20px 0;
  border-top: 1px solid var(--gora-line);
}

.user-profile__section:first-of-type {
  margin-top: 16px;
}

.user-profile__section--last {
  padding-bottom: 32px;
}

.user-profile__title {
  margin: 0 0 12px;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.user-profile__counts {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  list-style: none;
}

.user-profile__counts li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border-radius: 14px;
  background: var(--gora-surface);
}

.user-profile__counts strong {
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

.user-profile__counts span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.user-profile__note {
  margin: 10px 0 0;
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.user-profile__list,
.user-profile__clubs,
.user-profile__activity {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.user-profile__reels {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.user-profile__reels .user-profile__empty {
  grid-column: 1 / -1;
}

.user-profile__activity-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border-radius: 14px;
  background: var(--gora-surface);
  font-size: 0.88rem;
}

.user-profile__activity-item span {
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.user-profile__empty {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.user-profile__missing {
  padding: 48px 24px;
  text-align: center;
}

.user-profile__missing p {
  color: var(--gora-muted);
}

.user-profile__link {
  color: var(--ion-color-primary);
  font-weight: 700;
}
</style>
