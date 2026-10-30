<template>
  <ion-page>
    <SubPageHeader :title="club?.name ?? 'Club'" back-href="/profile/clubs" />

    <ion-content :fullscreen="true">
      <p v-if="lookup === 'missing'" class="club__missing">This club does not exist or was disabled.</p>
      <p v-else-if="lookupError && !club" class="club__missing" role="alert">{{ lookupError }}</p>

      <template v-if="club">
        <div
          class="club__cover"
          :style="club.coverImageUrl ? { backgroundImage: `url(${club.coverImageUrl})` } : { background: visual.gradient }"
        >
          <ion-icon v-if="!club.coverImageUrl" :icon="visual.icon" class="club__cover-icon" aria-hidden="true" />
        </div>

        <header class="club__header">
          <ClubAvatar :club="club" :image-url="club.profileImageUrl" :size="76" class="club__avatar" />
          <h1 class="club__name">{{ club.name }}</h1>
          <p class="club__handle">@{{ club.slug }}</p>
          <p class="club__members">
            <strong>{{ club.memberCount }} / {{ club.maxMembers }}</strong> Members
            <span v-if="full" class="club__full">FULL</span>
            <span v-else class="club__slots">· {{ formatClubSlots(club) }}</span>
          </p>
          <ul class="club__facts">
            <li>
              <ion-icon :icon="visual.icon" aria-hidden="true" />
              {{ club.sport ?? 'Multi-sport' }}
            </li>
            <li v-for="sport in club.additionalSports" :key="sport.id">{{ sport.name }}</li>
            <li v-if="club.city || club.locationName">
              <ion-icon :icon="locationOutline" aria-hidden="true" />
              {{ [club.locationName, club.city].filter(Boolean).join(' · ') }}
            </li>
            <li>
              <ion-icon :icon="club.isPublic ? earthOutline : lockClosedOutline" aria-hidden="true" />
              {{ club.isPublic ? 'Public club' : 'Private club' }}
            </li>
            <li>
              <ion-icon :icon="peopleOutline" aria-hidden="true" />
              {{ MEMBERSHIP_TYPE_LABELS[club.membershipType] }}
            </li>
          </ul>
          <p v-if="club.description" class="club__description">{{ club.description }}</p>

          <div class="club__actions">
            <button
              type="button"
              class="club__primary"
              :class="`club__primary--${joinState.toLowerCase().replace('_', '-')}`"
              :disabled="primaryDisabled || busy"
              @click="onPrimary"
            >
              {{ primaryLabel }}
            </button>
            <button v-if="canManage" type="button" class="club__secondary" @click="openManage">Manage Club</button>
            <button v-else-if="joinState === 'MEMBER'" type="button" class="club__secondary" :disabled="busy" @click="leave">
              Leave
            </button>
            <button
              v-else-if="joinState !== 'BANNED'"
              type="button"
              class="club__secondary"
              :aria-pressed="club.viewerFollows"
              @click="follow"
            >
              {{ club.viewerFollows ? 'Following' : 'Follow' }}
            </button>
            <button
              type="button"
              class="club__secondary club__chat"
              :disabled="!canOpenChat"
              :title="canOpenChat ? 'Open the official club chat' : 'Only active members can open the club chat'"
              @click="openChat"
            >
              <ion-icon :icon="chatbubblesOutline" aria-hidden="true" />
              Chat
            </button>
            <button type="button" class="club__secondary club__chat" @click="shareClub">
              <ion-icon :icon="shareSocialOutline" aria-hidden="true" />
              Share
            </button>
          </div>
          <p v-if="joinState === 'REQUESTED'" class="club__note">An admin will review your request. Tap again to cancel it.</p>
          <p v-else-if="joinState === 'FULL'" class="club__note">This club has reached its member limit.</p>
          <p v-else-if="joinState === 'INVITE_ONLY'" class="club__note">Only invited people can join this club.</p>
          <p v-else-if="club.viewerHasInvite && joinState === 'JOIN'" class="club__note">You're invited to this club.</p>
          <p v-else-if="!canOpenChat" class="club__note">The club chat is for active members.</p>
        </header>

        <section v-if="hasDetails" class="club__about" aria-label="About the club">
          <p v-if="club.about" class="club__about-text">{{ club.about }}</p>
          <div v-if="club.rules.length" class="club__block">
            <h2>Club rules</h2>
            <ol>
              <li v-for="(rule, index) in club.rules" :key="index">{{ rule }}</li>
            </ol>
          </div>
          <div v-if="scheduleText" class="club__block">
            <h2>Activity</h2>
            <p>{{ scheduleText }}</p>
            <p v-if="club.schedule.trainingSchedule">{{ club.schedule.trainingSchedule }}</p>
          </div>
          <div v-if="placeText" class="club__block">
            <h2>Home court</h2>
            <p>{{ placeText }}</p>
          </div>
          <div v-if="club.tags.length" class="club__tags">
            <span v-for="tag in club.tags" :key="tag">#{{ tag }}</span>
          </div>
          <div v-if="contactLinks.length || club.contact.email" class="club__block">
            <h2>Contact</h2>
            <p v-if="club.contact.email">{{ club.contact.email }}</p>
            <p class="club__links">
              <a v-for="link in contactLinks" :key="link.label" :href="link.url" target="_blank" rel="noopener noreferrer">
                {{ link.label }}
              </a>
            </p>
          </div>
        </section>

        <div class="club__tabs">
          <SegmentTabs v-model="tab" :options="tabOptions" aria-label="Club content" />
        </div>

        <section class="club__content">
          <div v-if="!canSeeContent" class="club__locked">
            <ion-icon :icon="lockClosedOutline" aria-hidden="true" />
            <strong>This club is private</strong>
            <span>Request to join to see its posts, games, reels, and members.</span>
          </div>

          <template v-else-if="tab === 'POSTS'">
            <p v-if="posts.length === 0" class="club__empty">No club posts yet.</p>
            <div class="club__stack">
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
          </template>

          <template v-else-if="tab === 'GAMES'">
            <p v-if="games.length === 0" class="club__empty">No club games scheduled.</p>
            <div class="club__stack">
              <GameCard v-for="game in games" :key="game.id" :game="game" :now-ms="now" @join="joinGame" />
            </div>
          </template>

          <template v-else-if="tab === 'REELS'">
            <p v-if="reels.length === 0" class="club__empty">No club reels yet.</p>
            <div class="club__reels">
              <ReelThumb v-for="reel in reels" :key="reel.id" :reel="reel" />
            </div>
          </template>

          <p v-else-if="membersError" class="club__empty" role="alert">{{ membersError }}</p>
          <ul v-else class="club__members-list">
            <li v-for="member in members" :key="member.user.id" class="club__member">
              <UserAvatar :user="member.user" :size="40" />
              <span class="club__member-text">
                <strong>{{ member.user.displayName }}</strong>
                <span>Joined {{ formatTimeAgo(Date.parse(member.joinedAt), now) }}</span>
              </span>
              <span class="club__role" :class="{ 'club__role--staff': member.role !== 'MEMBER' }">
                {{ CLUB_ROLE_LABELS[member.role] }}
              </span>
            </li>
          </ul>
        </section>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, alertController, onIonViewWillEnter } from '@ionic/vue';
import { chatbubblesOutline, earthOutline, locationOutline, lockClosedOutline, peopleOutline, shareSocialOutline } from 'ionicons/icons';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PostCard from '@/components/feed/PostCard.vue';
import GameCard from '@/components/games/GameCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import ReelThumb from '@/components/reels/ReelThumb.vue';
import { useJoinGame } from '@/composables/useJoinGame';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { useClubsStore } from '@/stores/clubs';
import { useChatStore } from '@/stores/chat';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import type { ClubMemberRole } from '@/types/club';
import { getClubChatAccess, isServerClubId } from '@/utils/club-chat';
import { ACTIVITY_DAY_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/utils/club-form';
import { CLUB_ROLE_LABELS, type ClubJoinState, formatClubSlots, getClubJoinState, isClubFull } from '@/utils/clubs';
import { showLaterPhaseNotice, showNotice } from '@/utils/notice';
import { getSportVisual } from '@/utils/sports';
import { formatTimeAgo } from '@/utils/time';

type ClubTab = 'POSTS' | 'GAMES' | 'REELS' | 'MEMBERS';

const JOIN_LABELS: Record<ClubJoinState, string> = {
  JOIN: 'Join Club',
  REQUEST: 'Request to Join',
  REQUESTED: 'Requested',
  MEMBER: 'Joined',
  OWNER: 'Owner',
  BANNED: 'Unavailable',
  FULL: 'Club Full',
  INVITE_ONLY: 'Invite Only',
};
const DISABLED_STATES: readonly ClubJoinState[] = ['OWNER', 'MEMBER', 'BANNED', 'FULL', 'INVITE_ONLY'];

const ROLE_ORDER: Record<ClubMemberRole, number> = { OWNER: 0, ADMIN: 1, MODERATOR: 2, MEMBER: 3 };

const route = useRoute();
const router = useRouter();
/** Fixed per page instance; Ionic keeps earlier club pages cached while the route changes. */
const clubId = String(route.params.clubId ?? '');
const session = useSessionStore();
const clubsStore = useClubsStore();
const chatStore = useChatStore();
const postsStore = usePostsStore();
const gamesStore = useGamesStore();
const reelsStore = useReelsStore();
const { joinGame } = useJoinGame();
const { likePost, commentOnPost, sharePost } = usePostActions();
const now = useNow();

const tab = ref<ClubTab>('POSTS');
const lookup = ref<'loading' | 'found' | 'missing' | 'error'>('loading');
const lookupError = ref<string | null>(null);
const membersError = ref<string | null>(null);
const busy = ref(false);

const club = computed(() => clubsStore.byId(clubId));
const visual = computed(() => getSportVisual(club.value?.sport ?? 'Other'));
const joinState = computed<ClubJoinState>(() => (club.value ? getClubJoinState(club.value) : 'JOIN'));
const full = computed(() => !!club.value && isClubFull(club.value));
const primaryDisabled = computed(() => DISABLED_STATES.includes(joinState.value));
const primaryLabel = computed(() =>
  joinState.value === 'JOIN' && club.value?.viewerHasInvite ? 'Accept Invite' : JOIN_LABELS[joinState.value],
);
const canManage = computed(() => !!club.value && (club.value.viewerCanManageClub || club.value.viewerCanManageMembers));
const canSeeContent = computed(() => !!club.value && club.value.contentVisible);
const canOpenChat = computed(() => getClubChatAccess(club.value?.viewerMembership) === 'OPEN');

const scheduleText = computed(() => {
  const schedule = club.value?.schedule;

  if (!schedule?.day && !schedule?.startTime) {
    return '';
  }

  const time = [schedule.startTime, schedule.endTime].filter(Boolean).join('–');
  return [schedule.day ? ACTIVITY_DAY_LABELS[schedule.day] : null, time].filter(Boolean).join(' · ');
});
const placeText = computed(() =>
  club.value
    ? [club.value.homeCourt, club.value.barangay, club.value.city, club.value.country]
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join(', ')
    : '',
);
const contactLinks = computed(() => {
  const contact = club.value?.contact;

  if (!contact) {
    return [];
  }

  return [
    { label: 'Website', url: contact.websiteUrl },
    { label: 'Facebook', url: contact.facebookUrl },
    { label: 'Instagram', url: contact.instagramUrl },
    { label: 'TikTok', url: contact.tiktokUrl },
  ].filter((link): link is { label: string; url: string } => !!link.url);
});
const hasDetails = computed(
  () =>
    !!club.value &&
    club.value.contentVisible &&
    !!(
      club.value.about ||
      club.value.rules.length ||
      scheduleText.value ||
      club.value.tags.length ||
      contactLinks.value.length ||
      club.value.contact.email ||
      club.value.homeCourt
    ),
);

const inClub = (item: { club?: { id: string } | null }): boolean => item.club?.id === clubId;

const posts = computed(() =>
  postsStore.visiblePosts.filter(inClub).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
);
const games = computed(() =>
  gamesStore.games
    .filter((game) => inClub(game) && game.status !== 'CANCELLED')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
);
const reels = computed(() => reelsStore.feedReels.filter(inClub));
const members = computed(() =>
  [...(clubsStore.members[clubId] ?? [])].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
);

const tabOptions = computed(() => [
  { id: 'POSTS' as const, label: 'Posts' },
  { id: 'GAMES' as const, label: 'Games' },
  { id: 'REELS' as const, label: 'Reels' },
  { id: 'MEMBERS' as const, label: 'Members' },
]);

async function loadMembers(force = false): Promise<void> {
  const result = await clubsStore.loadMembers(clubId, force);
  membersError.value = result.ok ? null : result.message;
}

watch(tab, (value) => {
  if (value === 'MEMBERS') {
    void loadMembers();
  }
});

async function refresh(): Promise<void> {
  const result = await clubsStore.loadClub(clubId);
  lookup.value = result.status;
  lookupError.value = result.status === 'error' ? result.message : null;

  if (tab.value === 'MEMBERS') {
    await loadMembers(true);
  }
}

async function onPrimary(): Promise<void> {
  if (!club.value || busy.value) {
    return;
  }

  busy.value = true;

  try {
    if (joinState.value === 'REQUESTED') {
      const result = await clubsStore.leave(clubId, session.me);
      void showNotice(result.ok ? 'Request cancelled.' : result.message);
      return;
    }

    const result = await clubsStore.join(clubId, session.me);

    if (!result.ok) {
      void showNotice(result.message);
    } else {
      void showNotice(
        result.status === 'JOINED' ? `You joined ${club.value.name}.` : 'Request sent. An admin will review it.',
      );
    }
  } finally {
    busy.value = false;
  }
}

async function leave(): Promise<void> {
  busy.value = true;

  try {
    const result = await clubsStore.leave(clubId, session.me);
    void showNotice(result.ok ? 'You left the club.' : result.message);
  } finally {
    busy.value = false;
  }
}

function follow(): void {
  if (isServerClubId(clubId)) {
    void showLaterPhaseNotice('Following clubs');
    return;
  }

  void clubsStore.toggleFollow(clubId);
}

function openManage(): void {
  void router.push(`/clubs/${clubId}/manage`);
}

function openChat(): void {
  if (canOpenChat.value) {
    void router.push(`/chat/clubs/${clubId}`);
  }
}

async function shareClub(): Promise<void> {
  const currentClub = club.value;
  if (!currentClub) return;
  await chatStore.load();
  const conversations = chatStore.sortedConversations;
  if (conversations.length === 0) {
    void showNotice('Start a message conversation before sharing a club.');
    return;
  }
  const clubUrl = new URL(`/clubs/${encodeURIComponent(currentClub.id)}`, window.location.origin).href;
  const alert = await alertController.create({
    header: 'Share club to messages',
    subHeader: 'Choose a conversation',
    inputs: conversations.slice(0, 20).map((conversation, index) => ({
      type: 'radio' as const,
      label: conversation.partner.displayName,
      value: conversation.id,
      checked: index === 0,
    })),
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Send',
        handler: async (conversationId: unknown) => {
          if (typeof conversationId !== 'string') return false;
          const error = await chatStore.sendMessage(
            conversationId,
            `Check out ${currentClub.name} on GORA:\n${clubUrl}`,
          );
          if (error) {
            void showNotice(error);
            return false;
          }
          void showNotice(`Club sent to ${chatStore.getConversation(conversationId)?.partner.displayName ?? 'messages'}.`);
          return true;
        },
      },
    ],
  });
  await alert.present();
}

onIonViewWillEnter(() => {
  void refresh();
});

onMounted(() => {
  void session.load();
  void postsStore.load();
  void gamesStore.load();
  void reelsStore.load();
});
</script>

<style scoped>
.club__missing {
  margin: 24px 16px;
  color: var(--gora-muted);
}

.club__cover {
  position: relative;
  display: flex;
  height: 132px;
  align-items: center;
  justify-content: flex-end;
  padding-right: 24px;
  background-position: center;
  background-size: cover;
}

.club__cover-icon {
  color: rgba(255, 255, 255, 0.14);
  font-size: 110px;
}

.club__header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0 16px;
}

.club__avatar {
  position: relative;
  z-index: 1;
  margin-top: -38px;
  border: 3px solid var(--ion-background-color, #08131f);
}

.club__name {
  margin: 10px 0 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.club__handle {
  margin: 2px 0 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.club__members {
  margin: 10px 0 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.club__members strong {
  color: var(--ion-color-primary);
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

.club__slots {
  color: var(--gora-muted);
}

.club__full {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #ef5b5b;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.club__about {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 18px 16px 0;
  padding: 14px;
  border-radius: 16px;
  background: var(--gora-surface);
  font-size: 0.86rem;
}

.club__about-text {
  margin: 0;
  line-height: 1.45;
  white-space: pre-line;
}

.club__block h2 {
  margin: 0 0 4px;
  color: var(--gora-muted);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.club__block p,
.club__block ol {
  margin: 0;
}

.club__block ol {
  padding-left: 18px;
}

.club__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.club__tags span {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.club__links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.club__links a {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.club__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.club__facts li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.74rem;
}

.club__description {
  margin: 12px 0 0;
  font-size: 0.9rem;
  line-height: 1.45;
}

.club__actions {
  display: flex;
  width: 100%;
  gap: 8px;
  margin-top: 16px;
}

.club__primary,
.club__secondary {
  flex: 1;
  padding: 11px 14px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
}

.club__primary {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.club__primary:disabled {
  cursor: default;
}

.club__primary--requested,
.club__primary--member,
.club__primary--owner {
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.4);
  background: transparent;
  color: var(--ion-color-primary);
}

.club__primary--banned,
.club__primary--full,
.club__primary--invite-only {
  background: #1b2a37;
  color: #7d8a93;
}

.club__secondary:disabled {
  opacity: 0.6;
}

.club__secondary {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
}

.club__chat {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.club__chat:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.club__note {
  margin: 8px 0 0;
  color: var(--gora-muted);
  font-size: 0.74rem;
}

.club__tabs {
  margin: 20px 16px 0;
}

.club__content {
  padding: 16px 16px 32px;
}

.club__stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.club__reels {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.club__empty {
  margin: 0;
  color: #7d8a93;
  font-size: 0.85rem;
}

.club__locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed var(--gora-line-strong);
  border-radius: 16px;
  color: var(--gora-muted);
  font-size: 0.82rem;
  text-align: center;
}

.club__locked ion-icon {
  color: var(--ion-color-primary);
  font-size: 30px;
}

.club__locked strong {
  color: var(--ion-text-color);
}

.club__members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.club__member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--gora-surface);
}

.club__member-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: 0.88rem;
}

.club__member-text span {
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.club__role {
  padding: 3px 10px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  color: var(--gora-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.club__role--staff {
  border-color: rgba(var(--ion-color-primary-rgb), 0.4);
  color: var(--ion-color-primary);
}
</style>
