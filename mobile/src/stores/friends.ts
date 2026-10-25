import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fetchFriends } from '@/services/catalog.service';
import { fetchFriendRequests } from '@/services/social.service';
import {
  acceptFriendRequest,
  dismissFriendRequest,
  getFriends,
  removeFriend,
  sendFriendRequest,
  unblockFriend,
  type FriendsSnapshot,
} from '@/services/friends-api.service';
import type { FriendRequest } from '@/types/friend';
import type { PlayerSummary } from '@/types/player';
import { describeApiError, isUnauthorized } from '@/utils/api-errors';
import { resolveRelationship, type RelationshipState } from '@/utils/relationship';
import { useAuthStore } from './auth';

/** Signed-in friendships belong to the API; sample relationships are for the demo only. */
export const useFriendsStore = defineStore('friends', () => {
  const auth = useAuthStore();
  const friends = ref<PlayerSummary[]>([]);
  const requests = ref<FriendRequest[]>([]);
  const blockedIds = ref<string[]>([]);
  const isLoaded = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const busyId = ref<string | null>(null);
  const revision = ref(0);
  let pendingLoad: Promise<void> | null = null;
  let generation = 0;
  const received = computed(() => requests.value.filter((request) => request.direction === 'RECEIVED'));
  const sent = computed(() => requests.value.filter((request) => request.direction === 'SENT'));
  const friendIds = computed(() => new Set(friends.value.map((friend) => friend.id)));
  const blockedIdSet = computed(() => new Set(blockedIds.value));

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      generation++;
      friends.value = [];
      requests.value = [];
      blockedIds.value = [];
      isLoaded.value = false;
      loading.value = false;
      error.value = null;
      busyId.value = null;
      pendingLoad = null;
      revision.value++;
    },
    { flush: 'sync' },
  );

  function apply(snapshot: FriendsSnapshot): void {
    const signature = () =>
      JSON.stringify([friends.value.map((person) => person.id).sort(), [...blockedIds.value].sort()]);
    const previous = signature();
    friends.value = snapshot.friends;
    requests.value = snapshot.requests;
    blockedIds.value = snapshot.blockedIds;
    isLoaded.value = true;
    if (signature() !== previous) revision.value++;
  }

  function refresh(): Promise<void> {
    if (busyId.value) return Promise.resolve();
    if (pendingLoad) return pendingLoad;
    const token = auth.accessToken;
    const version = generation;
    loading.value = true;
    error.value = null;
    const task = (async () => {
      try {
        const snapshot = token
          ? await getFriends(token)
          : {
              friends: await fetchFriends(),
              requests: await fetchFriendRequests(),
              blockedIds: [],
            };
        if (version === generation) apply(snapshot);
      } catch (caught) {
        if (version === generation) {
          error.value = describeApiError(caught, 'Could not load your friends.');
          if (isUnauthorized(caught)) await auth.logout();
        }
      } finally {
        if (version === generation) {
          loading.value = false;
          pendingLoad = null;
        }
      }
    })();
    pendingLoad = task;
    return task;
  }

  async function load(): Promise<void> {
    if (!isLoaded.value) await refresh();
  }

  async function mutate(id: string, call: (token: string) => Promise<FriendsSnapshot>): Promise<boolean> {
    const token = auth.accessToken;
    if (!token || busyId.value) return false;
    // Finish an older snapshot read before changing the relationship.
    if (pendingLoad) await pendingLoad;
    if (busyId.value || token !== auth.accessToken) return false;
    const version = ++generation;
    busyId.value = id;
    error.value = null;
    try {
      const snapshot = await call(token);
      if (version !== generation) return false;
      apply(snapshot);
      return true;
    } catch (caught) {
      if (version === generation) {
        error.value = describeApiError(
          caught,
          'This friendship or request is no longer available. Refresh and try again.',
        );
        if (isUnauthorized(caught)) await auth.logout();
      }
      return false;
    } finally {
      if (version === generation) busyId.value = null;
    }
  }

  function requestWith(userId: string): FriendRequest | undefined {
    return requests.value.find((request) => request.player.id === userId);
  }

  function relationshipWith(viewerId: string, userId: string): RelationshipState {
    return resolveRelationship(viewerId, userId, {
      friendIds: friendIds.value,
      blockedIds: blockedIdSet.value,
      requestDirection: requestWith(userId)?.direction ?? null,
    });
  }

  async function accept(requestId: string): Promise<boolean> {
    if (auth.accessToken) return mutate(requestId, (token) => acceptFriendRequest(token, requestId));
    const request = requests.value.find((item) => item.id === requestId && item.direction === 'RECEIVED');
    if (!request) return false;
    friends.value = [request.player, ...friends.value];
    requests.value = requests.value.filter((item) => item.id !== requestId);
    revision.value++;
    return true;
  }

  async function dismiss(requestId: string): Promise<boolean> {
    if (auth.accessToken) return mutate(requestId, (token) => dismissFriendRequest(token, requestId));
    requests.value = requests.value.filter((item) => item.id !== requestId);
    return true;
  }

  async function sendRequest(viewerId: string, player: PlayerSummary, nowMs: number): Promise<boolean> {
    if (auth.accessToken) return mutate(player.id, (token) => sendFriendRequest(token, player.username));
    if (relationshipWith(viewerId, player.id) !== 'NO_RELATIONSHIP') return false;
    requests.value = [
      {
        id: `request-local-${player.id}`,
        direction: 'SENT',
        player,
        mutualFriends: 0,
        createdAt: new Date(nowMs).toISOString(),
      },
      ...requests.value,
    ];
    return true;
  }

  async function unfriend(username: string): Promise<boolean> {
    return mutate(username, (token) => removeFriend(token, username));
  }

  async function unblock(userId: string, username?: string): Promise<boolean> {
    if (auth.accessToken && username) return mutate(userId, (token) => unblockFriend(token, username));
    blockedIds.value = blockedIds.value.filter((id) => id !== userId);
    revision.value++;
    return true;
  }

  return {
    friends,
    requests,
    blockedIds,
    received,
    sent,
    friendIds,
    blockedIdSet,
    isLoaded,
    loading,
    error,
    busyId,
    revision,
    load,
    refresh,
    accept,
    dismiss,
    requestWith,
    relationshipWith,
    sendRequest,
    unfriend,
    unblock,
  };
});
