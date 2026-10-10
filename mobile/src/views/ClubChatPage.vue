<template>
  <ion-page ref="pageRef" :style="{ bottom: `${keyboardInset}px` }">
    <ion-header class="ion-no-border">
      <ion-toolbar class="club-chat__toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/chat" />
        </ion-buttons>
        <component
          :is="clubPageLink ? 'router-link' : 'div'"
          v-if="chat"
          :to="clubPageLink ?? undefined"
          class="club-chat__identity"
        >
          <ClubAvatar :club="chat.club" :image-url="chat.club.profileImageUrl" :size="40" />
          <span class="club-chat__identity-text">
            <strong>{{ chat.club.name }}</strong>
            <span>Members: {{ chat.memberCount }}</span>
          </span>
        </component>
        <ion-title v-else>Club Chat</ion-title>
      </ion-toolbar>
      <div v-if="chat" class="club-chat__banner" :style="{ background: visual.gradient }">
        <ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" />
        <span>Official Club Chat</span>
      </div>
    </ion-header>

    <ion-content ref="contentRef">
      <p v-if="state.status === 'loading'" class="club-chat__state">Loading the club chat…</p>

      <div v-else-if="state.status !== 'open'" class="club-chat__blocked">
        <ion-icon :icon="lockClosedOutline" aria-hidden="true" />
        <strong>{{ blockedTitle }}</strong>
        <span>{{ blockedMessage }}</span>
        <button v-if="state.status === 'error'" type="button" class="club-chat__retry" @click="openChat">Try again</button>
        <router-link v-else-if="clubPageLink" :to="clubPageLink" class="club-chat__retry">View club</router-link>
      </div>

      <template v-else-if="chat">
        <button v-if="clubChatStore.hasOlder(clubId)" type="button" class="club-chat__older" @click="loadOlder">
          Load earlier messages
        </button>
        <p class="club-chat__intro">
          The official chat of <strong>{{ chat.club.name }}</strong>. Every active member of the club is here.
        </p>
        <ol class="club-chat__thread">
          <li
            v-for="(message, index) in messages"
            :key="message.id"
            class="club-message"
            :class="message.sender.id === viewerId ? 'club-message--mine' : 'club-message--theirs'"
          >
            <UserAvatar
              v-if="message.sender.id !== viewerId"
              :user="message.sender"
              :size="30"
              class="club-message__avatar"
              :class="{ 'club-message__avatar--hidden': !startsGroup(index) }"
            />
            <div class="club-message__body">
              <router-link
                v-if="message.sender.id !== viewerId && startsGroup(index)"
                :to="`/profile/${message.sender.username}`"
                class="club-message__sender"
              >
                {{ message.sender.displayName }}
              </router-link>
              <p class="club-message__bubble">{{ message.content }}</p>
              <time :datetime="message.createdAt">{{ formatTimeAgo(Date.parse(message.createdAt), now) }}</time>
            </div>
          </li>
        </ol>
      </template>
    </ion-content>

    <ion-footer v-if="state.status === 'open' && chat?.permissions.canSend" class="ion-no-border club-chat__footer">
      <ChatComposer
        v-model="draft"
        label="Message the club"
        :max-length="CLUB_CHAT_MESSAGE_MAX_LENGTH"
        :sending="sending"
        @send="sendDraft"
        @focus="scrollToLatest(0)"
      />
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue';
import { lockClosedOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useNow } from '@/composables/useNow';
import { useChatKeyboard } from '@/composables/useChatKeyboard';
import { type ClubChatOpenResult, useClubChatStore } from '@/stores/club-chat';
import { useClubsStore } from '@/stores/clubs';
import { CLUB_CHAT_MESSAGE_MAX_LENGTH, CLUB_CHAT_MISSING_MESSAGE } from '@/utils/club-chat';
import { showNotice } from '@/utils/notice';
import { getSportVisual } from '@/utils/sports';
import { formatTimeAgo } from '@/utils/time';

const route = useRoute();
/** Fixed per page instance; Ionic keeps earlier chat pages cached while the route changes. */
const clubId = String(route.params.clubId ?? '');
const clubChatStore = useClubChatStore();
const clubsStore = useClubsStore();
const now = useNow();

const state = ref<ClubChatOpenResult | { status: 'loading' }>({ status: 'loading' });
const draft = ref('');
const sending = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const pageRef = ref<InstanceType<typeof IonPage> | null>(null);
const { keyboardInset } = useChatKeyboard(pageRef, () => { void scrollToLatest(0); });

const chat = computed(() => (state.value.status === 'open' ? clubChatStore.getChat(clubId) : undefined));
const messages = computed(() => clubChatStore.getMessages(clubId));
const viewerId = computed(() => clubChatStore.viewerId(clubId));
const visual = computed(() => getSportVisual(chat.value?.club.sport ?? 'Other'));
/** Only clubs the app can show have a club page to link to. */
const clubPageLink = computed(() => (clubsStore.byId(clubId) ? `/clubs/${clubId}` : null));

const blockedTitle = computed(() => {
  switch (state.value.status) {
    case 'denied':
      return 'Members only';
    case 'missing':
      return 'Chat not found';
    default:
      return "Couldn't open the chat";
  }
});

const blockedMessage = computed(() => {
  const current = state.value;

  if (current.status === 'denied' || current.status === 'error') {
    return current.message;
  }

  return CLUB_CHAT_MISSING_MESSAGE;
});

/** A new sender (or a gap of more than 5 minutes) starts a group with the sender's name. */
function startsGroup(index: number): boolean {
  const previous = messages.value[index - 1];
  const message = messages.value[index];

  return (
    !previous ||
    previous.sender.id !== message.sender.id ||
    Date.parse(message.createdAt) - Date.parse(previous.createdAt) > 5 * 60 * 1000
  );
}

async function scrollToLatest(duration = 200): Promise<void> {
  await nextTick();
  await contentRef.value?.$el.scrollToBottom(duration);
}

async function openChat(): Promise<void> {
  if (state.value.status !== 'open') {
    state.value = { status: 'loading' };
  }

  state.value = await clubChatStore.open(clubId);

  if (state.value.status === 'open') {
    void scrollToLatest(0);
  }
}

async function loadOlder(): Promise<void> {
  try {
    await clubChatStore.loadOlder(clubId);
  } catch {
    void showNotice("Couldn't load earlier messages. Try again.");
  }
}

async function sendDraft(): Promise<void> {
  if (sending.value) {
    return;
  }

  sending.value = true;
  const body = draft.value;
  const result = await clubChatStore.send(clubId, body);
  sending.value = false;

  if (result.ok) {
    if (draft.value === body) draft.value = '';
    void scrollToLatest();
    return;
  }

  if (result.denied) {
    state.value = { status: 'denied', message: result.message };
  }

  void showNotice(result.message);
}

onIonViewWillEnter(() => {
  void openChat();
});
</script>

<style scoped>
.club-chat__toolbar {
  --min-height: 60px;
}

.club-chat__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding-right: 12px;
  color: var(--ion-text-color);
  text-decoration: none;
}

.club-chat__identity-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.club-chat__identity-text strong {
  overflow: hidden;
  font-size: 0.98rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-chat__identity-text span {
  color: var(--gora-muted);
  font-size: 0.74rem;
}

.club-chat__banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 5px 12px;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.club-chat__banner ion-icon {
  font-size: 14px;
}

.club-chat__state {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.club-chat__blocked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 48px 16px;
  padding: 28px 16px;
  border: 1px dashed var(--gora-line-strong);
  border-radius: 16px;
  color: var(--gora-muted);
  font-size: 0.85rem;
  text-align: center;
}

.club-chat__blocked ion-icon {
  color: var(--ion-color-primary);
  font-size: 30px;
}

.club-chat__blocked strong {
  color: var(--ion-text-color);
}

.club-chat__retry {
  margin-top: 6px;
  padding: 8px 18px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
}

.club-chat__older {
  display: block;
  margin: 12px auto 0;
  padding: 6px 14px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
}

.club-chat__intro {
  margin: 16px 24px 4px;
  color: var(--gora-muted);
  font-size: 0.75rem;
  text-align: center;
}

.club-chat__thread {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 12px 16px 16px;
  list-style: none;
}

.club-message {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.club-message--mine {
  justify-content: flex-end;
}

.club-message__avatar--hidden {
  visibility: hidden;
}

.club-message__body {
  display: flex;
  max-width: 76%;
  flex-direction: column;
}

.club-message--mine .club-message__body {
  align-items: flex-end;
}

.club-message__sender {
  margin: 8px 0 2px 4px;
  color: var(--ion-color-primary);
  font-size: 0.72rem;
  font-weight: 700;
  text-decoration: none;
}

.club-message__bubble {
  margin: 0;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.club-message--theirs .club-message__bubble {
  border: 1px solid var(--gora-line);
  border-bottom-left-radius: 4px;
  background: var(--gora-surface);
}

.club-message--mine .club-message__bubble {
  border-bottom-right-radius: 4px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.club-message time {
  margin: 2px 4px 0;
  color: var(--gora-muted);
  font-size: 0.64rem;
}

.club-chat__footer {
  flex-shrink: 0;
  border-top: 1px solid var(--gora-line);
  background: var(--ion-background-color);
}
</style>
