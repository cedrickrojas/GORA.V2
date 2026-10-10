<template>
  <ion-page>
    <SubPageHeader title="Notifications" back-href="/home">
      <template #end>
        <ion-button v-if="unreadCount > 0" fill="clear" size="small" @click="notificationsStore.markAllRead()">
          Mark all read
        </ion-button>
      </template>
    </SubPageHeader>

    <ion-content :fullscreen="true">
      <p v-if="items.length === 0" class="notifications__empty">You're all caught up.</p>
      <ul v-else class="notifications">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="notification"
            :class="{ 'notification--unread': !item.read }"
            @click="openNotification(item)"
          >
            <span class="notification__icon" :class="`notification__icon--${item.type.toLowerCase()}`">
              <UserAvatar v-if="item.actor" :user="item.actor" :size="44" />
              <ion-icon v-else :icon="NOTIFICATION_ICONS[item.type]" aria-hidden="true" />
              <span v-if="item.actor" class="notification__type-dot">
                <ion-icon :icon="NOTIFICATION_ICONS[item.type]" aria-hidden="true" />
              </span>
            </span>
            <span class="notification__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.body }}</span>
              <time :datetime="item.createdAt">{{ formatTimeAgo(Date.parse(item.createdAt), now) }}</time>
            </span>
            <span v-if="!item.read" class="notification__unread" aria-label="Unread" />
          </button>
        </li>
      </ul>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/vue';
import {
  checkmarkCircleOutline,
  flagOutline,
  heartOutline,
  personAddOutline,
  ribbonOutline,
  trophyOutline,
} from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useNow } from '@/composables/useNow';
import { useNotificationsStore } from '@/stores/notifications';
import type { AppNotification, NotificationType } from '@/types/notification';
import { formatTimeAgo } from '@/utils/time';

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  JOIN_REQUEST: flagOutline,
  REQUEST_ACCEPTED: checkmarkCircleOutline,
  GAME_COMPLETED: trophyOutline,
  BADGE_UNLOCKED: ribbonOutline,
  FRIEND_REQUEST: personAddOutline,
  REEL_LIKED: heartOutline,
};

const router = useRouter();
const notificationsStore = useNotificationsStore();
const { items, unreadCount } = storeToRefs(notificationsStore);
const now = useNow();

function openNotification(item: AppNotification): void {
  notificationsStore.markRead(item.id);

  if (item.link) {
    void router.push(item.link);
  }
}

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

.notifications__empty {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
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
  background: rgba(var(--ion-color-primary-rgb), 0.06);
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
