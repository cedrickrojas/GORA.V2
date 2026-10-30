import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fetchReels } from '@/services/reel.service';
import {
  createReel as createReelRequest,
  deleteReel as deleteReelRequest,
  listReelFeed,
  listUserReels,
  recordReelShare,
  setReelLike,
  updateReel as updateReelRequest,
  updateReelVisibility as updateReelVisibilityRequest,
  uploadReel as uploadReelRequest,
  type ReelUploadOptions,
} from '@/services/reels-api.service';
import type { PostVisibility } from '@/types/post';
import type { ApiReel, Reel, ReelDraft, ReelUploadDraft, UpdateReelInput } from '@/types/reel';
import { REEL_VIDEO_MAX_SECONDS, validateReelVideo } from '@/utils/reel-upload';
import { REEL_CAPTION_MAX_LENGTH, toReel, validateCaption, validateReelDraft } from '@/utils/media-api';
import { NO_SPORT_LABEL, isServerId } from '@/utils/post-api';
import { validatePostAudience } from '@/utils/post-privacy';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import { DEMO_PEOPLE_MESSAGE } from './posts';
import type { LoadStatus } from './sports';
import { useSportsStore } from './sports';
import { useFriendsStore } from './friends';

export const REEL_UNAVAILABLE_MESSAGE = 'This reel is no longer available.';
export const REEL_SIGN_IN_MESSAGE = 'Log in to upload a reel.';

/** Edit reel: caption and sport ('' or the no-sport label removes the sport). */
export interface ReelEdit {
  caption: string;
  sport: string;
}

/**
 * Reels for the Reels tab, Profile → Highlights, and My Reels. When signed in, reels are stored
 * in PostgreSQL (`serverReels`, already filtered for privacy by the server).
 * Sample reels are used only when signed out.
 */
export const useReelsStore = defineStore('reels', () => {
  const auth = useAuthStore();
  const sportsStore = useSportsStore();
  const authorized = createAuthorizedCall(auth);
  const friendsStore = useFriendsStore();
  let generation = 0;

  const reels = ref<Reel[]>([]);
  const isLoaded = ref(false);
  const serverReels = ref<Reel[]>([]);
  const serverStatus = ref<LoadStatus>('idle');
  const serverError = ref<string | null>(null);
  const loadedForUserId = ref<string | null>(null);
  const busyReelId = ref<string | null>(null);
  const likingReelIds = ref(new Set<string>());

  const savesToServer = computed(() => auth.accessToken !== null);
  const feedReels = computed(() => (savesToServer.value ? serverReels.value : reels.value));
  /** The signed-in account's own reels, newest first (Highlights, My Reels). Never anyone else's. */
  const myReels = computed(() => {
    const myId = auth.currentUser?.id;
    return myId ? serverReels.value.filter((reel) => reel.author.id === myId) : [];
  });

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      generation++;
      serverReels.value = [];
      serverStatus.value = 'idle';
      loadedForUserId.value = null;
      serverError.value = null;
      busyReelId.value = null;
      likingReelIds.value = new Set();
    },
    { flush: 'sync' },
  );

  watch(
    () => friendsStore.revision,
    () => {
      generation++;
      serverReels.value = [];
      serverStatus.value = 'idle';
      loadedForUserId.value = null;
      if (savesToServer.value && isLoaded.value) void refresh();
    },
  );

  async function load(): Promise<void> {
    if (!isLoaded.value) {
      reels.value = await fetchReels();
      isLoaded.value = true;
    }

    if (savesToServer.value && loadedForUserId.value !== (auth.currentUser?.id ?? null)) {
      await refresh();
    }
  }

  /** Reloads the real reels: the feed plus the account's own (so none is missing from My Reels). */
  async function refresh(): Promise<void> {
    if (!savesToServer.value || serverStatus.value === 'loading') {
      return;
    }

    const userId = auth.currentUser?.id ?? null;
    const username = auth.currentUser?.username;
    const isCurrent = captureSession(auth);
    const version = generation;
    serverStatus.value = 'loading';
    serverError.value = null;

    try {
      const [feed, own] = await authorized((token) =>
        Promise.all([listReelFeed(token), username ? listUserReels(token, username) : Promise.resolve({ reels: [] })]),
      );
      if (version !== generation) return;
      const byId = new Map<string, ApiReel>();

      for (const reel of [...feed.reels, ...own.reels]) {
        byId.set(reel.id, reel);
      }

      serverReels.value = [...byId.values()]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(toReel);
      serverStatus.value = 'ready';
      loadedForUserId.value = userId;
    } catch (caught) {
      if (!isCurrent() || version !== generation) return;
      serverStatus.value = 'error';
      serverError.value = describeContentError(caught, REEL_UNAVAILABLE_MESSAGE);
    }
  }

  function findOwnReel(reelId: string): Reel | undefined {
    return myReels.value.find((reel) => reel.id === reelId);
  }

  function replaceReel(updated: ApiReel): void {
    const reel = toReel(updated);
    serverReels.value = serverReels.value.map((candidate) => (candidate.id === reel.id ? reel : candidate));
  }

  function syncReel(updated: ApiReel): void {
    replaceReel(updated);
  }

  async function shareReel(reelId: string): Promise<string | null> {
    try {
      replaceReel(await authorized((token) => recordReelShare(token, reelId)));
      return null;
    } catch (caught) {
      return describeContentError(caught, REEL_UNAVAILABLE_MESSAGE);
    }
  }

  async function sportIdFor(name: string): Promise<string | null> {
    if (name.length === 0 || name === NO_SPORT_LABEL) {
      return null;
    }

    await sportsStore.fetchSports();
    return sportsStore.activeSports.find((sport) => sport.name === name)?.id ?? null;
  }

  /** Upload Reel. Returns the new reel, or an error message. */
  async function createReel(draft: ReelDraft): Promise<{ reel: Reel } | { error: string }> {
    const isCurrent = captureSession(auth);
    if (!savesToServer.value) {
      return { error: REEL_SIGN_IN_MESSAGE };
    }

    const error = validateReelDraft(draft, auth.currentUser?.id ?? null);

    if (error) {
      return { error };
    }

    if (draft.visibility === 'CUSTOM' && !draft.customViewerIds.every(isServerId)) {
      return { error: DEMO_PEOPLE_MESSAGE };
    }

    const caption = draft.caption.trim();
    const thumbnailUrl = draft.thumbnailUrl.trim();

    try {
      const sportId = await sportIdFor(draft.sport);
      if (!isCurrent()) return { error: 'The account changed. Try again.' };
      const created = await authorized((token) =>
        createReelRequest(token, {
          videoUrl: draft.videoUrl.trim(),
          visibility: draft.visibility,
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
          ...(caption ? { caption } : {}),
          ...(sportId ? { sportId } : {}),
          ...(draft.visibility === 'CUSTOM' ? { customViewerIds: draft.customViewerIds } : {}),
        }),
      );
      const reel = toReel(created);
      serverReels.value = [reel, ...serverReels.value];
      return { reel };
    } catch (caught) {
      return { error: describeContentError(caught, REEL_UNAVAILABLE_MESSAGE) };
    }
  }

  /** Upload a local video while preserving the current account and audience. */
  async function uploadReel(
    draft: ReelUploadDraft,
    options: ReelUploadOptions = {},
  ): Promise<{ reel: Reel } | { error: string }> {
    const isCurrent = captureSession(auth);
    if (!savesToServer.value) return { error: REEL_SIGN_IN_MESSAGE };
    const error =
      validateReelVideo(draft.video) ??
      validateCaption(draft.caption, REEL_CAPTION_MAX_LENGTH) ??
      validatePostAudience(draft.visibility, draft.customViewerIds, auth.currentUser?.id ?? null, 'reel');
    if (error) return { error };
    if (
      !Number.isFinite(draft.durationSeconds) ||
      draft.durationSeconds <= 0 ||
      draft.durationSeconds > REEL_VIDEO_MAX_SECONDS
    )
      return { error: 'Choose a video up to 10 minutes long.' };
    if (draft.visibility === 'CUSTOM' && !draft.customViewerIds.every(isServerId))
      return { error: DEMO_PEOPLE_MESSAGE };
    try {
      const sportId = await sportIdFor(draft.sport);
      if (!isCurrent()) return { error: 'The account changed. Try again.' };
      const created = await authorized((token) =>
        uploadReelRequest(
          token,
          draft.video,
          {
            visibility: draft.visibility,
            durationSeconds: Math.ceil(draft.durationSeconds),
            ...(draft.caption.trim() ? { caption: draft.caption.trim() } : {}),
            ...(sportId ? { sportId } : {}),
            ...(draft.visibility === 'CUSTOM' ? { customViewerIds: draft.customViewerIds } : {}),
          },
          options,
        ),
      );
      const reel = toReel(created);
      serverReels.value = [reel, ...serverReels.value];
      return { reel };
    } catch (caught) {
      if (options.signal?.aborted && isCurrent()) return { error: 'Upload canceled.' };
      return { error: describeContentError(caught, REEL_UNAVAILABLE_MESSAGE) };
    }
  }

  /** Edit reel (author only): caption and sport. Returns an error message or null. */
  async function editReel(reelId: string, edit: ReelEdit): Promise<string | null> {
    const isCurrent = captureSession(auth);
    const reel = findOwnReel(reelId);

    if (!reel) {
      return 'Only the author can edit this reel.';
    }

    const error = validateCaption(edit.caption, REEL_CAPTION_MAX_LENGTH);

    if (error || busyReelId.value) {
      return error;
    }

    busyReelId.value = reelId;

    try {
      const caption = edit.caption.trim();
      const sport = edit.sport || NO_SPORT_LABEL;
      const changes: UpdateReelInput = {};

      if (caption !== reel.caption) {
        changes.caption = caption || null;
      }

      if (sport !== reel.sport) {
        changes.sportId = await sportIdFor(sport);
      }

      if (Object.keys(changes).length > 0) {
        if (!isCurrent()) return 'The account changed. Try again.';
        replaceReel(await authorized((token) => updateReelRequest(token, reelId, changes)));
      }

      return null;
    } catch (caught) {
      return describeContentError(caught, REEL_UNAVAILABLE_MESSAGE);
    } finally {
      if (isCurrent()) busyReelId.value = null;
    }
  }

  /** Author only; the new audience applies immediately. Returns an error message or null. */
  async function updateReelVisibility(
    reelId: string,
    visibility: PostVisibility,
    customViewerIds: string[],
  ): Promise<string | null> {
    const reel = findOwnReel(reelId);

    if (!reel) {
      return 'Only the author can change who can see this reel.';
    }

    const error = validatePostAudience(visibility, customViewerIds, reel.author.id, 'reel');

    if (error) {
      return error;
    }

    if (visibility === 'CUSTOM' && !customViewerIds.every(isServerId)) {
      return DEMO_PEOPLE_MESSAGE;
    }

    try {
      replaceReel(await authorized((token) => updateReelVisibilityRequest(token, reelId, visibility, customViewerIds)));
      return null;
    } catch (caught) {
      return describeContentError(caught, REEL_UNAVAILABLE_MESSAGE);
    }
  }

  /** Delete reel (author only). The server keeps the row (soft delete); nobody sees it again. */
  async function deleteReel(reelId: string): Promise<string | null> {
    const isCurrent = captureSession(auth);
    if (!findOwnReel(reelId)) {
      return 'Only the author can delete this reel.';
    }

    if (busyReelId.value) {
      return null;
    }

    busyReelId.value = reelId;

    try {
      await authorized((token) => deleteReelRequest(token, reelId));
    } catch (caught) {
      return describeContentError(caught, REEL_UNAVAILABLE_MESSAGE);
    } finally {
      if (isCurrent()) busyReelId.value = null;
    }

    serverReels.value = serverReels.value.filter((candidate) => candidate.id !== reelId);
    return null;
  }

  async function toggleLike(reelId: string): Promise<string | null> {
    const reel = feedReels.value.find((candidate) => candidate.id === reelId);

    if (!reel) {
      return null;
    }

    if (!reel.fromServer) {
      reel.likedByViewer = !reel.likedByViewer;
      reel.likes = Math.max(0, reel.likes + (reel.likedByViewer ? 1 : -1));
      return null;
    }
    if (likingReelIds.value.has(reelId)) return null;
    const pending = likingReelIds.value;
    pending.add(reelId);
    try {
      replaceReel(await authorized((token) => setReelLike(token, reelId, !reel.likedByViewer)));
      return null;
    } catch (caught) {
      return describeContentError(caught, REEL_UNAVAILABLE_MESSAGE);
    } finally {
      pending.delete(reelId);
    }
  }

  return {
    reels,
    serverReels,
    feedReels,
    myReels,
    isLoaded,
    savesToServer,
    serverStatus,
    serverError,
    busyReelId,
    load,
    refresh,
    createReel,
    uploadReel,
    editReel,
    updateReelVisibility,
    deleteReel,
    toggleLike,
    syncReel,
    shareReel,
  };
});
