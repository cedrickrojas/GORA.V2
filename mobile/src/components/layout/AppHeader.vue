<template>
  <ion-header class="ion-no-border app-header" :class="{ 'app-header--main': !title && !backHref }">
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-back-button v-if="backHref" :default-href="backHref" />
        <button
          v-else
          type="button"
          class="app-header__avatar"
          aria-label="Open account menu"
          aria-haspopup="menu"
          :aria-expanded="profileMenuEvent !== null"
          @click="profileMenuEvent = $event"
        >
          <UserAvatar v-if="currentUser" :user="currentUser" :size="34" />
        </button>
      </ion-buttons>

      <ion-title v-if="title" class="app-header__title">{{ title }}</ion-title>
      <ion-title v-else class="app-header__wordmark"
        ><span class="app-header__brand">{{ GORA_NAME }}</span></ion-title
      >

      <ion-buttons slot="end">
        <button
          type="button"
          class="app-header__icon"
          :aria-label="filters.isActive ? 'Filters, active' : 'Filters'"
          aria-haspopup="dialog"
          :aria-expanded="filterEvent !== null"
          @click="filterEvent = $event"
        >
          <ion-icon :icon="optionsOutline" aria-hidden="true" />
          <span v-if="filters.isActive" class="app-header__dot" aria-hidden="true" />
        </button>
        <router-link
          to="/notifications"
          class="app-header__icon"
          :aria-label="unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'"
        >
          <ion-icon :icon="notificationsOutline" aria-hidden="true" />
          <span v-if="unreadCount > 0" class="app-header__badge" aria-hidden="true">
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </router-link>
      </ion-buttons>
    </ion-toolbar>

    <ion-popover
      class="gora-popover gora-popover--menu"
      :is-open="profileMenuEvent !== null"
      :event="profileMenuEvent"
      side="bottom"
      alignment="start"
      @did-dismiss="profileMenuEvent = null"
    >
      <ProfileDropdown :user="currentUser" @navigate="profileMenuEvent = null" />
    </ion-popover>

    <ion-popover
      class="gora-popover gora-popover--filter"
      :is-open="filterEvent !== null"
      :event="filterEvent"
      side="bottom"
      alignment="end"
      @did-dismiss="filterEvent = null"
    >
      <FilterPanel @done="filterEvent = null" />
    </ion-popover>
  </ion-header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { IonBackButton, IonButtons, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar } from '@ionic/vue';
import { notificationsOutline, optionsOutline } from 'ionicons/icons';
import { GORA_NAME } from '@/constants/brand';
import UserAvatar from '@/components/common/UserAvatar.vue';
import FilterPanel from '@/components/layout/FilterPanel.vue';
import ProfileDropdown from '@/components/layout/ProfileDropdown.vue';
import { useFiltersStore } from '@/stores/filters';
import { useNotificationsStore } from '@/stores/notifications';
import { useProfileStore } from '@/stores/profile';
import { useSessionStore } from '@/stores/session';

/** Sub pages pass both: a back button replaces the avatar and the title replaces the wordmark. */
defineProps<{ title?: string; backHref?: string }>();

const sessionStore = useSessionStore();
const profileStore = useProfileStore();
const notificationsStore = useNotificationsStore();
const filters = useFiltersStore();
/** The signed-in account; the demo user only until the account has loaded. */
const currentUser = computed(() => profileStore.account ?? sessionStore.currentUser);
const { unreadCount } = storeToRefs(notificationsStore);

/** The click that opened each popover, used to anchor it. Null when closed. */
const profileMenuEvent = ref<Event | null>(null);
const filterEvent = ref<Event | null>(null);

onMounted(() => {
  void sessionStore.load();
  void notificationsStore.load();
});
</script>

<style scoped>
.app-header ion-toolbar {
  --padding-start: max(12px, calc((100% - var(--gora-column)) / 2));
  --padding-end: max(8px, calc((100% - var(--gora-column)) / 2));
}

/* On desktop the top bar (DesktopTopNav) carries the avatar, filter, and bell. */
@media (min-width: 1024px) {
  .app-header--main {
    display: none;
  }
}

.app-header__wordmark {
  font-size: 1.35rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.04em;
  text-align: center;
}

.app-header__brand {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.app-header__brand::after {
  display: inline-block;
  width: 4px;
  height: 16px;
  margin-left: 6px;
  background: var(--ion-color-primary);
  content: '';
  transform: skew(-14deg);
}

.app-header__title {
  font-size: 1.05rem;
  font-weight: 700;
}

.app-header__avatar {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  box-shadow: 0 0 0 2px var(--ion-color-primary);
  cursor: pointer;
}

.app-header__icon {
  position: relative;
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ion-text-color);
  cursor: pointer;
  font-size: 24px;
}

.app-header__dot {
  position: absolute;
  top: 8px;
  right: 7px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--ion-background-color);
  border-radius: 50%;
  background: var(--ion-color-primary);
}

.app-header__badge {
  position: absolute;
  top: 3px;
  right: 1px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid var(--ion-background-color);
  border-radius: 999px;
  background: #ff5a5f;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
}
</style>
