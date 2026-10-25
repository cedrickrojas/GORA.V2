<template>
  <header class="desktop-nav">
    <div class="desktop-nav__start">
      <button
        type="button"
        class="desktop-nav__avatar"
        aria-label="Open account menu"
        aria-haspopup="menu"
        :aria-expanded="profileMenuEvent !== null"
        @click="profileMenuEvent = $event"
      >
        <UserAvatar v-if="currentUser" :user="currentUser" :size="34" />
      </button>
      <router-link to="/home" class="desktop-nav__wordmark" :title="GORA_TAGLINE">{{ GORA_NAME }}</router-link>
      <router-link to="/search" class="desktop-nav__search">
        <ion-icon :icon="searchOutline" aria-hidden="true" />
        <span>Search GORA</span>
      </router-link>
    </div>

    <nav class="desktop-nav__tabs" aria-label="Main">
      <template v-for="tab in MAIN_TAB_LINKS" :key="tab.to">
        <button
          v-if="tab.to === '/create'"
          type="button"
          class="desktop-nav__tab"
          aria-label="Create"
          title="Create"
          @click="openCreateMenu"
        >
          <span class="desktop-nav__create"><ion-icon :icon="tab.icon" aria-hidden="true" /></span>
        </button>
        <router-link
          v-else
          :to="tab.to"
          class="desktop-nav__tab"
          :class="{ 'desktop-nav__tab--active': isTabActive(tab, route.path) }"
          :aria-label="tab.label"
          :aria-current="isTabActive(tab, route.path) ? 'page' : undefined"
          :title="tab.label"
        >
          <ion-icon :icon="tab.icon" aria-hidden="true" />
          <span v-if="tab.to === '/chat' && chatStore.badgeCount > 0" class="desktop-nav__badge" aria-hidden="true">
            {{ chatStore.badgeCount > 9 ? '9+' : chatStore.badgeCount }}
          </span>
        </router-link>
      </template>
    </nav>

    <div class="desktop-nav__end">
      <button
        type="button"
        class="desktop-nav__icon"
        :aria-label="filters.isActive ? 'Filters, active' : 'Filters'"
        aria-haspopup="dialog"
        :aria-expanded="filterEvent !== null"
        @click="filterEvent = $event"
      >
        <ion-icon :icon="optionsOutline" aria-hidden="true" />
        <span v-if="filters.isActive" class="desktop-nav__dot" aria-hidden="true" />
      </button>
      <router-link
        to="/notifications"
        class="desktop-nav__icon"
        :aria-label="unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'"
      >
        <ion-icon :icon="notificationsOutline" aria-hidden="true" />
        <span v-if="unreadCount > 0" class="desktop-nav__badge" aria-hidden="true">
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </router-link>
    </div>

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
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink, useRoute } from 'vue-router';
import { IonIcon, IonPopover } from '@ionic/vue';
import { notificationsOutline, optionsOutline, searchOutline } from 'ionicons/icons';
import { GORA_NAME, GORA_TAGLINE } from '@/constants/brand';
import UserAvatar from '@/components/common/UserAvatar.vue';
import FilterPanel from '@/components/layout/FilterPanel.vue';
import ProfileDropdown from '@/components/layout/ProfileDropdown.vue';
import { useCreateMenu } from '@/composables/useCreateMenu';
import { useChatStore } from '@/stores/chat';
import { useFiltersStore } from '@/stores/filters';
import { useNotificationsStore } from '@/stores/notifications';
import { useProfileStore } from '@/stores/profile';
import { useSessionStore } from '@/stores/session';
import { MAIN_TAB_LINKS, isTabActive } from '@/utils/navigation';

const route = useRoute();
const sessionStore = useSessionStore();
const notificationsStore = useNotificationsStore();
const chatStore = useChatStore();
const filters = useFiltersStore();
const profileStore = useProfileStore();
const { openCreateMenu } = useCreateMenu();
/** The signed-in account; the demo user only until the account has loaded. */
const currentUser = computed(() => profileStore.account ?? sessionStore.currentUser);
const { unreadCount } = storeToRefs(notificationsStore);

const profileMenuEvent = ref<Event | null>(null);
const filterEvent = ref<Event | null>(null);

onMounted(() => {
  void sessionStore.load();
  void notificationsStore.load();
});
</script>

<style scoped>
.desktop-nav {
  display: none;
}

@media (min-width: 1024px) {
  .desktop-nav {
    position: relative;
    z-index: 20;
    display: grid;
    height: 60px;
    flex-shrink: 0;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--gora-line);
    background: var(--ion-tab-bar-background);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    grid-template-columns: 1fr auto 1fr;
  }
}

.desktop-nav__start,
.desktop-nav__end {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.desktop-nav__end {
  justify-content: flex-end;
  gap: 4px;
}

.desktop-nav__avatar {
  display: flex;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  box-shadow: 0 0 0 2px var(--ion-color-primary);
  cursor: pointer;
}

.desktop-nav__wordmark {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  white-space: nowrap;
  color: var(--ion-text-color);
  font-size: 1.4rem;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.04em;
  text-decoration: none;
}

.desktop-nav__wordmark::after {
  display: inline-block;
  width: 4px;
  height: 18px;
  margin-left: 6px;
  background: var(--ion-color-primary);
  content: '';
  transform: skew(-14deg);
}

.desktop-nav__search {
  display: flex;
  width: 240px;
  min-width: 0;
  height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-radius: var(--gora-radius-control);
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.9rem;
  text-decoration: none;
}

.desktop-nav__search span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-nav__tabs {
  display: flex;
  height: 100%;
}

.desktop-nav__tab {
  position: relative;
  display: flex;
  width: clamp(64px, 7vw, 104px);
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  color: #7d8a93;
  cursor: pointer;
  font-size: 26px;
  text-decoration: none;
}

.desktop-nav__tab:hover {
  background: rgba(245, 247, 242, 0.05);
}

.desktop-nav__tab--active {
  color: var(--ion-color-primary);
}

.desktop-nav__tab--active::after {
  position: absolute;
  right: 8px;
  bottom: 0;
  left: 8px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--ion-color-primary);
  content: '';
}

.desktop-nav__create {
  display: flex;
  width: 40px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: var(--gora-radius-control);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 24px;
}

.desktop-nav__icon {
  position: relative;
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font-size: 22px;
}

.desktop-nav__dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--gora-surface);
  border-radius: 50%;
  background: var(--ion-color-primary);
}

.desktop-nav__badge {
  position: absolute;
  top: 6px;
  left: calc(50% + 4px);
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid var(--ion-tab-bar-background);
  border-radius: 999px;
  background: #ff5a5f;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
}

.desktop-nav__icon .desktop-nav__badge {
  top: -4px;
  left: auto;
  right: -4px;
}
</style>
