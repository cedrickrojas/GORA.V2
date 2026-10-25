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
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="notification"
            :class="{ 'notification--unread': !item.read }"
            :disabled="isMarkingAll || !!readingId"
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
import { onMounted } from "vue";
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
  closeCircleOutline,
  peopleOutline,
} from "ionicons/icons";
import UserAvatar from "@/components/common/UserAvatar.vue";
import SubPageHeader from "@/components/layout/SubPageHeader.vue";
import { useNow } from "@/composables/useNow";
import { useNotificationsStore } from "@/stores/notifications";
import type { AppNotification, NotificationType } from "@/types/notification";
import { formatTimeAgo } from "@/utils/time";

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  GAME_JOIN_REQUEST: flagOutline,
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
};

const router = useRouter();
const notificationsStore = useNotificationsStore();
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
