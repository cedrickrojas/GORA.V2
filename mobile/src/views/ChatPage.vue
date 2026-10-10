<template>
  <ion-page>
    <AppHeader />

    <ion-content :fullscreen="true">
      <div class="chat">
        <h1 class="chat__title">Messages</h1>
        <SegmentTabs v-model="section" :options="sectionOptions" />
        <p v-if="chatStore.error" class="chat__empty" role="alert">{{ chatStore.error }}</p>

        <template v-if="section === 'FRIENDS'">
          <p v-if="chatStore.loading && !chatStore.isLoaded" class="chat__empty" role="status">
            Loading conversations…
          </p>
          <p v-else-if="sortedConversations.length === 0" class="chat__empty">No conversations yet.</p>
          <ul v-else class="chat__list">
            <li v-for="conversation in sortedConversations" :key="conversation.id">
              <router-link :to="`/chat/${conversation.id}`" class="conversation">
                <UserAvatar :user="conversation.partner" :size="48" />
                <span class="conversation__text">
                  <strong>{{ conversation.partner.displayName }}</strong>
                  <span :class="{ 'conversation__last--unread': conversation.unreadCount > 0 }">
                    {{ directChatPreview(conversation, session.me?.id ?? null) }}
                  </span>
                </span>
                <span class="conversation__meta">
                  <time :datetime="conversation.lastMessageAt">{{ shortAgo(conversation.lastMessageAt) }}</time>
                  <span v-if="conversation.unreadCount > 0" class="conversation__unread">
                    {{ conversation.unreadCount }}
                  </span>
                </span>
              </router-link>
            </li>
          </ul>
        </template>

        <template v-else-if="section === 'CLUBS'">
          <p class="chat__hint">Official club chats. You're in every club chat where you're an active member.</p>
          <p v-if="clubChatStore.listError" class="chat__empty">{{ clubChatStore.listError }}</p>
          <p v-if="clubChats.length === 0 && !clubChatStore.loading" class="chat__empty">
            Join a club to chat with its members.
            <router-link to="/profile/clubs" class="chat__link">Find clubs</router-link>
          </p>
          <ul v-else class="chat__list">
            <li v-for="chat in clubChats" :key="chat.id">
              <router-link :to="`/chat/clubs/${chat.club.id}`" class="conversation conversation--club">
                <ClubAvatar :club="chat.club" :image-url="chat.club.profileImageUrl" :size="48" />
                <span class="conversation__text">
                  <strong>
                    {{ chat.club.name }}
                    <span class="conversation__tag">Club</span>
                  </strong>
                  <span :class="{ 'conversation__last--unread': chat.unreadCount > 0 }">
                    {{ clubChatPreview(chat, clubChatStore.viewerId(chat.club.id)) }}
                  </span>
                </span>
                <span class="conversation__meta">
                  <time :datetime="clubChatActivityAt(chat)">{{ shortAgo(clubChatActivityAt(chat)) }}</time>
                  <span v-if="chat.unreadCount > 0" class="conversation__unread">{{ chat.unreadCount }}</span>
                </span>
              </router-link>
            </li>
          </ul>
        </template>

        <template v-else>
          <h2 class="chat__subtitle">Message Requests</h2>
          <p class="chat__hint">People you are not friends with yet. Accept to start chatting.</p>
          <p v-if="requests.length === 0" class="chat__empty">No message requests.</p>
          <ul v-else class="chat__list">
            <li v-for="request in requests" :key="request.id" class="message-request">
              <UserAvatar :user="request.sender" :size="48" />
              <span class="message-request__body">
                <router-link :to="`/profile/${request.sender.username}`" class="message-request__name">
                  {{ request.sender.displayName }}
                </router-link>
                <q>{{ request.initialMessage }}</q>
                <span class="message-request__actions">
                  <button
                    type="button"
                    class="message-request__btn message-request__btn--primary"
                    @click="accept(request)"
                  >
                    Accept
                  </button>
                  <button type="button" class="message-request__btn" @click="remove(request)">Delete</button>
                </span>
              </span>
              <time :datetime="request.createdAt">{{ shortAgo(request.createdAt) }}</time>
            </li>
          </ul>

          <template v-if="chatStore.outgoingRequests.length > 0">
            <h2 class="chat__subtitle">Sent</h2>
            <ul class="chat__list">
              <li v-for="request in chatStore.outgoingRequests" :key="request.id">
                <router-link :to="`/chat/request/${request.recipient.id}`" class="conversation">
                  <UserAvatar :user="request.recipient" :size="48" />
                  <span class="conversation__text">
                    <strong>{{ request.recipient.displayName }}</strong>
                    <span>You: {{ request.initialMessage }}</span>
                    <span class="message-request__status">Waiting for them to accept.</span>
                  </span>
                  <span class="conversation__meta">
                    <time :datetime="request.createdAt">{{ shortAgo(request.createdAt) }}</time>
                  </span>
                </router-link>
              </li>
            </ul>
          </template>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { IonContent, IonPage, onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { useNow } from '@/composables/useNow';
import { useChatStore } from '@/stores/chat';
import { useClubChatStore } from '@/stores/club-chat';
import { useSessionStore } from '@/stores/session';
import type { MessageRequest } from '@/types/chat';
import { directChatPreview, type ChatSection } from '@/utils/chat';
import { clubChatActivityAt, clubChatPreview } from '@/utils/club-chat';
import { showNotice } from '@/utils/notice';
import { formatTimeAgo } from '@/utils/time';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const clubChatStore = useClubChatStore();
const session = useSessionStore();
const { sortedConversations, requests } = storeToRefs(chatStore);
const { chats: clubChats } = storeToRefs(clubChatStore);
const now = useNow();

const section = ref<ChatSection>('FRIENDS');

const sectionOptions = computed(() => [
  { id: 'FRIENDS' as const, label: 'Friends', count: chatStore.unreadCount },
  { id: 'CLUBS' as const, label: 'Clubs', count: clubChatStore.unreadCount },
  { id: 'REQUESTS' as const, label: 'Requests', count: requests.value.length },
]);

function shortAgo(iso: string): string {
  return formatTimeAgo(Date.parse(iso), now.value).replace(' ago', '');
}

async function accept(request: MessageRequest): Promise<void> {
  const conversationId = await chatStore.acceptRequest(request.id);

  if (conversationId) {
    void router.push(`/chat/${conversationId}`);
  }
}

async function remove(request: MessageRequest): Promise<void> {
  if (await chatStore.deleteRequest(request.id))
    void showNotice(`Deleted the request from ${request.sender.displayName}.`);
}

onMounted(() => {
  void chatStore.load();
  void session.load();
});

let poll: ReturnType<typeof setInterval> | undefined;
function stopPolling(): void {
  clearInterval(poll);
  poll = undefined;
}
onIonViewDidLeave(stopPolling);
onBeforeUnmount(stopPolling);
onIonViewWillEnter(() => {
  if (route.query.section === 'requests') {
    section.value = 'REQUESTS';
  }

  void clubChatStore.load();
  void chatStore.refresh();
  stopPolling();
  poll = setInterval(() => {
    if (document.visibilityState === 'visible') void chatStore.refresh();
  }, 5000);
});
</script>

<style scoped>
.chat {
  padding: 8px 16px 32px;
}

.chat__title {
  margin: 4px 0 12px;
  font-size: 1.4rem;
  font-weight: 800;
}

.chat__hint,
.chat__empty {
  margin: 14px 0 4px;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.chat__subtitle {
  margin: 20px 0 0;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chat__link {
  margin-left: 4px;
  color: var(--ion-color-primary);
  font-weight: 600;
  text-decoration: none;
}

.conversation__text .conversation__tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.4);
  border-radius: 999px;
  color: var(--ion-color-primary);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  vertical-align: 2px;
}

.message-request__name {
  color: var(--ion-text-color);
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
}

.message-request__status {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.chat__list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.conversation {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  color: var(--ion-text-color);
  text-decoration: none;
}

.conversation__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.conversation__text strong {
  font-size: 0.92rem;
}

.conversation__text span {
  overflow: hidden;
  color: var(--gora-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation__text .conversation__last--unread {
  color: var(--ion-text-color);
  font-weight: 600;
}

.conversation__meta {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.conversation__unread {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}

.message-request {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--gora-line);
}

.message-request time {
  flex-shrink: 0;
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.message-request__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.message-request__body strong {
  font-size: 0.92rem;
}

.message-request__body q {
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.message-request__actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.message-request__btn {
  padding: 7px 16px;
  border: 1px solid var(--gora-line);
  border-radius: 10px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}

.message-request__btn--primary {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
</style>
