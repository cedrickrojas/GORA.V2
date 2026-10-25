import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fetchClubMembers, fetchClubs, setClubFollow, setClubMembership } from '@/services/club.service';
import {
  approveServerClubRequest,
  createServerClub,
  getMyServerClubs,
  getServerClub,
  getServerClubInvites,
  getServerClubMembers,
  getServerClubRequests,
  inviteToServerClub,
  joinServerClub,
  leaveServerClub,
  rejectServerClubRequest,
  removeServerClubMember,
  updateServerClub,
} from '@/services/club-api.service';
import type {
  Club,
  ClubCreateInput,
  ClubInvite,
  ClubJoinRequest,
  ClubMemberEntry,
  ClubUpdateInput,
} from '@/types/club';
import type { UserSummary } from '@/types/user';
import { describeApiError, isNotFound } from '@/utils/api-errors';
import { isServerClubId } from '@/utils/club-chat';
import {
  applyJoin,
  applyLeave,
  asNonMember,
  selectFeedClubIds,
  toClub,
  toClubInvite,
  toClubJoinRequest,
  toClubMember,
} from '@/utils/clubs';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';

export type ClubActionResult = { ok: true } | { ok: false; message: string };
export type ClubCreateResult = { ok: true; club: Club } | { ok: false; message: string };
export type ClubJoinResult = { ok: true; status: 'JOINED' | 'REQUESTED' } | { ok: false; message: string };
export type ClubLookup = { status: 'found'; club: Club } | { status: 'missing' } | { status: 'error'; message: string };

/** 403s from the clubs API explain themselves ("This club is invite only…"), so they are shown as is. */
const describeClubError = (caught: unknown): string => describeContentError(caught);

/**
 * Clubs created in GORA live on the server (UUID ids): creation, capacity, join rules, and
 * member management all go through the REST API, which enforces them. The demo clubs are
 * kept alongside with the same rules applied locally.
 */
export const useClubsStore = defineStore('clubs', () => {
  const auth = useAuthStore();

  const demoClubs = ref<Club[]>([]);
  const serverClubs = ref<Club[]>([]);
  const members = ref<Record<string, ClubMemberEntry[]>>({});
  const isLoaded = ref(false);
  const serverError = ref<string | null>(null);

  const clubs = computed<Club[]>(() => [...serverClubs.value, ...demoClubs.value]);
  const feedClubIds = computed(() => selectFeedClubIds(clubs.value));

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      serverClubs.value = [];
      demoClubs.value = [];
      members.value = {};
      isLoaded.value = false;
      serverError.value = null;
    },
    { flush: 'sync' },
  );

  const authorized = createAuthorizedCall(auth);

  function upsertServer(club: Club): Club {
    const exists = serverClubs.value.some((candidate) => candidate.id === club.id);
    serverClubs.value = exists
      ? serverClubs.value.map((candidate) => (candidate.id === club.id ? club : candidate))
      : [club, ...serverClubs.value];
    return club;
  }

  /**
   * Demo clubs once; the signed-in user's server clubs (GET /clubs/mine) on every call.
   * A signed-in account starts outside every demo club (the demo memberships are the demo user's).
   */
  async function load(): Promise<void> {
    if (!isLoaded.value) {
      const demo = await fetchClubs();
      demoClubs.value = auth.accessToken ? demo.map(asNonMember) : demo;
      isLoaded.value = true;
    }

    await refreshMine();
  }

  async function refreshMine(): Promise<void> {
    const isCurrent = captureSession(auth);
    if (!auth.accessToken) {
      return;
    }

    try {
      const mine = (await authorized(getMyServerClubs)).map(toClub);
      const mineIds = new Set(mine.map((club) => club.id));
      serverClubs.value = [...mine, ...serverClubs.value.filter((club) => !mineIds.has(club.id))];
      serverError.value = null;
    } catch (caught) {
      if (!isCurrent()) return;
      serverError.value = describeApiError(caught);
    }
  }

  /** Fetches a server club fresh (capacity and membership change often); demo clubs come from memory. */
  async function loadClub(clubId: string): Promise<ClubLookup> {
    if (!isServerClubId(clubId)) {
      await load();
      const club = byId(clubId);
      return club ? { status: 'found', club } : { status: 'missing' };
    }

    try {
      const club = upsertServer(toClub(await authorized((token) => getServerClub(token, clubId))));
      return { status: 'found', club };
    } catch (caught) {
      if (isNotFound(caught)) {
        serverClubs.value = serverClubs.value.filter((club) => club.id !== clubId);
        return { status: 'missing' };
      }

      return { status: 'error', message: describeApiError(caught) };
    }
  }

  function byId(clubId: string): Club | undefined {
    return clubs.value.find((club) => club.id === clubId);
  }

  function replaceDemo(next: Club): void {
    demoClubs.value = demoClubs.value.map((club) => (club.id === next.id ? next : club));
  }

  async function loadMembers(clubId: string, force = false): Promise<ClubActionResult> {
    if (members.value[clubId] && !force) {
      return { ok: true };
    }

    try {
      const list = isServerClubId(clubId)
        ? (await authorized((token) => getServerClubMembers(token, clubId))).map(toClubMember)
        : await fetchClubMembers(clubId);
      members.value = { ...members.value, [clubId]: list };
      return { ok: true };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    }
  }

  /** POST /clubs: one server transaction creates the club, the OWNER membership, and the club chat. */
  async function create(input: ClubCreateInput): Promise<ClubCreateResult> {
    try {
      const club = upsertServer(toClub(await authorized((token) => createServerClub(token, input))));
      return { ok: true, club };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    }
  }

  async function update(clubId: string, input: ClubUpdateInput): Promise<ClubCreateResult> {
    try {
      const club = upsertServer(toClub(await authorized((token) => updateServerClub(token, clubId, input))));
      return { ok: true, club };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    }
  }

  function updateDemoMemberList(clubId: string, viewer: UserSummary, joined: boolean): void {
    const list = members.value[clubId];

    if (!list) {
      return;
    }

    const without = list.filter((entry) => entry.user.id !== viewer.id);
    members.value = {
      ...members.value,
      [clubId]: joined ? [...without, { user: viewer, role: 'MEMBER', joinedAt: new Date().toISOString() }] : without,
    };
  }

  function dropMemberList(clubId: string): void {
    const next = { ...members.value };
    delete next[clubId];
    members.value = next;
  }

  async function join(clubId: string, viewer: UserSummary | null): Promise<ClubJoinResult> {
    if (isServerClubId(clubId)) {
      try {
        const result = await authorized((token) => joinServerClub(token, clubId));
        upsertServer(toClub(result.club));
        dropMemberList(clubId);
        return { ok: true, status: result.status };
      } catch (caught) {
        await loadClub(clubId);
        return { ok: false, message: describeClubError(caught) };
      }
    }

    const club = byId(clubId);

    if (!club || !viewer) {
      return { ok: false, message: 'This club is not available.' };
    }

    const next = applyJoin(club);

    if (next === club) {
      return { ok: false, message: 'You cannot join this club right now.' };
    }

    replaceDemo(next);
    const joined = next.viewerMembership?.status === 'ACTIVE';
    updateDemoMemberList(clubId, viewer, joined);
    await setClubMembership(clubId, true);
    return { ok: true, status: joined ? 'JOINED' : 'REQUESTED' };
  }

  /** Leave, or cancel a pending request. */
  async function leave(clubId: string, viewer: UserSummary | null): Promise<ClubActionResult> {
    if (isServerClubId(clubId)) {
      try {
        upsertServer(toClub(await authorized((token) => leaveServerClub(token, clubId))));
        dropMemberList(clubId);
        return { ok: true };
      } catch (caught) {
        return { ok: false, message: describeClubError(caught) };
      }
    }

    const club = byId(clubId);

    if (!club || !viewer) {
      return { ok: false, message: 'This club is not available.' };
    }

    const next = applyLeave(club);

    if (next !== club) {
      replaceDemo(next);
      updateDemoMemberList(clubId, viewer, false);
      await setClubMembership(clubId, false);
    }

    return { ok: true };
  }

  /** ClubFollow for demo clubs; following server clubs comes with the Follow endpoints. */
  async function toggleFollow(clubId: string): Promise<void> {
    const club = byId(clubId);

    if (!club || isServerClubId(clubId)) {
      return;
    }

    replaceDemo({ ...club, viewerFollows: !club.viewerFollows });
    await setClubFollow(clubId, !club.viewerFollows);
  }

  async function fetchRequests(clubId: string): Promise<ClubJoinRequest[] | string> {
    try {
      return (await authorized((token) => getServerClubRequests(token, clubId))).map(toClubJoinRequest);
    } catch (caught) {
      return describeClubError(caught);
    }
  }

  async function fetchInvites(clubId: string): Promise<ClubInvite[] | string> {
    try {
      return (await authorized((token) => getServerClubInvites(token, clubId))).map(toClubInvite);
    } catch (caught) {
      return describeClubError(caught);
    }
  }

  /** After any membership change the club is re-read, so the capacity shown is the server's. */
  async function afterMembershipChange(clubId: string): Promise<void> {
    dropMemberList(clubId);
    await loadClub(clubId);
  }

  async function approve(clubId: string, userId: string): Promise<ClubActionResult> {
    try {
      await authorized((token) => approveServerClubRequest(token, clubId, userId));
      return { ok: true };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    } finally {
      await afterMembershipChange(clubId);
    }
  }

  async function reject(clubId: string, userId: string): Promise<ClubActionResult> {
    try {
      await authorized((token) => rejectServerClubRequest(token, clubId, userId));
      return { ok: true };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    }
  }

  async function removeMember(clubId: string, userId: string): Promise<ClubActionResult> {
    try {
      await authorized((token) => removeServerClubMember(token, clubId, userId));
      return { ok: true };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    } finally {
      await afterMembershipChange(clubId);
    }
  }

  async function invite(clubId: string, username: string): Promise<ClubActionResult> {
    try {
      await authorized((token) => inviteToServerClub(token, clubId, username.trim().replace(/^@+/, '')));
      return { ok: true };
    } catch (caught) {
      return { ok: false, message: describeClubError(caught) };
    }
  }

  return {
    clubs,
    members,
    isLoaded,
    serverError,
    feedClubIds,
    load,
    refreshMine,
    loadClub,
    byId,
    loadMembers,
    create,
    update,
    join,
    leave,
    toggleFollow,
    fetchRequests,
    fetchInvites,
    approve,
    reject,
    removeMember,
    invite,
  };
});
