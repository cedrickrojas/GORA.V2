import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { ApiError } from '@/services/api-client';
import {
  acceptJoinRequest as acceptJoinRequestCall,
  cancelMyJoinRequest,
  createJoinRequest as createJoinRequestCall,
  getMyJoinRequest,
  listGameJoinRequests,
  rejectJoinRequest as rejectJoinRequestCall,
} from '@/services/join-requests-api.service';
import type { HostJoinRequest, JoinRequest } from '@/types/join-request';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import { useGamePlayersStore } from './game-players';
import { useGamesStore } from './games';
import type { ActionResult } from './profile';
import type { LoadStatus } from './sports';

/** The server words its 403, 404, and 409 answers for people ("This game is full."). */
const describeJoinRequestError = (caught: unknown): string => describeContentError(caught);

function isStale(caught: unknown): boolean {
  return caught instanceof ApiError && (caught.status === 404 || caught.status === 409);
}

/**
 * Join requests for GORA games. Every state comes from the server: after each change, or
 * when a change fails because someone else acted first (404/409), the request and the
 * game are fetched again. One action per game (requester) or request (host) at a time,
 * so repeated taps never send duplicates.
 */
export const useJoinRequestsStore = defineStore('join-requests', () => {
  const auth = useAuthStore();
  const gamesStore = useGamesStore();
  const gamePlayers = useGamePlayersStore();

  const mineByGame = ref<Record<string, JoinRequest | null>>({});
  const mineStatus = ref<Record<string, LoadStatus>>({});
  const hostRequestsByGame = ref<Record<string, HostJoinRequest[]>>({});
  const hostStatus = ref<Record<string, LoadStatus>>({});
  const hostError = ref<Record<string, string | null>>({});
  const submittingGameId = ref<string | null>(null);
  const actingRequestId = ref<string | null>(null);

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      mineByGame.value = {};
      mineStatus.value = {};
      hostRequestsByGame.value = {};
      hostStatus.value = {};
      hostError.value = {};
      submittingGameId.value = null;
      actingRequestId.value = null;
    },
    { flush: 'sync' },
  );

  const authorized = createAuthorizedCall(auth);

  function rememberMine(gameId: string, request: JoinRequest | null): void {
    mineByGame.value = { ...mineByGame.value, [gameId]: request };
    mineStatus.value = { ...mineStatus.value, [gameId]: 'ready' };
  }

  function rememberHostRequest(gameId: string, request: HostJoinRequest): void {
    const list = hostRequestsByGame.value[gameId] ?? [];
    hostRequestsByGame.value = {
      ...hostRequestsByGame.value,
      [gameId]: list.some((item) => item.id === request.id)
        ? list.map((item) => (item.id === request.id ? request : item))
        : [...list, request],
    };
  }

  function myJoinRequest(gameId: string): JoinRequest | null {
    return mineByGame.value[gameId] ?? null;
  }

  function gameJoinRequests(gameId: string): HostJoinRequest[] {
    return hostRequestsByGame.value[gameId] ?? [];
  }

  async function fetchMyJoinRequest(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    mineStatus.value = { ...mineStatus.value, [gameId]: 'loading' };

    try {
      rememberMine(gameId, await authorized((token) => getMyJoinRequest(token, gameId)));
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      mineStatus.value = { ...mineStatus.value, [gameId]: 'error' };
      return { ok: false, message: describeJoinRequestError(caught) };
    }
  }

  async function createJoinRequest(gameId: string, message: string | null): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    if (submittingGameId.value !== null) {
      return { ok: false, message: 'Your request is already being sent.' };
    }

    submittingGameId.value = gameId;

    try {
      const note = message?.trim() || null;
      rememberMine(gameId, await authorized((token) => createJoinRequestCall(token, gameId, note)));
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      if (isStale(caught)) {
        void fetchMyJoinRequest(gameId);
        void gamesStore.fetchGame(gameId);
      }

      return { ok: false, message: describeJoinRequestError(caught) };
    } finally {
      if (isCurrent()) submittingGameId.value = null;
    }
  }

  async function cancelJoinRequest(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    if (submittingGameId.value !== null) {
      return { ok: false, message: 'Please wait a moment.' };
    }

    submittingGameId.value = gameId;

    try {
      rememberMine(gameId, await authorized((token) => cancelMyJoinRequest(token, gameId)));
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      if (isStale(caught)) {
        void fetchMyJoinRequest(gameId);
      }

      return { ok: false, message: describeJoinRequestError(caught) };
    } finally {
      if (isCurrent()) submittingGameId.value = null;
    }
  }

  /** Host only: every request on the game (the server answers 403 for anyone else). */
  async function fetchGameJoinRequests(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    hostStatus.value = { ...hostStatus.value, [gameId]: 'loading' };
    hostError.value = { ...hostError.value, [gameId]: null };

    try {
      const list = await authorized((token) => listGameJoinRequests(token, gameId));
      hostRequestsByGame.value = { ...hostRequestsByGame.value, [gameId]: list };
      hostStatus.value = { ...hostStatus.value, [gameId]: 'ready' };
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      const message = describeJoinRequestError(caught);
      hostStatus.value = { ...hostStatus.value, [gameId]: 'error' };
      hostError.value = { ...hostError.value, [gameId]: message };
      return { ok: false, message };
    }
  }

  async function answer(
    gameId: string,
    requestId: string,
    call: (token: string, gameId: string, requestId: string) => Promise<HostJoinRequest>,
  ): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    if (actingRequestId.value !== null) {
      return { ok: false, message: 'Please wait a moment.' };
    }

    actingRequestId.value = requestId;

    try {
      rememberHostRequest(gameId, await authorized((token) => call(token, gameId, requestId)));
      void gamePlayers.refreshGameCount(gameId);
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      if (isStale(caught)) {
        void fetchGameJoinRequests(gameId);
        void gamePlayers.refreshGameCount(gameId);
      }

      return { ok: false, message: describeJoinRequestError(caught) };
    } finally {
      if (isCurrent()) actingRequestId.value = null;
    }
  }

  function acceptJoinRequest(gameId: string, requestId: string): Promise<ActionResult> {
    return answer(gameId, requestId, acceptJoinRequestCall);
  }

  function rejectJoinRequest(gameId: string, requestId: string): Promise<ActionResult> {
    return answer(gameId, requestId, rejectJoinRequestCall);
  }

  return {
    mineByGame,
    mineStatus,
    hostRequestsByGame,
    hostStatus,
    hostError,
    submittingGameId,
    actingRequestId,
    myJoinRequest,
    gameJoinRequests,
    fetchMyJoinRequest,
    createJoinRequest,
    cancelJoinRequest,
    fetchGameJoinRequests,
    acceptJoinRequest,
    rejectJoinRequest,
  };
});
