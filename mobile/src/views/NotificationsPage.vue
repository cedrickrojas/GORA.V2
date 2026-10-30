<template>
  <ion-page>
    <SubPageHeader title="Notifications" back-href="/home">
      <template #end>
        <ion-button
          v-if="unreadCount > 0"
          fill="clear"
          size="small"
          :disabled="isMarkingAll || !!readingId"
          @click="notificationsStore.markAllRead()"
        >
          Mark all read
        </ion-button>
      </template>
    </SubPageHeader>

    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ion-refresh="refresh($event)"
        ><ion-refresher-content
      /></ion-refresher>
      <div v-if="error" class="notifications__feedback" role="alert">
        <p>{{ error }}</p>
        <ion-button
          fill="clear"
          :disabled="isLoading"
          @click="notificationsStore.load(true)"
          >Try again</ion-button
        >
      </div>
      <div
        v-if="isLoading && !isLoaded"
        class="notifications__empty"
        role="status"
      >
        <ion-spinner />
        <p>Loading notifications…</p>
      </div>
      <p
        v-else-if="isLoaded && items.length === 0"
        class="notifications__empty"
      >
        You're all caught up.
      </p>
      <ul v-else class="notifications">
        <li v-for="item in items" :key="item.id" class="notifications__item">
          <button
            type="button"
            class="notification"
            :class="{ 'notification--unread': !item.read }"
            :disabled="isMarkingAll"
            @click="openNotification(item)"
          >
            <span
              class="notification__icon"
              :class="`notification__icon--${item.type.toLowerCase()}`"
            >
              <UserAvatar v-if="item.actor" :user="item.actor" :size="44" />
              <ion-icon
                v-else
                :icon="NOTIFICATION_ICONS[item.type] || notificationsOutline"
                aria-hidden="true"
              />
              <span v-if="item.actor" class="notification__type-dot">
                <ion-icon
                  :icon="NOTIFICATION_ICONS[item.type] || notificationsOutline"
                  aria-hidden="true"
                />
              </span>
            </span>
            <span class="notification__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.body }}</span>
              <time :datetime="item.createdAt">{{
                formatTimeAgo(Date.parse(item.createdAt), now)
              }}</time>
            </span>
            <span
              v-if="!item.read"
              class="notification__unread"
              aria-label="Unread"
            />
          </button>
          <div v-if="hasNotificationAction(item)" class="notification__actions">
            <button
              v-if="item.type === 'FRIEND_REQUEST'"
              type="button"
              class="notification__action notification__action--primary"
              :disabled="isMarkingAll || !!actionBusyId"
              @click="acceptFriend(item)"
            >
              {{ actionBusyId === item.id ? 'Accepting…' : 'Accept' }}
            </button>
            <button
              v-else-if="item.type === 'GAME_JOIN_REQUEST'"
              type="button"
              class="notification__action notification__action--primary"
              :disabled="isMarkingAll || !!actionBusyId"
              @click="acceptGameRequest(item)"
            >
              {{ actionBusyId === item.id ? 'Accepting…' : 'Accept Join Request' }}
            </button>
            <template v-else-if="item.type === 'GAME_LEAVE_REQUEST'">
              <button type="button" class="notification__action notification__action--primary" :disabled="isMarkingAll || !!actionBusyId" @click="respondToLeave(item, 'approve')">
                {{ actionBusyId === item.id ? 'Removing…' : 'Approve & Remove Player' }}
              </button>
              <button type="button" class="notification__action" :disabled="isMarkingAll || !!actionBusyId" @click="respondToLeave(item, 'reject')">Decline Request</button>
            </template>
            <button
              v-else-if="item.type === 'GAME_JOIN_REJECTED'"
              type="button"
              class="notification__action notification__action--primary"
              :disabled="isMarkingAll || !!actionBusyId"
              @click="requestToJoinAgain(item)"
            >
              {{ actionBusyId === item.id ? 'Sending…' : 'Join Game' }}
            </button>
          </div>
        </li>
      </ul>
      <ion-button
        v-if="hasMore"
        expand="block"
        fill="clear"
        :disabled="isLoading"
        @click="notificationsStore.loadMore()"
        >{{ isLoading ? "Loading…" : "Load more" }}</ion-button
      >
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  onIonViewWillEnter,
} from "@ionic/vue";
import {
  checkmarkCircleOutline,
  flagOutline,
  heartOutline,
  personAddOutline,
  ribbonOutline,
  trophyOutline,
  notificationsOutline,
  chatbubbleOutline,
  mailOutline,
  closeCircleOutline,
  peopleOutline,
} from "ionicons/icons";
import UserAvatar from "@/components/common/UserAvatar.vue";
import SubPageHeader from "@/components/layout/SubPageHeader.vue";
import { useNow } from "@/composables/useNow";
import { useNotificationsStore } from "@/stores/notifications";
import { useFriendsStore } from "@/stores/friends";
import { useGamesStore } from "@/stores/games";
import { useJoinRequestsStore } from "@/stores/join-requests";
import { useGamePlayersStore } from "@/stores/game-players";
import type { AppNotification, NotificationType } from "@/types/notification";
import { joinRequestAction } from "@/utils/join-requests";
import { formatTimeAgo } from "@/utils/time";
import { showNotice } from "@/utils/notice";

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  GAME_JOIN_REQUEST: flagOutline,
  GAME_LEAVE_REQUEST: closeCircleOutline,
  GAME_LEAVE_APPROVED: checkmarkCircleOutline,
  GAME_LEAVE_REJECTED: closeCircleOutline,
  GAME_ATTENDANCE_CONFIRMED: checkmarkCircleOutline,
  GAME_NO_SHOW_REPORTED: closeCircleOutline,
  GAME_JOIN_ACCEPTED: checkmarkCircleOutline,
  GAME_JOIN_REJECTED: closeCircleOutline,
  GAME_FULL: peopleOutline,
  GAME_CANCELLED: closeCircleOutline,
  GAME_COMPLETED: trophyOutline,
  BADGE_UNLOCKED: ribbonOutline,
  FRIEND_REQUEST: personAddOutline,
  FRIEND_ACCEPTED: checkmarkCircleOutline,
  NEW_MESSAGE: chatbubbleOutline,
  MESSAGE_REQUEST: chatbubbleOutline,
  POST_LIKE: heartOutline,
  POST_COMMENT: chatbubbleOutline,
  REEL_LIKE: heartOutline,
  REEL_COMMENT: chatbubbleOutline,
  STORY_REPLY: chatbubbleOutline,
  LIVE_STARTED: notificationsOutline,
  NEW_FOLLOWER: personAddOutline,
  HELP_REQUEST_RECEIVED: mailOutline,
  HELP_REQUEST_UPDATED: checkmarkCircleOutline,
};

const router = useRouter();
const notificationsStore = useNotificationsStore();
const friendsStore = useFriendsStore();
const gamesStore = useGamesStore();
const joinRequestsStore = useJoinRequestsStore();
const gamePlayersStore = useGamePlayersStore();
const actionBusyId = ref<string | null>(null);
const {
  items,
  unreadCount,
  error,
  isLoaded,
  isLoading,
  hasMore,
  readingId,
  isMarkingAll,
} = storeToRefs(notificationsStore);
const now = useNow();

function gameIdFor(item: AppNotification): string | null {
  const match = item.link?.match(/^\/games\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function hasNotificationAction(item: AppNotification): boolean {
  if (item.type === 'FRIEND_REQUEST') return item.actor !== null;
  if (item.type === 'GAME_JOIN_REQUEST') return item.actor !== null && gameIdFor(item) !== null;
  if (item.type === 'GAME_LEAVE_REQUEST') return item.actor !== null && gameIdFor(item) !== null;
  return item.type === 'GAME_JOIN_REJECTED' && gameIdFor(item) !== null;
}

async function completeNotificationAction(item: AppNotification, message: string): Promise<void> {
  await notificationsStore.markRead(item.id);
  void showNotice(message);
  void notificationsStore.load(true);
}

async function acceptFriend(item: AppNotification): Promise<void> {
  const actor = item.actor;
  if (!actor || actionBusyId.value) return;
  actionBusyId.value = item.id;
  try {
    await friendsStore.refresh();
    const request = friendsStore.requestWith(actor.id);
    if (!request || request.direction !== 'RECEIVED') {
      void showNotice('This friend request is no longer pending.');
      void notificationsStore.load(true);
      return;
    }
    if (await friendsStore.accept(request.id)) {
      await completeNotificationAction(item, `You and ${actor.displayName} are now friends.`);
    } else {
      void showNotice(friendsStore.error ?? 'Could not accept this friend request.');
    }
  } finally {
    actionBusyId.value = null;
  }
}

async function acceptGameRequest(item: AppNotification): Promise<void> {
  const gameId = gameIdFor(item);
  const actor = item.actor;
  if (!gameId || !actor || actionBusyId.value) return;
  actionBusyId.value = item.id;
  try {
    const gameResult = await gamesStore.fetchGame(gameId);
    if (!gameResult.ok) {
      void showNotice(gameResult.message);
      return;
    }
    const requestsResult = await joinRequestsStore.fetchGameJoinRequests(gameId);
    if (!requestsResult.ok) {
      void showNotice(requestsResult.message);
      return;
    }
    const request = joinRequestsStore.gameJoinRequests(gameId).find(
      (candidate) => candidate.userId === actor.id && candidate.status === 'PENDING',
    );
    if (!request) {
      void showNotice('This join request is no longer pending.');
      void notificationsStore.load(true);
      return;
    }
    const result = await joinRequestsStore.acceptJoinRequest(gameId, request.id);
    if (result.ok) await completeNotificationAction(item, `${actor.displayName} joined the game.`);
    else void showNotice(result.message);
  } finally {
    actionBusyId.value = null;
  }
}

async function respondToLeave(item: AppNotification, action: 'approve' | 'reject'): Promise<void> {
  const gameId = gameIdFor(item);
  const actor = item.actor;
  if (!gameId || !actor || actionBusyId.value) return;
  actionBusyId.value = item.id;
  try {
    const result = await gamePlayersStore.respondToLeaveRequest(gameId, actor.id, action);
    if (result.ok) await completeNotificationAction(item, action === 'approve' ? `${actor.displayName} was removed from the game. 1 GORA point was deducted.` : 'Leave request declined. The player remains in the game.');
    else void showNotice(result.message);
  } finally {
    actionBusyId.value = null;
  }
}

async function requestToJoinAgain(item: AppNotification): Promise<void> {
  const gameId = gameIdFor(item);
  if (!gameId || actionBusyId.value) return;
  actionBusyId.value = item.id;
  try {
    const gameResult = await gamesStore.fetchGame(gameId);
    if (!gameResult.ok) {
      void showNotice(gameResult.message);
      return;
    }
    await Promise.all([
      joinRequestsStore.fetchMyJoinRequest(gameId),
      gamePlayersStore.fetchMyParticipation(gameId),
    ]);
    const game = gamesStore.gameById(gameId);
    if (!game) {
      void showNotice('This game is no longer available.');
      return;
    }
    const action = joinRequestAction(
      { ...game, isPlayer: game.isPlayer, isHost: game.isHost },
      joinRequestsStore.myJoinRequest(gameId),
      gamePlayersStore.participationOf(gameId),
    );
    if (action.kind !== 'request') {
      void showNotice(action.kind === 'closed' ? action.label : 'You cannot join this game right now.');
      return;
    }
    const result = await joinRequestsStore.createJoinRequest(gameId, null);
    if (!result.ok) {
      void showNotice(result.message);
      return;
    }
    const request = joinRequestsStore.myJoinRequest(gameId);
    await completeNotificationAction(
      item,
      request?.status === 'ACCEPTED' ? 'You joined the game.' : 'Your join request was sent.',
    );
  } finally {
    actionBusyId.value = null;
  }
}

async function openNotification(item: AppNotification): Promise<void> {
  if (!(await notificationsStore.markRead(item.id))) return;

  if (item.link) {
    void router.push(item.link);
  }
}

async function refresh(event: CustomEvent): Promise<void> {
  try {
    await notificationsStore.load(true);
  } finally {
    await (event.target as HTMLIonRefresherElement).complete();
  }
}
onIonViewWillEnter(() => {
  void notificationsStore.load(true);
});

onMounted(() => {
  void notificationsStore.load();
});
</script>

<style scoped>
.notifications {
  margin: 0;
  padding: 8px 0 32px;
  list-style: none;
}

.notifications__item { border-bottom: 1px solid var(--gora-line); }

.notifications__empty,
.notifications__feedback {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}
.notifications__feedback {
  color: var(--ion-color-danger);
}
.notification:disabled {
  cursor: progress;
  opacity: 0.7;
}

.notification {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.notification__actions {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px 72px;
}

.notification__action {
  min-height: 36px;
  padding: 8px 14px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
}

.notification__action--primary {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.notification__action:disabled { cursor: progress; opacity: 0.6; }

.notification--unread {
  background: rgba(214, 242, 92, 0.06);
}

.notification__icon {
  position: relative;
  display: flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  font-size: 22px;
}

.notification__icon--badge_unlocked {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.notification__type-dot {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--ion-background-color);
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 12px;
}

.notification__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
}

.notification__text span {
  color: var(--gora-muted);
}

.notification__text time {
  color: #7d8a93;
  font-size: 0.72rem;
}

.notification__unread {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--ion-color-primary);
}
</style>
