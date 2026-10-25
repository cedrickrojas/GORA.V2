import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import * as directApi from '@/services/direct-chat-api.service';
import { fetchConversations, fetchMessageRequests, fetchMessages } from '@/services/social.service';
import type {
  ChatMessage,
  ConversationSummary,
  MessageRequest,
  MessageRequestResult,
  MessageReactionEmoji,
  OutgoingMessageRequest,
} from '@/types/chat';
import type { UserSummary } from '@/types/user';
import { conversationFromRequest, countUnread, sortByRecent } from '@/utils/chat';
import { useClubChatStore } from './club-chat';
import { useAuthStore } from './auth';
import { useSessionStore } from './session';
import { useFriendsStore } from './friends';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import { isServerId } from '@/utils/post-api';
import { ApiError } from '@/services/api-client';

/**
 * Signed-in chats use the API. Demo conversations belong only to the signed-out preview.
 * Account changes immediately discard all cached messages and request identities.
 */
export const useChatStore = defineStore('chat', () => {
  const auth = useAuthStore();
  const session = useSessionStore();
  const friends = useFriendsStore();
  const authorized = createAuthorizedCall(auth);
  let generation = 0;
  let cacheRevision = 0;
  let reactionRevision = 0;
  const conversations = ref<ConversationSummary[]>([]);
  const messages = ref<Record<string, ChatMessage[]>>({});
  const requests = ref<MessageRequest[]>([]);
  const outgoingRequests = ref<OutgoingMessageRequest[]>([]);
  /** Non-friends you opened a chat with but haven't messaged yet, by user id. */
  const requestRecipients = ref<Record<string, UserSummary>>({});
  const isLoaded = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const cursors = ref<Record<string, string | null>>({});
  const reacting = ref<Record<string, boolean>>({});
  const pins = ref<Record<string, ChatMessage[]>>({});

  function reset(): void {
    generation++;
    reactionRevision++;
    conversations.value = [];
    messages.value = {};
    requests.value = [];
    outgoingRequests.value = [];
    requestRecipients.value = {};
    cursors.value = {};
    reacting.value = {};
    pins.value = {};
    isLoaded.value = false;
    loading.value = false;
    error.value = null;
  }
  watch([() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id], reset, { flush: 'sync' });
  watch(
    () => friends.revision,
    () => {
      if (auth.accessToken && isLoaded.value) {
        reset();
        void refresh();
      }
    },
  );

  const sortedConversations = computed(() => sortByRecent(conversations.value));
  const unreadCount = computed(() => countUnread(conversations.value));
  const clubChats = useClubChatStore();
  /** Unread direct messages, pending message requests, and unread club chat messages. */
  const badgeCount = computed(() => unreadCount.value + requests.value.length + clubChats.unreadCount);

  async function load(): Promise<void> {
    if (isLoaded.value) {
      return;
    }

    if (auth.accessToken) {
      await refresh();
      return;
    }
    const version = generation;

    const [loadedConversations, loadedMessages, loadedRequests] = await Promise.all([
      fetchConversations(),
      fetchMessages(),
      fetchMessageRequests(),
    ]);
    if (version !== generation) return;
    conversations.value = loadedConversations;
    messages.value = loadedMessages;
    requests.value = loadedRequests;
    isLoaded.value = true;
  }

  async function refresh(): Promise<void> {
    if (!auth.accessToken || loading.value) return;
    const isCurrent = captureSession(auth);
    const version = generation;
    const revision = cacheRevision;
    loading.value = true;
    error.value = null;
    try {
      const [chats, snapshot] = await authorized((token) =>
        Promise.all([directApi.listDirectChats(token), directApi.listDirectRequests(token)]),
      );
      if (version !== generation || revision !== cacheRevision) return;
      conversations.value = chats;
      requests.value = snapshot.received;
      outgoingRequests.value = snapshot.sent;
      const visibleIds = new Set(chats.map((chat) => chat.id));
      messages.value = Object.fromEntries(Object.entries(messages.value).filter(([id]) => visibleIds.has(id)));
      isLoaded.value = true;
    } catch (caught) {
      if (isCurrent() && version === generation) error.value = describeContentError(caught);
    } finally {
      if (isCurrent() && version === generation) {
        loading.value = false;
        if (revision !== cacheRevision) void refresh();
      }
    }
  }

  function rememberConversation(chat: ConversationSummary): void {
    const current = getConversation(chat.id);
    const latest =
      current && Date.parse(current.lastMessageAt) > Date.parse(chat.lastMessageAt)
        ? {
            ...chat,
            lastMessage: current.lastMessage,
            lastMessageAt: current.lastMessageAt,
            lastMessageSenderId: current.lastMessageSenderId,
          }
        : chat;
    cacheRevision++;
    conversations.value = [latest, ...conversations.value.filter((candidate) => candidate.id !== chat.id)];
  }

  function rememberMessages(id: string, incoming: ChatMessage[], preserveReactions = false): void {
    const current = new Map(getMessages(id).map((message) => [message.id, message]));
    const merged = incoming.map((message) => {
      const previous = current.get(message.id);
      if (previous?.updatedAt && message.updatedAt && Date.parse(previous.updatedAt) > Date.parse(message.updatedAt))
        return previous;
      return previous && !message.unsent && (preserveReactions || reacting.value[message.id])
        ? { ...message, reactions: previous.reactions }
        : message;
    });
    const byId = new Map([...current.values(), ...merged].map((message) => [message.id, message]));
    messages.value[id] = [...byId.values()].sort(
      (a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.id.localeCompare(b.id),
    );
    const latest = messages.value[id].at(-1);
    const conversation = getConversation(id);
    if (latest && conversation && Date.parse(conversation.lastMessageAt) <= Date.parse(latest.sentAt)) {
      conversation.lastMessage = latest.body;
      conversation.lastMessageAt = latest.sentAt;
      conversation.lastMessageSenderId = latest.senderId;
    }
  }

  async function loadThread(id: string, older = false): Promise<string | null> {
    if (!auth.accessToken) {
      await load();
      markRead(id);
      return null;
    }
    const isCurrent = captureSession(auth);
    const version = generation;
    const reactionsAtStart = reactionRevision;
    error.value = null;
    try {
      const before = older ? cursors.value[id] : undefined;
      if (older && !before) return null;
      const [chat, page] = await authorized((token) =>
        Promise.all([directApi.getDirectChat(token, id), directApi.getDirectMessages(token, id, before ?? undefined)]),
      );
      if (version !== generation) return null;
      rememberConversation({ ...chat, unreadCount: older ? chat.unreadCount : 0 });
      rememberMessages(id, page.messages, reactionsAtStart !== reactionRevision);
      if (older || cursors.value[id] === undefined) cursors.value[id] = page.nextCursor;
      return null;
    } catch (caught) {
      if (!isCurrent() || version !== generation) return null;
      error.value = describeContentError(caught, 'This conversation is not available.');
      if (!older && caught instanceof ApiError && [403, 404].includes(caught.status)) {
        messages.value[id] = [];
        conversations.value = conversations.value.filter((chat) => chat.id !== id);
      }
      return error.value;
    }
  }

  async function loadRecipient(id: string): Promise<void> {
    if (!auth.accessToken) {
      await load();
      return;
    }
    const isCurrent = captureSession(auth);
    try {
      requestRecipients.value[id] = await authorized((token) => directApi.getDirectRecipient(token, id));
    } catch (caught) {
      if (isCurrent()) {
        delete requestRecipients.value[id];
        error.value = describeContentError(caught, 'This person is not available.');
      }
    }
  }

  function getConversation(id: string): ConversationSummary | undefined {
    return conversations.value.find((conversation) => conversation.id === id);
  }

  function getMessages(conversationId: string): ChatMessage[] {
    return messages.value[conversationId] ?? [];
  }

  function markRead(conversationId: string): void {
    const conversation = getConversation(conversationId);

    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  async function reactToMessage(
    id: string,
    messageId: string,
    emoji: MessageReactionEmoji | null,
  ): Promise<string | null> {
    if (!auth.accessToken) return 'Log in to react to a message.';
    if (reacting.value[messageId]) return null;
    const version = generation;
    reacting.value[messageId] = true;
    reactionRevision++;
    try {
      const updated = await authorized((token) => directApi.reactToDirectMessage(token, id, messageId, emoji));
      if (version !== generation) return null;
      const message = getMessages(id).find((candidate) => candidate.id === messageId);
      if (message) message.reactions = updated.reactions ?? [];
      return null;
    } catch (caught) {
      return version === generation ? describeContentError(caught) : null;
    } finally {
      if (version === generation) {
        delete reacting.value[messageId];
        reactionRevision++;
      }
    }
  }

  async function loadPins(id: string): Promise<void> {
    const isCurrent = captureSession(auth);
    try {
      pins.value[id] = await authorized((token) => directApi.getPins(token, id));
    } catch {
      if (isCurrent()) pins.value[id] = [];
    }
  }

  async function messageMutation(
    id: string,
    messageId: string,
    call: (token: string) => Promise<ChatMessage>,
  ): Promise<string | null> {
    if (reacting.value[messageId]) return 'Please wait for the current action.';
    const isCurrent = captureSession(auth);
    reacting.value[messageId] = true;
    reactionRevision++;
    try {
      const message = await authorized(call);
      rememberMessages(message.conversationId, [message]);
      const current = getConversation(message.conversationId);
      if (
        current &&
        (current.lastMessageAt === message.sentAt || Date.parse(current.lastMessageAt) < Date.parse(message.sentAt))
      ) {
        current.lastMessage = message.body;
        current.lastMessageAt = message.sentAt;
        current.lastMessageSenderId = message.senderId;
      }
      void loadPins(id);
      return null;
    } catch (caught) {
      return describeContentError(caught);
    } finally {
      if (isCurrent()) {
        delete reacting.value[messageId];
        reactionRevision++;
      }
    }
  }

  async function sendAttachment(id: string, data: string): Promise<string | null> {
    try {
      const message = await authorized((token) => directApi.sendAttachment(token, id, data));
      rememberMessages(id, [message]);
      const conversation = getConversation(id);
      if (conversation) {
        conversation.lastMessage = message.body;
        conversation.lastMessageAt = message.sentAt;
        conversation.lastMessageSenderId = message.senderId;
      }
      return null;
    } catch (caught) {
      return describeContentError(caught);
    }
  }
  const unsendMessage = (id: string, messageId: string) =>
    messageMutation(id, messageId, (token) => directApi.unsendMessage(token, id, messageId));
  const pinMessage = (id: string, messageId: string, pinned: boolean) =>
    messageMutation(id, messageId, (token) => directApi.pinMessage(token, id, messageId, pinned));
  const forwardMessage = (id: string, messageId: string, destinationId: string) =>
    messageMutation(id, messageId, (token) => directApi.forwardMessage(token, id, messageId, destinationId));
  async function reportMessage(
    id: string,
    messageId: string,
    reason: string,
    description: string,
  ): Promise<string | null> {
    try {
      await authorized((token) => directApi.reportMessage(token, id, messageId, reason, description));
      return null;
    } catch (caught) {
      return describeContentError(caught);
    }
  }

  async function sendMessage(conversationId: string, body: string, nowMs = Date.now()): Promise<string | null> {
    const version = generation;
    const text = body.trim();
    const conversation = getConversation(conversationId);

    if (!text) {
      return null;
    }
    if (!conversation) return 'This conversation is not available. Reopen it and try again.';
    if (text.length > 1000) return 'Messages can be at most 1000 characters.';
    if (auth.accessToken) {
      try {
        const message = await authorized((token) => directApi.sendDirectMessage(token, conversationId, text));
        cacheRevision++;
        rememberMessages(conversationId, [message]);
        const current = getConversation(conversationId);
        if (current) {
          current.lastMessage = message.body;
          current.lastMessageAt = message.sentAt;
          current.lastMessageSenderId = message.senderId;
        }
        return null;
      } catch (caught) {
        return describeContentError(caught);
      }
    }
    if (!session.me) await session.load();
    if (version !== generation) return 'The account changed. Try again.';
    const sender = session.me;
    if (!sender) return 'Log in to send a message.';

    const sentAt = new Date(nowMs).toISOString();
    const thread = messages.value[conversationId] ?? [];

    messages.value[conversationId] = [
      ...thread,
      {
        id: `${conversationId}-local-${thread.length + 1}`,
        conversationId,
        senderId: sender.id,
        sender,
        body: text,
        sentAt,
      },
    ];
    conversation.lastMessage = text;
    conversation.lastMessageAt = sentAt;
    conversation.lastMessageSenderId = sender.id;
    return null;
  }

  /** Returns the id of the new conversation. */
  async function acceptRequest(requestId: string): Promise<string | null> {
    if (auth.accessToken) {
      const isCurrent = captureSession(auth);
      try {
        const chat = await authorized((token) => directApi.acceptDirectRequest(token, requestId));
        rememberConversation(chat);
        requests.value = requests.value.filter((request) => request.id !== requestId);
        return chat.id;
      } catch (caught) {
        if (isCurrent()) error.value = describeContentError(caught);
        return null;
      }
    }
    const request = requests.value.find((candidate) => candidate.id === requestId);

    if (!request) {
      return null;
    }

    const { conversation, firstMessage } = conversationFromRequest(request);

    conversations.value = [...conversations.value, conversation];
    messages.value[conversation.id] = [firstMessage];
    requests.value = requests.value.filter((candidate) => candidate.id !== requestId);

    return conversation.id;
  }

  async function deleteRequest(requestId: string): Promise<boolean> {
    if (auth.accessToken) {
      const isCurrent = captureSession(auth);
      try {
        await authorized((token) => directApi.rejectDirectRequest(token, requestId));
      } catch (caught) {
        if (isCurrent()) error.value = describeContentError(caught);
        return false;
      }
    }
    requests.value = requests.value.filter((candidate) => candidate.id !== requestId);
    cacheRevision++;
    return true;
  }

  function findDirectWith(userId: string): ConversationSummary | undefined {
    return conversations.value.find(
      (conversation) => conversation.type === 'DIRECT' && conversation.partner.id === userId,
    );
  }

  /** Friends only: returns the existing direct conversation, or starts an empty one. */
  async function openDirect(partner: UserSummary, nowMs: number): Promise<string | null> {
    if (auth.accessToken) {
      if (!isServerId(partner.id)) {
        error.value = 'This sample profile cannot receive messages.';
        return null;
      }
      const isCurrent = captureSession(auth);
      try {
        const chat = await authorized((token) => directApi.openDirectChat(token, partner.id));
        rememberConversation(chat);
        return chat.id;
      } catch (caught) {
        if (isCurrent()) error.value = describeContentError(caught);
        return null;
      }
    }
    const existing = findDirectWith(partner.id);

    if (existing) {
      return existing.id;
    }

    const conversation: ConversationSummary = {
      id: `conversation-local-${partner.id}`,
      type: 'DIRECT',
      partner,
      lastMessage: '',
      lastMessageAt: new Date(nowMs).toISOString(),
      unreadCount: 0,
    };

    conversations.value = [...conversations.value, conversation];
    messages.value[conversation.id] = [];

    return conversation.id;
  }

  /** Non-friends: opens the chat screen whose first message becomes a message request. Returns its path. */
  function openRequest(recipient: UserSummary): string {
    requestRecipients.value[recipient.id] = recipient;

    return `/chat/request/${recipient.id}`;
  }

  function outgoingRequestTo(userId: string): OutgoingMessageRequest | undefined {
    return outgoingRequests.value.find((request) => request.recipient.id === userId);
  }

  function requestRecipient(userId: string): UserSummary | undefined {
    return outgoingRequestTo(userId)?.recipient ?? requestRecipients.value[userId];
  }

  /**
   * Non-friends: one message request per pair of users, in either direction, so requests
   * cannot be spammed. If they already asked, the viewer answers in Message Requests instead.
   */
  async function sendMessageRequest(
    recipient: UserSummary,
    body: string,
    nowMs: number,
  ): Promise<MessageRequestResult> {
    const text = body.trim();

    if (requests.value.some((request) => request.sender.id === recipient.id)) {
      return 'THEY_ALREADY_ASKED';
    }

    if (outgoingRequests.value.some((request) => request.recipient.id === recipient.id)) {
      return 'ALREADY_SENT';
    }

    if (!text) {
      return 'EMPTY';
    }
    if (auth.accessToken) {
      const isCurrent = captureSession(auth);
      if (!isServerId(recipient.id)) {
        error.value = 'This sample profile cannot receive messages.';
        return 'ERROR';
      }
      try {
        const request = await authorized((token) => directApi.sendDirectRequest(token, recipient.id, text));
        cacheRevision++;
        outgoingRequests.value = [request, ...outgoingRequests.value];
        return 'SENT';
      } catch (caught) {
        if (isCurrent()) error.value = describeContentError(caught);
        return 'ERROR';
      }
    }

    outgoingRequests.value = [
      {
        id: `message-request-local-${recipient.id}`,
        recipient,
        initialMessage: text,
        createdAt: new Date(nowMs).toISOString(),
      },
      ...outgoingRequests.value,
    ];

    return 'SENT';
  }

  return {
    conversations,
    requests,
    outgoingRequests,
    isLoaded,
    loading,
    error,
    cursors,
    reacting,
    pins,
    loadPins,
    sendAttachment,
    unsendMessage,
    pinMessage,
    forwardMessage,
    reportMessage,
    sortedConversations,
    unreadCount,
    badgeCount,
    load,
    refresh,
    loadThread,
    loadRecipient,
    getConversation,
    getMessages,
    markRead,
    sendMessage,
    reactToMessage,
    acceptRequest,
    deleteRequest,
    findDirectWith,
    openDirect,
    openRequest,
    outgoingRequestTo,
    requestRecipient,
    sendMessageRequest,
  };
});
