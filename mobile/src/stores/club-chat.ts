import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ApiError } from '@/services/api-client';
import { fetchDemoClubChats } from '@/services/club.service';
import {
  getClubChat,
  getClubChatMessages,
  getMyClubChats,
  sendClubChatMessage,
} from '@/services/club-chat-api.service';
import type { ClubChatMessage, ClubChatSummary } from '@/types/chat';
import { describeApiError, isNotFound } from '@/utils/api-errors';
import {
  CLUB_CHAT_MESSAGE_MAX_LENGTH,
  clubChatAccessMessage,
  clubChatPermissionsForRole,
  countClubChatUnread,
  getClubChatAccess,
  isServerClubId,
  sortClubChats,
  toClubChatMessage,
  toClubChatSummary,
} from '@/utils/club-chat';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall } from './authorized';
import { useClubsStore } from './clubs';
import { useSessionStore } from './session';

export type ClubChatOpenResult =
  | { status: 'open' }
  | { status: 'denied'; message: string }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export type ClubChatSendResult = { ok: true } | { ok: false; message: string; denied: boolean };

const EMPTY_MESSAGE = 'Write a message before sending.';
const TOO_LONG_MESSAGE = `Messages can be at most ${CLUB_CHAT_MESSAGE_MAX_LENGTH} characters.`;

/**
 * Official club chats. Clubs stored on the server (UUID ids) use the REST API, which checks
 * ACTIVE membership on every request; the demo clubs mirror the same rules from the clubs
 * store. Users never create group chats or add people: club membership is the only way in.
 */
export const useClubChatStore = defineStore('club-chat', () => {
  const auth = useAuthStore();
  const session = useSessionStore();
  const clubsStore = useClubsStore();

  const serverChats = ref<ClubChatSummary[]>([]);
  /** Server chat messages by club id, oldest first. */
  const serverMessages = ref<Record<string, ClubChatMessage[]>>({});
  const cursors = ref<Record<string, string | null>>({});
  const demoMessages = ref<Record<string, ClubChatMessage[]>>({});
  const demoUnread = ref<Record<string, number>>({});
  const demoLoaded = ref(false);
  const loading = ref(false);
  const listError = ref<string | null>(null);

  /** One chat per demo club the demo user is an ACTIVE member of, joined at runtime included. */
  const demoChats = computed<ClubChatSummary[]>(() =>
    clubsStore.clubs.flatMap((club) => {
      const membership = club.viewerMembership;

      if (isServerClubId(club.id) || !membership || getClubChatAccess(membership) !== 'OPEN') {
        return [];
      }

      const thread = demoMessages.value[club.id] ?? [];

      return [
        {
          id: `${club.id}-chat`,
          club: {
            id: club.id,
            slug: club.slug,
            name: club.name,
            sport: club.sport,
            profileImageUrl: club.profileImageUrl,
            isPublic: club.isPublic,
          },
          memberCount: club.memberCount,
          role: membership.role,
          permissions: clubChatPermissionsForRole(membership.role),
          lastMessage: thread.at(-1) ?? null,
          unreadCount: demoUnread.value[club.id] ?? 0,
          updatedAt: club.createdAt,
        },
      ];
    }),
  );

  const chats = computed(() => sortClubChats([...serverChats.value, ...demoChats.value]));
  const unreadCount = computed(() => countClubChatUnread(chats.value));

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      serverChats.value = [];
      serverMessages.value = {};
      cursors.value = {};
      loading.value = false;
      listError.value = null;
    },
    { flush: 'sync' },
  );

  function getChat(clubId: string): ClubChatSummary | undefined {
    return chats.value.find((chat) => chat.club.id === clubId);
  }

  function getMessages(clubId: string): ClubChatMessage[] {
    return (isServerClubId(clubId) ? serverMessages.value[clubId] : demoMessages.value[clubId]) ?? [];
  }

  function hasOlder(clubId: string): boolean {
    return !!cursors.value[clubId];
  }

  /** The viewer as the chat knows them: the signed-in account (the demo user only when nobody is signed in). */
  function viewerId(clubId: string): string | null {
    return (isServerClubId(clubId) ? auth.currentUser?.id : session.me?.id) ?? null;
  }

  async function ensureDemo(): Promise<void> {
    await clubsStore.load();

    if (!demoLoaded.value) {
      const demo = await fetchDemoClubChats();
      demoMessages.value = demo.messages;
      demoUnread.value = demo.unread;
      demoLoaded.value = true;
    }
  }

  const withToken = createAuthorizedCall(auth);

  function upsertServerChat(chat: ClubChatSummary): void {
    serverChats.value = [...serverChats.value.filter((item) => item.club.id !== chat.club.id), chat];
  }

  function dropServerChat(clubId: string): void {
    serverChats.value = serverChats.value.filter((chat) => chat.club.id !== clubId);
  }

  /** Refreshes the list (and unread counts) every time; demo history loads once. */
  async function load(): Promise<void> {
    const isCurrent = captureSession(auth);
    loading.value = true;

    try {
      await Promise.all([ensureDemo(), session.load()]);
      if (!isCurrent()) return;

      if (!auth.accessToken) {
        serverChats.value = [];
        return;
      }

      serverChats.value = (await withToken(getMyClubChats)).map(toClubChatSummary);
      listError.value = null;
    } catch (caught) {
      if (isCurrent()) listError.value = describeApiError(caught);
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  /** Loads the chat and its latest messages, and marks it read. */
  async function open(clubId: string): Promise<ClubChatOpenResult> {
    if (!isServerClubId(clubId)) {
      await Promise.all([ensureDemo(), session.load()]);
      const club = clubsStore.byId(clubId);

      if (!club) {
        return { status: 'missing' };
      }

      const access = getClubChatAccess(club.viewerMembership);

      if (access !== 'OPEN') {
        return { status: 'denied', message: clubChatAccessMessage(access) };
      }

      demoUnread.value = { ...demoUnread.value, [clubId]: 0 };
      return { status: 'open' };
    }

    try {
      const [view, page] = await withToken((token) =>
        Promise.all([getClubChat(token, clubId), getClubChatMessages(token, clubId)]),
      );

      upsertServerChat({ ...toClubChatSummary(view), unreadCount: 0 });
      serverMessages.value = { ...serverMessages.value, [clubId]: page.messages.map(toClubChatMessage) };
      cursors.value = { ...cursors.value, [clubId]: page.nextCursor };
      return { status: 'open' };
    } catch (caught) {
      return failedOpen(clubId, caught);
    }
  }

  function failedOpen(clubId: string, caught: unknown): ClubChatOpenResult {
    if (isNotFound(caught)) {
      dropServerChat(clubId);
      return { status: 'missing' };
    }

    if (caught instanceof ApiError && caught.status === 403) {
      dropServerChat(clubId);
      return { status: 'denied', message: caught.message };
    }

    return { status: 'error', message: describeApiError(caught) };
  }

  async function loadOlder(clubId: string): Promise<void> {
    const cursor = cursors.value[clubId];

    if (!isServerClubId(clubId) || !cursor) {
      return;
    }

    const page = await withToken((token) => getClubChatMessages(token, clubId, cursor));
    serverMessages.value = {
      ...serverMessages.value,
      [clubId]: [...page.messages.map(toClubChatMessage), ...(serverMessages.value[clubId] ?? [])],
    };
    cursors.value = { ...cursors.value, [clubId]: page.nextCursor };
  }

  async function send(clubId: string, content: string): Promise<ClubChatSendResult> {
    const text = content.trim();

    if (!text) {
      return { ok: false, message: EMPTY_MESSAGE, denied: false };
    }

    if (text.length > CLUB_CHAT_MESSAGE_MAX_LENGTH) {
      return { ok: false, message: TOO_LONG_MESSAGE, denied: false };
    }

    return isServerClubId(clubId) ? sendToServer(clubId, text) : sendToDemo(clubId, text);
  }

  async function sendToServer(clubId: string, text: string): Promise<ClubChatSendResult> {
    try {
      const message = toClubChatMessage(await withToken((token) => sendClubChatMessage(token, clubId, text)));
      serverMessages.value = { ...serverMessages.value, [clubId]: [...(serverMessages.value[clubId] ?? []), message] };

      const chat = serverChats.value.find((item) => item.club.id === clubId);

      if (chat) {
        upsertServerChat({ ...chat, lastMessage: message, updatedAt: message.createdAt });
      }

      return { ok: true };
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 403 || caught.status === 404)) {
        dropServerChat(clubId);
        return { ok: false, message: caught.status === 403 ? caught.message : describeApiError(caught), denied: true };
      }

      return { ok: false, message: describeApiError(caught), denied: false };
    }
  }

  function sendToDemo(clubId: string, text: string): ClubChatSendResult {
    const club = clubsStore.byId(clubId);
    const sender = session.me;
    const access = getClubChatAccess(club?.viewerMembership);

    if (!club || !sender || access !== 'OPEN') {
      return { ok: false, message: clubChatAccessMessage(access === 'OPEN' ? 'DENIED' : access), denied: true };
    }

    const thread = demoMessages.value[clubId] ?? [];
    const message: ClubChatMessage = {
      id: `${clubId}-local-${thread.length + 1}`,
      conversationId: `${clubId}-chat`,
      sender,
      content: text,
      createdAt: new Date().toISOString(),
    };

    demoMessages.value = { ...demoMessages.value, [clubId]: [...thread, message] };
    return { ok: true };
  }

  return {
    chats,
    unreadCount,
    loading,
    listError,
    load,
    open,
    loadOlder,
    send,
    getChat,
    getMessages,
    hasOlder,
    viewerId,
  };
});
