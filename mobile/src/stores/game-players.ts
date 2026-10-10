import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  getGamePlayers,
  getMyParticipation,
  leaveGame as leaveGameCall,
  removePlayer as removePlayerCall,
} from '@/services/game-players-api.service';
import type { GameRoster, MyParticipation } from '@/types/game-player';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import { useGamesStore } from './games';
import type { ActionResult } from './profile';
import type { LoadStatus } from './sports';

/** The server words its 400, 403, 404, and 409 answers for people. */
const describePlayerError = (caught: unknown): string => describeContentError(caught);

/**
 * Rosters of GORA games. Players, counts, open slots, and the game status always come
 * from the server; after a leave or removal (or a conflict) the roster and the game are
 * fetched again, so every screen shows the same count. One action at a time.
 */
export const useGamePlayersStore = defineStore('game-players', () => {
  const auth = useAuthStore();
  const gamesStore = useGamesStore();

  const rosterByGame = ref<Record<string, GameRoster>>({});
  const rosterStatus = ref<Record<string, LoadStatus>>({});
  const rosterError = ref<Record<string, string | null>>({});
  const participationByGame = ref<Record<string, MyParticipation>>({});
  const leavingGameId = ref<string | null>(null);
  const removingUserId = ref<string | null>(null);

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      rosterByGame.value = {};
      rosterStatus.value = {};
      rosterError.value = {};
      participationByGame.value = {};
      leavingGameId.value = null;
      removingUserId.value = null;
    },
    { flush: 'sync' },
  );

  const authorized = createAuthorizedCall(auth);

  function rememberRoster(roster: GameRoster): void {
    rosterByGame.value = { ...rosterByGame.value, [roster.gameId]: roster };
    rosterStatus.value = { ...rosterStatus.value, [roster.gameId]: 'ready' };
    rosterError.value = { ...rosterError.value, [roster.gameId]: null };
  }

  function rememberParticipation(participation: MyParticipation): void {
    participationByGame.value = { ...participationByGame.value, [participation.gameId]: participation };
  }

  function rosterOf(gameId: string): GameRoster | null {
    return rosterByGame.value[gameId] ?? null;
  }

  function participationOf(gameId: string): MyParticipation | null {
    return participationByGame.value[gameId] ?? null;
  }

  async function fetchPlayers(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    rosterStatus.value = { ...rosterStatus.value, [gameId]: 'loading' };
    rosterError.value = { ...rosterError.value, [gameId]: null };

    try {
      rememberRoster(await authorized((token) => getGamePlayers(token, gameId)));
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      const message = describePlayerError(caught);
      rosterStatus.value = { ...rosterStatus.value, [gameId]: 'error' };
      rosterError.value = { ...rosterError.value, [gameId]: message };
      return { ok: false, message };
    }
  }

  async function fetchMyParticipation(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    try {
      rememberParticipation(await authorized((token) => getMyParticipation(token, gameId)));
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      return { ok: false, message: describePlayerError(caught) };
    }
  }

  /** The game (count, status, isPlayer) and its roster, both from the server. */
  async function refreshGameCount(gameId: string): Promise<void> {
    await Promise.all([gamesStore.fetchGame(gameId), fetchPlayers(gameId)]);
  }

  async function leaveGame(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    if (leavingGameId.value !== null) {
      return { ok: false, message: 'Please wait a moment.' };
    }

    leavingGameId.value = gameId;

    try {
      rememberParticipation(await authorized((token) => leaveGameCall(token, gameId)));
      gamesStore.forgetPlaying(gameId);
      await refreshGameCount(gameId);
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      void fetchMyParticipation(gameId);
      void refreshGameCount(gameId);
      return { ok: false, message: describePlayerError(caught) };
    } finally {
      if (isCurrent()) leavingGameId.value = null;
    }
  }

  async function removePlayer(gameId: string, userId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    if (removingUserId.value !== null) {
      return { ok: false, message: 'Please wait a moment.' };
    }

    removingUserId.value = userId;

    try {
      rememberRoster(await authorized((token) => removePlayerCall(token, gameId, userId)));
      await gamesStore.fetchGame(gameId);
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      void refreshGameCount(gameId);
      return { ok: false, message: describePlayerError(caught) };
    } finally {
      if (isCurrent()) removingUserId.value = null;
    }
  }

  return {
    rosterByGame,
    rosterStatus,
    rosterError,
    participationByGame,
    leavingGameId,
    removingUserId,
    rosterOf,
    participationOf,
    fetchPlayers,
    fetchMyParticipation,
    refreshGameCount,
    leaveGame,
    removePlayer,
  };
});
