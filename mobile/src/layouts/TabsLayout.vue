<template>
  <ion-page>
    <DirectCallOverlay />
    <ion-tabs>
      <DesktopTopNav slot="top" />
      <ion-router-outlet />
      <template v-if="showSidebars">
        <DesktopShortcuts />
        <DesktopContacts />
      </template>
      <ion-tab-bar v-if="!isMessageThread" slot="bottom" class="gora-tab-bar">
        <ion-tab-button tab="home" href="/home">
          <ion-icon :icon="homeOutline" aria-hidden="true" />
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="search" href="/search">
          <ion-icon :icon="searchOutline" aria-hidden="true" />
          <ion-label>Search</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="discover" href="/discover">
          <ion-icon :icon="compassOutline" aria-hidden="true" />
          <ion-label>Discover</ion-label>
        </ion-tab-button>
        <button type="button" class="tab-create" aria-label="Create" @click="openCreateMenu">
          <span class="tab-create__circle">
            <ion-icon :icon="add" aria-hidden="true" />
          </span>
          <span class="tab-create__label">Create</span>
        </button>
        <ion-tab-button tab="reels" href="/reels">
          <ion-icon :icon="playCircleOutline" aria-hidden="true" />
          <ion-label>Reels</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="chat" href="/chat">
          <ion-icon :icon="chatbubblesOutline" aria-hidden="true" />
          <ion-label>Chat</ion-label>
          <ion-badge v-if="chatStore.badgeCount > 0">{{
            chatStore.badgeCount > 9 ? '9+' : chatStore.badgeCount
          }}</ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/profile">
          <ion-icon :icon="personCircleOutline" aria-hidden="true" />
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonBadge, IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
import {
  add,
  chatbubblesOutline,
  compassOutline,
  homeOutline,
  personCircleOutline,
  playCircleOutline,
  searchOutline,
} from 'ionicons/icons';
import DesktopContacts from '@/components/layout/DesktopContacts.vue';
import DesktopShortcuts from '@/components/layout/DesktopShortcuts.vue';
import DesktopTopNav from '@/components/layout/DesktopTopNav.vue';
import DirectCallOverlay from '@/components/chat/DirectCallOverlay.vue';
import { useCreateMenu } from '@/composables/useCreateMenu';
import { useNotificationPolling } from '@/composables/useNotificationPolling';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useClubChatStore } from '@/stores/club-chat';

/** Feed pages get Facebook-style sidebars on wide screens (CSS decides the width). */
const SIDEBAR_PATHS = ['/home', '/discover'];

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { openCreateMenu } = useCreateMenu();
const chatStore = useChatStore();
const clubChatStore = useClubChatStore();
useNotificationPolling();

const showSidebars = computed(() => SIDEBAR_PATHS.includes(route.path));
// Conversation pages keep the composer directly above the keyboard.
const isMessageThread = computed(() =>
  ['chat-thread', 'chat-request', 'club-chat', 'post-details'].includes(String(route.name)),
);

// An API call that got 401 (expired or revoked token) ends the session; return to Log In
// and come back to this page afterwards.
watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated && route.matched.some((record) => record.meta.requiresAuth)) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } });
    }
  },
);

onMounted(() => {
  void chatStore.load();
  void clubChatStore.load();
});
</script>

<style scoped>
/* Seven items must fit a 320px-wide phone. */
.gora-tab-bar ion-tab-button {
  min-width: 0;
  --padding-start: 0;
  --padding-end: 0;
}

/* Desktop shows the same 7 tabs in DesktopTopNav instead. */
@media (min-width: 1024px) {
  .gora-tab-bar {
    display: none;
  }
}

.gora-tab-bar ion-label {
  font-size: 0.62rem;
}

.gora-tab-bar ion-badge {
  --background: #ef5b5b;
  --color: #fff;
}

.tab-create {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ion-color-primary);
  cursor: pointer;
}

.tab-create__circle {
  display: flex;
  width: 34px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: var(--gora-radius-control);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 22px;
}

.tab-create__label {
  font-size: 0.62rem;
}
</style>
