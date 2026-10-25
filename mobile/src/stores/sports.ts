import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ApiError } from '@/services/api-client';
import { addMySport, getMySports, getSports, removeMySport, updateMySport } from '@/services/sports-api.service';
import type { AddSportInput, SportOption, UpdateSportInput, UserSportEntry } from '@/types/profile';
import { describeApiError, isNotFound, isUnauthorized } from '@/utils/api-errors';
import { addableSports } from '@/utils/sports-profile';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall } from './authorized';
import { type ActionResult, useProfileStore } from './profile';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export const SPORT_UNAVAILABLE_MESSAGE = 'That sport is no longer available.';

/**
 * The central sport list (GET /sports, read-only) and the signed-in user's sports
 * (/users/me/sports). Sports come from the API only; the profile's copy is kept in step.
 */
export const useSportsStore = defineStore('sports', () => {
  const auth = useAuthStore();
  const profileStore = useProfileStore();

  const sports = ref<SportOption[]>([]);
  const sportsStatus = ref<LoadStatus>('idle');
  const sportsError = ref<string | null>(null);
  const mySports = ref<UserSportEntry[]>([]);
  const mySportsStatus = ref<LoadStatus>('idle');
  const mySportsError = ref<string | null>(null);
  /** The sport id being added, updated, or removed. */
  const busyId = ref<string | null>(null);

  // One request at a time per list, so several pages asking at once share a single call.
  let sportsRequest: Promise<ActionResult> | null = null;
  let mySportsRequest: Promise<ActionResult> | null = null;

  const activeSports = computed(() => sports.value.filter((sport) => sport.isActive));
  /** Active sports that are not on the profile yet, so the picker never offers a duplicate. */
  const addable = computed(() => addableSports(activeSports.value, mySports.value));

  // GET /profiles/me already includes the sports, so loading the profile fills this list too.
  watch(
    () => profileStore.currentProfile?.sports,
    (list) => {
      if (list) {
        mySports.value = list;
        mySportsStatus.value = 'ready';
        mySportsError.value = null;
      }
    },
    { immediate: true },
  );

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      mySports.value = [];
      mySportsStatus.value = 'idle';
      mySportsError.value = null;
      busyId.value = null;
      mySportsRequest = null;
      sportsRequest = null;
      if (sportsStatus.value === 'loading') sportsStatus.value = 'idle';
    },
    { flush: 'sync' },
  );

  const authorized = createAuthorizedCall(auth);

  function commit(list: UserSportEntry[]): void {
    mySports.value = list;
    mySportsStatus.value = 'ready';
    profileStore.setOwnSports(list);
  }

  /** Cached after the first success; pass force to reload (e.g. after a sport was retired). */
  function fetchSports(options: { force?: boolean } = {}): Promise<ActionResult> {
    if (!options.force && sportsStatus.value === 'ready') {
      return Promise.resolve({ ok: true });
    }

    sportsRequest ??= (async (): Promise<ActionResult> => {
      const isCurrent = captureSession(auth);
      sportsStatus.value = 'loading';
      sportsError.value = null;

      try {
        sports.value = await authorized(getSports);
        sportsStatus.value = 'ready';
        return { ok: true };
      } catch (caught) {
        if (!isCurrent() && !(isUnauthorized(caught) && !auth.accessToken)) return { ok: false, message: describeApiError(caught) };
        sportsStatus.value = 'error';
        sportsError.value = describeApiError(caught);
        return { ok: false, message: sportsError.value };
      } finally {
        if (isCurrent()) sportsRequest = null;
      }
    })();

    return sportsRequest;
  }

  function fetchMySports(options: { force?: boolean } = {}): Promise<ActionResult> {
    if (!options.force && mySportsStatus.value === 'ready') {
      return Promise.resolve({ ok: true });
    }

    mySportsRequest ??= (async (): Promise<ActionResult> => {
      const isCurrent = captureSession(auth);
      mySportsStatus.value = 'loading';
      mySportsError.value = null;

      try {
        commit(await authorized(getMySports));
        return { ok: true };
      } catch (caught) {
        if (!isCurrent() && !(isUnauthorized(caught) && !auth.accessToken)) return { ok: false, message: describeApiError(caught) };
        mySportsStatus.value = 'error';
        mySportsError.value = describeApiError(caught);
        return { ok: false, message: mySportsError.value };
      } finally {
        if (isCurrent()) mySportsRequest = null;
      }
    })();

    return mySportsRequest;
  }

  async function addSport(input: AddSportInput): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    busyId.value = input.sportId;

    try {
      const entry = await authorized((token) => addMySport(token, input));
      commit([...mySports.value.filter((sport) => sport.sportId !== entry.sportId), entry]);
      return { ok: true };
    } catch (caught) {
      // Already added elsewhere (409) or retired meanwhile (404): refresh so the screen matches the server.
      if (caught instanceof ApiError && caught.status === 409) {
        void fetchMySports({ force: true });
      } else if (isNotFound(caught)) {
        void fetchSports({ force: true });
      }

      return { ok: false, message: describeApiError(caught, SPORT_UNAVAILABLE_MESSAGE) };
    } finally {
      if (isCurrent()) busyId.value = null;
    }
  }

  async function updateSport(sportId: string, input: UpdateSportInput): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    busyId.value = sportId;

    try {
      const entry = await authorized((token) => updateMySport(token, sportId, input));
      commit(mySports.value.map((sport) => (sport.sportId === sportId ? entry : sport)));
      return { ok: true };
    } catch (caught) {
      if (isNotFound(caught)) {
        void fetchMySports({ force: true });
      }

      return { ok: false, message: describeApiError(caught) };
    } finally {
      if (isCurrent()) busyId.value = null;
    }
  }

  async function removeSport(sportId: string): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    busyId.value = sportId;

    try {
      await authorized((token) => removeMySport(token, sportId));
      commit(mySports.value.filter((sport) => sport.sportId !== sportId));
      return { ok: true };
    } catch (caught) {
      // Already gone on the server (another device removed it): the goal is met.
      if (isNotFound(caught)) {
        commit(mySports.value.filter((sport) => sport.sportId !== sportId));
        return { ok: true };
      }

      return { ok: false, message: describeApiError(caught) };
    } finally {
      if (isCurrent()) busyId.value = null;
    }
  }

  function sportName(sportId: string): string | null {
    return (
      sports.value.find((sport) => sport.id === sportId)?.name ??
      mySports.value.find((sport) => sport.sportId === sportId)?.name ??
      null
    );
  }

  return {
    sports,
    sportsStatus,
    sportsError,
    activeSports,
    mySports,
    mySportsStatus,
    mySportsError,
    addable,
    busyId,
    fetchSports,
    fetchMySports,
    addSport,
    updateSport,
    removeSport,
    sportName,
  };
});
