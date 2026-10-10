<template>
  <ion-page ref="pageRef" :style="{ bottom: `${keyboardInset}px` }">
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

    <ion-content ref="contentRef">
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
            class="thread__message"
            :class="{ 'thread__message--mine': message.mine }"
          >
            <MessageBubble
              v-bind="message"
              :now="now"
              :can-react="!isRequest && !!auth.accessToken"
              :busy="chatStore.reacting[message.id]"
              @react="reactToMessage(message.id, $event)"
            />
          </li>
        </ol>
      </template>
    </ion-content>

    <ion-footer v-if="partner" class="ion-no-border thread__footer">
      <ChatComposer
        v-model="draft"
        :placeholder="composerPlaceholder"
        :disabled="requestSent || !currentUserId"
        :sending="sending"
        @send="sendDraft"
        @focus="scrollToLatest"
      />
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonFooter, IonPage, onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useNow } from '@/composables/useNow';
import { useChatKeyboard } from '@/composables/useChatKeyboard';
import { useChatStore } from '@/stores/chat';
import { useSessionStore } from '@/stores/session';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import type { MessageReaction, MessageReactionEmoji, MessageRequestResult } from '@/types/chat';
import { showNotice } from '@/utils/notice';

interface Bubble {
  id: string;
  body: string;
  sentAt: string;
  mine: boolean;
  senderName: string;
  reactions?: MessageReaction[];
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
const pageRef = ref<InstanceType<typeof IonPage> | null>(null);
const { keyboardInset } = useChatKeyboard(pageRef, () => { void scrollToLatest(); });

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
    reactions: message.reactions,
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

async function sendRequest(body: string): Promise<void> {
  const isCurrent = captureSession(auth);
  const recipient = partner.value;

  if (!recipient) {
    return;
  }

  const result = await chatStore.sendMessageRequest(recipient, body, Date.now());
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

  if (draft.value === body) draft.value = '';
  void scrollToLatest();
}

async function sendDraft(): Promise<void> {
  if (sending.value || !currentUserId.value || requestSent.value || !draft.value.trim()) return;
  const isCurrent = captureSession(auth);
  const body = draft.value;
  sending.value = true;
  try {
    if (isRequest) {
      await sendRequest(body);
      return;
    }
    const error = await chatStore.sendMessage(conversationId, body, Date.now());
    if (!isCurrent()) return;
    if (error) {
      void showNotice(error);
      return;
    }
    if (draft.value === body) draft.value = '';
    void scrollToLatest();
  } finally {
    if (isCurrent()) sending.value = false;
  }
}

async function reactToMessage(messageId: string, emoji: MessageReactionEmoji | null): Promise<void> {
  if (isRequest) return;
  const isCurrent = captureSession(auth);
  const error = await chatStore.reactToMessage(conversationId, messageId, emoji);
  if (isCurrent() && error) void showNotice(error);
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

.thread__message {
  max-width: calc(100% - 44px);
  align-self: flex-start;
  min-width: 0;
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

.thread__message--mine {
  align-self: flex-end;
}

.thread__footer {
  flex-shrink: 0;
  border-top: 1px solid var(--gora-line);
  background: var(--ion-background-color);
}
</style>
