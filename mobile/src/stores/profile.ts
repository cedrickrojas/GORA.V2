import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fetchActivityStats, fetchBadges, fetchCurrentProfile } from '@/services/profile.service';
import {
  getMyProfile,
  getProfile,
  updateMyProfile,
  uploadMyCover,
  removeMyCover,
} from '@/services/profile-api.service';
import { preparePostPhoto } from '@/utils/post-photos';
import { ApiError } from '@/services/api-client';
import type { Badge } from '@/types/achievement';
import type { ActivityStats } from '@/types/activity';
import type { OtherProfile, OwnProfile, ProfileUpdateInput, UserProfile, UserSportEntry } from '@/types/profile';
import type { UserSummary } from '@/types/user';
import { describeApiError, isNotFound, isUnauthorized } from '@/utils/api-errors';
import { toUserSummary } from '@/utils/display-name';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall } from './authorized';

export type ActionResult = { ok: true } | { ok: false; message: string };

export type ProfileLookup =
  | { status: 'found'; profile: OwnProfile | OtherProfile }
  | { status: 'missing' }
  | { status: 'error'; message: string };

const PROFILE_NOT_FOUND_MESSAGE = "This profile isn't available.";

/**
 * Profiles come from the REST API (/profiles/*) with the signed-in user's JWT; this store
 * never touches the database. Activity stats and badges are still the demo data until
 * their server engines exist. Sport edits live in the sports store, which keeps
 * currentProfile.sports in step through setOwnSports.
 */
export const useProfileStore = defineStore('profile', () => {
  const auth = useAuthStore();

  const currentProfile = ref<OwnProfile | null>(null);
  /** The last profile opened with fetchProfile. Pages keep their own copy, one per cached page. */
  const viewedProfile = ref<OtherProfile | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  /** The signed-in account as avatars show it; the profile once loaded, else the login response. */
  const account = computed<UserSummary | null>(() => {
    const source = currentProfile.value ?? auth.currentUser;

    return source ? toUserSummary(source) : null;
  });

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      currentProfile.value = null;
      viewedProfile.value = null;
      loading.value = false;
      saving.value = false;
      error.value = null;
    },
    { flush: 'sync' },
  );

  const authorized = createAuthorizedCall(auth);

  async function fetchMyProfile(): Promise<OwnProfile | null> {
    const isCurrent = captureSession(auth);
    loading.value = true;
    error.value = null;

    try {
      currentProfile.value = await authorized(getMyProfile);
      return currentProfile.value;
    } catch (caught) {
      if (isCurrent() || (isUnauthorized(caught) && !auth.accessToken)) {
        error.value = describeApiError(caught, PROFILE_NOT_FOUND_MESSAGE);
      }
      return null;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  async function fetchProfile(username: string): Promise<ProfileLookup> {
    try {
      const profile = await authorized((token) => getProfile(token, username));

      if (profile.isOwnProfile) {
        currentProfile.value = profile;
      } else {
        viewedProfile.value = profile;
      }

      return { status: 'found', profile };
    } catch (caught) {
      return isNotFound(caught) ? { status: 'missing' } : { status: 'error', message: describeApiError(caught) };
    }
  }

  async function updateProfile(input: ProfileUpdateInput): Promise<ActionResult> {
    const isCurrent = captureSession(auth);
    saving.value = true;

    try {
      const saved = await authorized((token) => updateMyProfile(token, input));
      currentProfile.value = saved;

      if (auth.currentUser?.id === saved.id) {
        auth.currentUser = {
          ...auth.currentUser,
          firstName: saved.firstName,
          lastName: saved.lastName,
          bio: saved.bio,
          city: saved.city,
          profileImageUrl: saved.profileImageUrl,
        };
      }

      return { ok: true };
    } catch (caught) {
      return { ok: false, message: describeApiError(caught) };
    } finally {
      if (isCurrent()) saving.value = false;
    }
  }

  async function updateCover(file: File | null): Promise<ActionResult> {
    if (saving.value) return { ok: false, message: 'Please wait for the current change to finish.' };
    const isCurrent = captureSession(auth);
    saving.value = true;
    try {
      const photo = file ? await preparePostPhoto(file) : null;
      if (!isCurrent()) return { ok: false, message: 'The account changed. Try again.' };
      currentProfile.value = await authorized((token) => (photo ? uploadMyCover(token, photo) : removeMyCover(token)));
      return { ok: true };
    } catch (caught) {
      return {
        ok: false,
        message: caught instanceof Error && !(caught instanceof ApiError) ? caught.message : describeApiError(caught),
      };
    } finally {
      if (isCurrent()) saving.value = false;
    }
  }

  function setOwnSports(sports: UserSportEntry[]): void {
    if (currentProfile.value && currentProfile.value.sports !== sports) {
      currentProfile.value = { ...currentProfile.value, sports };
    }
  }

  // Demo data for the Badges, Activity, Friends, and My Reels pages (no server engine yet).
  const profile = ref<UserProfile | null>(null);
  const activityStats = ref<ActivityStats | null>(null);
  const badges = ref<Badge[]>([]);
  const isLoaded = ref(false);

  async function load(): Promise<void> {
    const [demoProfile, stats, latestProfile] = await Promise.all([
      fetchCurrentProfile(),
      fetchActivityStats(),
      auth.accessToken ? authorized(getMyProfile).catch(() => null) : Promise.resolve(null),
    ]);

    if (latestProfile) currentProfile.value = latestProfile;
    const userBadges = await fetchBadges(latestProfile?.goraPoints ?? currentProfile.value?.goraPoints ?? 0);

    profile.value = demoProfile;
    activityStats.value = stats;
    badges.value = userBadges;
    isLoaded.value = true;
  }

  return {
    currentProfile,
    viewedProfile,
    loading,
    saving,
    error,
    account,
    fetchMyProfile,
    fetchProfile,
    updateProfile,
    updateCover,
    setOwnSports,
    profile,
    activityStats,
    badges,
    isLoaded,
    load,
  };
});
