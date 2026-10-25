import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ApiError } from '@/services/api-client';
import { fetchGames as fetchDemoGames, requestToJoinGame } from '@/services/game.service';
import {
  cancelGame as cancelGameRequest,
  createGame as createGameRequest,
  getGame,
  listGames,
  listHostedGames,
  listPlayingGames,
  updateGame as updateGameRequest,
} from '@/services/games-api.service';
import type { ApiGame, CreateGameInput, Game, GameListQuery, UpdateGameInput } from '@/types/game';
import { isNotFound } from '@/utils/api-errors';
import { canRequestToJoin } from '@/utils/games';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import type { ActionResult } from './profile';
import type { LoadStatus } from './sports';

export const GAME_UNAVAILABLE_MESSAGE = 'This game is not available.';

export type GameActionResult = { ok: true; game: ApiGame } | { ok: false; message: string };

/** The server writes its 403 messages for people ("Only the host can change this game."). */
const describeGameError = (caught: unknown): string => describeContentError(caught, GAME_UNAVAILABLE_MESSAGE);

/**
 * Games. `games` is the demo feed used by Home, Search, Discover, and the sport pages until
 * those move to the API. Games created in GORA (UUID ids) come from the REST API only and
 * are cached once by id; lists hold ids, so a game is never stored twice.
 */
export const useGamesStore = defineStore('games', () => {
  const auth = useAuthStore();

  const games = ref<Game[]>([]);
  const isLoaded = ref(false);

  const gamesById = ref<Record<string, ApiGame>>({});
  const detailStatus = ref<Record<string, LoadStatus>>({});
  const detailError = ref<Record<string, string | null>>({});
  const listIds = ref<string[]>([]);
  const listStatus = ref<LoadStatus>('idle');
  const listError = ref<string | null>(null);
  const hostedIds = ref<string[]>([]);
  const hostedStatus = ref<LoadStatus>('idle');
  const hostedError = ref<string | null>(null);
  const playingIds = ref<string[]>([]);
  const playingStatus = ref<LoadStatus>('idle');
  const playingError = ref<string | null>(null);
  const isSaving = ref(false);
  const cancellingId = ref<string | null>(null);

  const listedGames = computed(() => pick(listIds.value));
  const hostedGames = computed(() => pick(hostedIds.value));
  const playingGames = computed(() => pick(playingIds.value));

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      gamesById.value = {};
      detailStatus.value = {};
      detailError.value = {};
      listIds.value = [];
      listStatus.value = 'idle';
      listError.value = null;
      hostedIds.value = [];
      hostedStatus.value = 'idle';
      hostedError.value = null;
      playingIds.value = [];
      playingStatus.value = 'idle';
      playingError.value = null;
      isSaving.value = false;
      cancellingId.value = null;
    },
    { flush: 'sync' },
  );

  function pick(ids: readonly string[]): ApiGame[] {
    return ids.map((id) => gamesById.value[id]).filter((game): game is ApiGame => game !== undefined);
  }

  function remember(game: ApiGame): ApiGame {
    gamesById.value = { ...gamesById.value, [game.id]: game };
    detailStatus.value = { ...detailStatus.value, [game.id]: 'ready' };
    detailError.value = { ...detailError.value, [game.id]: null };
    return game;
  }

  /** Runs an API call with the current token; a 401 ends the session so the app returns to Log In. */
  const authorized = createAuthorizedCall(auth);

  async function load(): Promise<void> {
    if (isLoaded.value) {
      return;
    }

    games.value = await fetchDemoGames();
    isLoaded.value = true;
  }

  /** Demo games only; GORA games use the join requests store. */
  async function requestToJoin(gameId: string): Promise<boolean> {
    const game = games.value.find((candidate) => candidate.id === gameId);

    if (!game || !canRequestToJoin(game)) {
      return false;
    }

    game.participation = await requestToJoinGame(gameId);

    return true;
  }

  function gameById(gameId: string): ApiGame | null {
    return gamesById.value[gameId] ?? null;
  }

  async function createGame(input: CreateGameInput): Promise<GameActionResult> {
    const isCurrent = captureSession(auth);
    isSaving.value = true;

    try {
      const game = remember(await authorized((token) => createGameRequest(token, input)));
      hostedIds.value = [game.id, ...hostedIds.value.filter((id) => id !== game.id)];
      return { ok: true, game };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      return { ok: false, message: describeGameError(caught) };
    } finally {
      if (isCurrent()) isSaving.value = false;
    }
  }

  async function fetchGame(gameId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    detailStatus.value = { ...detailStatus.value, [gameId]: 'loading' };
    detailError.value = { ...detailError.value, [gameId]: null };

    try {
      remember(await authorized((token) => getGame(token, gameId)));
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      const message = describeGameError(caught);

      if (isNotFound(caught)) {
        gamesById.value = Object.fromEntries(Object.entries(gamesById.value).filter(([id]) => id !== gameId));
      }

      detailStatus.value = { ...detailStatus.value, [gameId]: 'error' };
      detailError.value = { ...detailError.value, [gameId]: message };
      return { ok: false, message };
    }
  }

  async function fetchGames(query: GameListQuery = {}): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    listStatus.value = 'loading';
    listError.value = null;

    try {
      const list = await authorized((token) => listGames(token, query));
      list.forEach(remember);
      listIds.value = list.map((game) => game.id);
      listStatus.value = 'ready';
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      listStatus.value = 'error';
      listError.value = describeGameError(caught);
      return { ok: false, message: listError.value };
    }
  }

  /** Games the signed-in user hosts (GET /games/mine), whatever their status. */
  async function fetchMyGames(): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    hostedStatus.value = 'loading';
    hostedError.value = null;

    try {
      const list = await authorized(listHostedGames);
      list.forEach(remember);
      hostedIds.value = list.map((game) => game.id);
      hostedStatus.value = 'ready';
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      hostedStatus.value = 'error';
      hostedError.value = describeGameError(caught);
      return { ok: false, message: hostedError.value };
    }
  }

  /** Games the signed-in user is an ACTIVE player in (GET /games/playing). */
  async function fetchPlayingGames(): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    playingStatus.value = 'loading';
    playingError.value = null;

    try {
      const list = await authorized(listPlayingGames);
      list.forEach(remember);
      playingIds.value = list.map((game) => game.id);
      playingStatus.value = 'ready';
      return { ok: true };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      playingStatus.value = 'error';
      playingError.value = describeGameError(caught);
      return { ok: false, message: playingError.value };
    }
  }

  /** After leaving or being removed, the game is no longer one the user plays in. */
  function forgetPlaying(gameId: string): void {
    playingIds.value = playingIds.value.filter((id) => id !== gameId);
  }

  async function updateGame(gameId: string, input: UpdateGameInput): Promise<GameActionResult> {
    const isCurrent = captureSession(auth);
    isSaving.value = true;

    try {
      const game = remember(await authorized((token) => updateGameRequest(token, gameId, input)));
      return { ok: true, game };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      // Cancelled or completed elsewhere (409): show the server's current state.
      if (caught instanceof ApiError && caught.status === 409) {
        void fetchGame(gameId);
      }

      return { ok: false, message: describeGameError(caught) };
    } finally {
      if (isCurrent()) isSaving.value = false;
    }
  }

  async function cancelGame(gameId: string): Promise<GameActionResult> {
    const isCurrent = captureSession(auth);
    cancellingId.value = gameId;

    try {
      const game = remember(await authorized((token) => cancelGameRequest(token, gameId)));
      return { ok: true, game };
    } catch (caught) {
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      if (caught instanceof ApiError && caught.status === 409) {
        void fetchGame(gameId);
      }

      return { ok: false, message: describeGameError(caught) };
    } finally {
      if (isCurrent()) cancellingId.value = null;
    }
  }

  return {
    games,
    isLoaded,
    load,
    requestToJoin,
    gamesById,
    detailStatus,
    detailError,
    listedGames,
    listStatus,
    listError,
    hostedGames,
    hostedStatus,
    hostedError,
    playingGames,
    playingStatus,
    playingError,
    isSaving,
    cancellingId,
    gameById,
    createGame,
    fetchGame,
    fetchGames,
    fetchMyGames,
    fetchPlayingGames,
    forgetPlaying,
    updateGame,
    cancelGame,
  };
});
