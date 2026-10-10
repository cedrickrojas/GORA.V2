<template>
  <ion-page>
    <SubPageHeader :title="partner?.displayName ?? 'Chat'" back-href="/chat">
      <template v-if="partner" #end>
        <router-link
          :to="`/profile/${partner.username}`"
          class="thread__profile"
          :aria-label="`View ${partner.displayName}'s profile`"
        >
          <UserAvatar :user="partner" :size="30" />
        </router-link>
      </template>
    </SubPageHeader>

    <ion-content ref="contentRef" :fullscreen="true">
      <p v-if="chatStore.error" class="thread__missing" role="alert">{{ chatStore.error }}</p>
      <p v-if="!partner" class="thread__missing">
        {{ fetching ? 'Loading conversation…' : 'This conversation is not available.' }}
      </p>
      <template v-else>
        <p v-if="isRequest" class="thread__notice" role="note">{{ requestNotice }}</p>
        <button
          v-if="!isRequest && chatStore.cursors[conversationId]"
          type="button"
          class="thread__older"
          :disabled="fetching"
          @click="loadOlder"
        >
          Load earlier messages
        </button>
        <ol class="thread">
          <li
            v-for="message in bubbles"
            :key="message.id"
            class="bubble"
            :class="message.mine ? 'bubble--mine' : 'bubble--theirs'"
          >
            <strong class="bubble__sender">{{ message.senderName }}</strong>
            <p>{{ message.body }}</p>
            <time :datetime="message.sentAt">{{ formatTimeAgo(Date.parse(message.sentAt), now) }}</time>
          </li>
        </ol>
      </template>
    </ion-content>

    <ion-footer v-if="partner" class="ion-no-border">
      <form class="composer" @submit.prevent="sendDraft">
        <input
          v-model="draft"
          class="composer__input"
          type="text"
          :placeholder="composerPlaceholder"
          :disabled="requestSent || sending"
          maxlength="1000"
          aria-label="Message"
        />
        <button
          type="submit"
          class="composer__send"
          :disabled="requestSent || sending || !currentUserId || !draft.trim()"
          aria-label="Send"
        >
          <ion-icon :icon="sendIcon" aria-hidden="true" />
        </button>
      </form>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonFooter, IonIcon, IonPage, onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';
import { send as sendIcon } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useNow } from '@/composables/useNow';
import { useChatStore } from '@/stores/chat';
import { useSessionStore } from '@/stores/session';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import type { MessageRequestResult } from '@/types/chat';
import { showNotice } from '@/utils/notice';
import { formatTimeAgo } from '@/utils/time';

interface Bubble {
  id: string;
  body: string;
  sentAt: string;
  mine: boolean;
  senderName: string;
}

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const sessionStore = useSessionStore();
const auth = useAuthStore();
const now = useNow();
const draft = ref('');
const sending = ref(false);
const fetching = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

/** Set on /chat/request/:userId (someone who isn't a friend). Ionic keeps one page per URL. */
const requestUserId = String(route.params.userId ?? '');
const isRequest = requestUserId !== '';

const conversationId = String(route.params.conversationId ?? '');
const conversation = computed(() => (isRequest ? undefined : chatStore.getConversation(conversationId)));
const outgoingRequest = computed(() => (isRequest ? chatStore.outgoingRequestTo(requestUserId) : undefined));
const partner = computed(() => (isRequest ? chatStore.requestRecipient(requestUserId) : conversation.value?.partner));
const currentUserId = computed(() => sessionStore.me?.id ?? '');
/** One message request per pair: after the first message, wait until they accept. */
const requestSent = computed(() => outgoingRequest.value !== undefined);

const bubbles = computed<Bubble[]>(() => {
  if (isRequest) {
    const request = outgoingRequest.value;

    return request
      ? [
          {
            id: request.id,
            body: request.initialMessage,
            sentAt: request.createdAt,
            mine: true,
            senderName: sessionStore.me?.displayName ?? 'You',
          },
        ]
      : [];
  }

  return chatStore.getMessages(conversationId).map((message) => ({
    id: message.id,
    body: message.body,
    sentAt: message.sentAt,
    mine: message.senderId === currentUserId.value,
    senderName:
      message.sender?.displayName ??
      (message.senderId === currentUserId.value ? sessionStore.me?.displayName : partner.value?.displayName) ??
      'Unknown sender',
  }));
});

const requestNotice = computed(() => {
  const name = partner.value?.displayName ?? 'them';

  return requestSent.value
    ? `Message request sent. ${name} will see it in Message Requests, and you can keep chatting once they accept.`
    : `You and ${name} aren't friends yet. Your first message goes to their Message Requests.`;
});

const composerPlaceholder = computed(() =>
  requestSent.value ? `Waiting for ${partner.value?.displayName ?? 'them'} to accept…` : 'Type a message...',
);

async function scrollToLatest(): Promise<void> {
  await nextTick();
  await contentRef.value?.$el.scrollToBottom(200);
}

async function sendRequest(): Promise<void> {
  const isCurrent = captureSession(auth);
  const recipient = partner.value;

  if (!recipient) {
    return;
  }

  const result = await chatStore.sendMessageRequest(recipient, draft.value, Date.now());
  if (!isCurrent()) return;
  const notices: Record<Exclude<MessageRequestResult, 'SENT'>, string> = {
    ALREADY_SENT: `Message request already sent to ${recipient.displayName}.`,
    THEY_ALREADY_ASKED: `${recipient.displayName} already sent you a message request. Accept it in Chat → Requests.`,
    EMPTY: 'Write a message first.',
    ERROR: chatStore.error ?? 'Could not send this message request.',
  };

  if (result !== 'SENT') {
    void showNotice(notices[result]);
    return;
  }

  draft.value = '';
  void scrollToLatest();
}

async function sendDraft(): Promise<void> {
  if (sending.value || !currentUserId.value || requestSent.value || !draft.value.trim()) return;
  const isCurrent = captureSession(auth);
  sending.value = true;
  try {
    if (isRequest) {
      await sendRequest();
      return;
    }
    const error = await chatStore.sendMessage(conversationId, draft.value, Date.now());
    if (!isCurrent()) return;
    if (error) {
      void showNotice(error);
      return;
    }
    draft.value = '';
    void scrollToLatest();
  } finally {
    if (isCurrent()) sending.value = false;
  }
}

watch(
  () => bubbles.value.at(-1)?.id,
  (value) => {
    if (value) {
      void scrollToLatest();
    }
  },
  { immediate: true },
);

onMounted(() => {
  void refreshThread();
  void sessionStore.load();
});

async function refreshThread(): Promise<void> {
  if (fetching.value) return;
  const isCurrent = captureSession(auth);
  fetching.value = true;
  try {
    if (isRequest) {
      await Promise.all([chatStore.refresh(), chatStore.loadRecipient(requestUserId)]);
      if (!isCurrent()) return;
      const accepted = chatStore.findDirectWith(requestUserId);
      if (accepted) await router.replace(`/chat/${accepted.id}`);
    } else await chatStore.loadThread(conversationId);
  } finally {
    if (isCurrent()) fetching.value = false;
  }
}

async function loadOlder(): Promise<void> {
  if (fetching.value) return;
  const isCurrent = captureSession(auth);
  fetching.value = true;
  try {
    await chatStore.loadThread(conversationId, true);
  } finally {
    if (isCurrent()) fetching.value = false;
  }
}

watch(
  () => auth.sessionVersion,
  () => {
    draft.value = '';
    sending.value = false;
    fetching.value = false;
  },
);
let poll: ReturnType<typeof setInterval> | undefined;
function stopPolling(): void {
  clearInterval(poll);
  poll = undefined;
}
onIonViewDidLeave(stopPolling);
onBeforeUnmount(stopPolling);
onIonViewWillEnter(() => {
  void refreshThread();
  stopPolling();
  poll = setInterval(() => {
    if (document.visibilityState === 'visible' && !sending.value) void refreshThread();
  }, 5000);
});
</script>

<style scoped>
.thread__profile {
  display: flex;
  margin-right: 10px;
  border-radius: 50%;
  color: inherit;
  text-decoration: none;
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 16px;
  list-style: none;
}

.thread__notice {
  margin: 16px 16px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--gora-muted);
  font-size: 0.8rem;
  line-height: 1.4;
  text-align: center;
}

.thread__missing {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.bubble {
  max-width: 78%;
  padding: 9px 12px;
  border-radius: 16px;
}

.bubble p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.35;
}

.bubble__sender {
  display: block;
  margin-bottom: 4px;
  font-size: 0.72rem;
}
.thread__older {
  display: block;
  margin: 12px auto 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  cursor: pointer;
}

.bubble time {
  display: block;
  margin-top: 3px;
  font-size: 0.66rem;
  opacity: 0.7;
}

.bubble--theirs {
  align-self: flex-start;
  border-bottom-left-radius: 4px;
  background: var(--gora-surface);
}

.bubble--mine {
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.composer {
  display: flex;
  gap: 8px;
  padding: 8px 12px 12px;
  background: var(--ion-background-color);
}

.composer__input {
  min-width: 0;
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--gora-line);
  border-radius: 999px;
  outline: none;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.9rem;
}

.composer__input:focus {
  border-color: var(--ion-color-primary);
}

.composer__send {
  display: flex;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font-size: 18px;
}

.composer__send:disabled {
  cursor: default;
  opacity: 0.4;
}
</style>
