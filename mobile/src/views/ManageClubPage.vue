<template>
  <ion-page>
    <SubPageHeader title="Manage Club" :back-href="`/clubs/${clubId}`" />

    <ion-content>
      <div class="manage">
        <p v-if="lookup === 'missing'" class="manage__empty">This club does not exist or was disabled.</p>
        <p v-else-if="lookupError" class="manage__empty" role="alert">{{ lookupError }}</p>
        <p v-else-if="club && !isServer" class="manage__empty">Demo clubs can't be managed. Create your own club to try it.</p>
        <p v-else-if="club && !canManageMembers" class="manage__empty">Only the club owner and admins can manage this club.</p>

        <template v-else-if="club">
          <div class="manage__summary">
            <ClubAvatar :club="club" :image-url="club.profileImageUrl" :size="48" />
            <span>
              <strong>{{ club.name }}</strong>
              <span>
                {{ formatClubCapacity(club) }} ·
                <span :class="{ 'manage__full': isClubFull(club) }">{{ formatClubSlots(club) }}</span>
              </span>
            </span>
          </div>

          <SegmentTabs v-model="tab" :options="tabOptions" aria-label="Manage club" />

          <form v-if="tab === 'SETTINGS'" class="manage__settings" novalidate @submit.prevent="save">
            <ClubFormFields
              v-model="form"
              :errors="errors"
              :sport-options="sportsStore.activeSports"
              :show-all="submitted"
              :current-members="club.memberCount"
            />
            <p v-if="saveError" class="manage__alert" role="alert">{{ saveError }}</p>
            <p v-else-if="submitted && hasErrors" class="manage__alert" role="alert">Fix the highlighted fields to save.</p>
            <button type="submit" class="manage__primary" :disabled="saving || !dirty">
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </button>
          </form>

          <section v-else-if="tab === 'REQUESTS'" class="manage__list" aria-label="Join requests">
            <p v-if="listError" class="manage__alert" role="alert">{{ listError }}</p>
            <p v-else-if="requests.length === 0" class="manage__empty">No pending requests.</p>
            <p v-else class="manage__hint">Pending requests don't use a slot until you approve them.</p>
            <article v-for="request in requests" :key="request.user.id" class="manage__row">
              <UserAvatar :user="request.user" :size="40" />
              <span class="manage__row-text">
                <strong>{{ request.user.displayName }}</strong>
                <span>@{{ request.user.username }} · {{ formatTimeAgo(Date.parse(request.requestedAt), now) }}</span>
              </span>
              <button
                type="button"
                class="manage__small manage__small--primary"
                :disabled="busyId === request.user.id || isClubFull(club)"
                @click="approve(request.user.id)"
              >
                Approve
              </button>
              <button type="button" class="manage__small" :disabled="busyId === request.user.id" @click="reject(request.user.id)">
                Reject
              </button>
            </article>
          </section>

          <section v-else-if="tab === 'INVITES'" class="manage__list" aria-label="Invitations">
            <form class="manage__invite" @submit.prevent="invite">
              <input v-model="inviteName" class="manage__input" placeholder="@username" aria-label="Username to invite" />
              <button type="submit" class="manage__small manage__small--primary" :disabled="!inviteName.trim() || inviting">
                Invite
              </button>
            </form>
            <p class="manage__hint">
              {{
                club.membershipType === 'INVITE_ONLY'
                  ? 'This club is invite only: an invitation is the only way in.'
                  : 'Invited people can join straight away while there is room.'
              }}
            </p>
            <p v-if="listError" class="manage__alert" role="alert">{{ listError }}</p>
            <p v-else-if="invites.length === 0" class="manage__empty">No pending invitations.</p>
            <article v-for="entry in invites" :key="entry.id" class="manage__row">
              <UserAvatar :user="entry.invitee" :size="40" />
              <span class="manage__row-text">
                <strong>{{ entry.invitee.displayName }}</strong>
                <span>Invited {{ formatTimeAgo(Date.parse(entry.createdAt), now) }}</span>
              </span>
            </article>
          </section>

          <section v-else class="manage__list" aria-label="Members">
            <p v-if="listError" class="manage__alert" role="alert">{{ listError }}</p>
            <article v-for="member in members" :key="member.user.id" class="manage__row">
              <UserAvatar :user="member.user" :size="40" />
              <span class="manage__row-text">
                <strong>{{ member.user.displayName }}</strong>
                <span>{{ CLUB_ROLE_LABELS[member.role] }}</span>
              </span>
              <button
                v-if="canRemove(member.role)"
                type="button"
                class="manage__small manage__small--danger"
                :disabled="busyId === member.user.id"
                @click="remove(member.user.id, member.user.displayName)"
              >
                Remove
              </button>
            </article>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonContent, IonPage, alertController, onIonViewWillEnter } from '@ionic/vue';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import ClubFormFields from '@/components/clubs/ClubFormFields.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useNow } from '@/composables/useNow';
import { useClubsStore } from '@/stores/clubs';
import { useSportsStore } from '@/stores/sports';
import type { ClubForm, ClubInvite, ClubJoinRequest, ClubMemberRole } from '@/types/club';
import { isServerClubId } from '@/utils/club-chat';
import { clubToForm, emptyClubForm, toClubUpdateInput, validateClubForm } from '@/utils/club-form';
import { CLUB_ROLE_LABELS, formatClubCapacity, formatClubSlots, isClubFull } from '@/utils/clubs';
import { showNotice } from '@/utils/notice';
import { formatTimeAgo } from '@/utils/time';

type ManageTab = 'SETTINGS' | 'REQUESTS' | 'INVITES' | 'MEMBERS';

const route = useRoute();
/** Fixed per page instance; Ionic keeps earlier pages cached while the route changes. */
const clubId = String(route.params.clubId ?? '');
const isServer = isServerClubId(clubId);
const clubsStore = useClubsStore();
const sportsStore = useSportsStore();
const now = useNow();

const lookup = ref<'loading' | 'found' | 'missing' | 'error'>('loading');
const lookupError = ref<string | null>(null);
const tab = ref<ManageTab>('REQUESTS');
const form = ref<ClubForm>(emptyClubForm());
const original = ref<ClubForm>(emptyClubForm());
const submitted = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);
const requests = ref<ClubJoinRequest[]>([]);
const invites = ref<ClubInvite[]>([]);
const listError = ref<string | null>(null);
const busyId = ref<string | null>(null);
const inviteName = ref('');
const inviting = ref(false);
let openedOnce = false;

const club = computed(() => clubsStore.byId(clubId));
const canManageClub = computed(() => !!club.value?.viewerCanManageClub);
const canManageMembers = computed(() => !!club.value?.viewerCanManageMembers);
const viewerRole = computed(() => club.value?.viewerMembership?.role ?? null);
const members = computed(() => clubsStore.members[clubId] ?? []);
const errors = computed(() => validateClubForm(form.value, { currentMembers: club.value?.memberCount ?? 0 }));
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value));

const tabOptions = computed(() => [
  ...(canManageClub.value ? [{ id: 'SETTINGS' as const, label: 'Settings' }] : []),
  { id: 'REQUESTS' as const, label: 'Requests' },
  { id: 'INVITES' as const, label: 'Invites' },
  { id: 'MEMBERS' as const, label: 'Members' },
]);

/** Mirrors canManageMember on the server, which has the final say. */
function canRemove(role: ClubMemberRole): boolean {
  if (role === 'OWNER') {
    return false;
  }

  return viewerRole.value === 'OWNER' || (viewerRole.value === 'ADMIN' && (role === 'MODERATOR' || role === 'MEMBER'));
}

async function loadTab(value: ManageTab): Promise<void> {
  listError.value = null;

  if (value === 'REQUESTS') {
    const result = await clubsStore.fetchRequests(clubId);
    requests.value = typeof result === 'string' ? [] : result;
    listError.value = typeof result === 'string' ? result : null;
  } else if (value === 'INVITES') {
    const result = await clubsStore.fetchInvites(clubId);
    invites.value = typeof result === 'string' ? [] : result;
    listError.value = typeof result === 'string' ? result : null;
  } else if (value === 'MEMBERS') {
    const result = await clubsStore.loadMembers(clubId, true);
    listError.value = result.ok ? null : result.message;
  }
}

watch(tab, (value) => {
  void loadTab(value);
});

function resetForm(): void {
  if (club.value) {
    form.value = clubToForm(club.value);
    original.value = clubToForm(club.value);
    submitted.value = false;
    saveError.value = null;
  }
}

async function refresh(): Promise<void> {
  if (!isServer) {
    lookup.value = 'found';
    await clubsStore.load();
    return;
  }

  const result = await clubsStore.loadClub(clubId);
  lookup.value = result.status;
  lookupError.value = result.status === 'error' ? result.message : null;

  if (result.status !== 'found') {
    return;
  }

  if (canManageClub.value) {
    void sportsStore.fetchSports();

    if (!dirty.value) {
      resetForm();
    }

    if (!openedOnce) {
      tab.value = 'SETTINGS';
    }
  }

  openedOnce = true;

  await loadTab(tab.value);
}

async function save(): Promise<void> {
  submitted.value = true;
  saveError.value = null;

  if (hasErrors.value || !club.value) {
    return;
  }

  saving.value = true;

  try {
    const result = await clubsStore.update(clubId, toClubUpdateInput(form.value, original.value));

    if (result.ok) {
      resetForm();
      void showNotice('Club settings saved.');
    } else {
      saveError.value = result.message;
    }
  } finally {
    saving.value = false;
  }
}

async function approve(userId: string): Promise<void> {
  busyId.value = userId;
  const result = await clubsStore.approve(clubId, userId);
  busyId.value = null;
  void showNotice(result.ok ? 'Request approved.' : result.message);
  await loadTab('REQUESTS');
}

async function reject(userId: string): Promise<void> {
  busyId.value = userId;
  const result = await clubsStore.reject(clubId, userId);
  busyId.value = null;
  void showNotice(result.ok ? 'Request rejected.' : result.message);
  await loadTab('REQUESTS');
}

async function invite(): Promise<void> {
  inviting.value = true;
  const result = await clubsStore.invite(clubId, inviteName.value);
  inviting.value = false;

  if (result.ok) {
    void showNotice(`Invitation sent to @${inviteName.value.trim().replace(/^@+/, '')}.`);
    inviteName.value = '';
    await loadTab('INVITES');
  } else {
    void showNotice(result.message);
  }
}

async function remove(userId: string, name: string): Promise<void> {
  const alert = await alertController.create({
    header: `Remove ${name}?`,
    message: 'They lose access to the club chat and free up a member slot.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Remove', role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  busyId.value = userId;
  const result = await clubsStore.removeMember(clubId, userId);
  busyId.value = null;
  void showNotice(result.ok ? `${name} was removed.` : result.message);
  await loadTab('MEMBERS');
}

onIonViewWillEnter(() => {
  void refresh();
});
</script>

<style scoped>
.manage {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 16px 40px;
}

.manage__summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: var(--gora-surface);
}

.manage__summary > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  font-size: 0.8rem;
}

.manage__summary strong {
  font-size: 0.98rem;
}

.manage__summary > span > span {
  color: var(--gora-muted);
}

.manage__full {
  color: #ef5b5b;
  font-weight: 800;
}

.manage__settings,
.manage__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.manage__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--gora-surface);
}

.manage__row-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  font-size: 0.88rem;
}

.manage__row-text span {
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.manage__invite {
  display: flex;
  gap: 8px;
}

.manage__input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
}

.manage__small {
  padding: 8px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
}

.manage__small--primary {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.manage__small--danger {
  border-color: rgba(239, 91, 91, 0.5);
  color: #ef5b5b;
}

.manage__small:disabled {
  opacity: 0.45;
  cursor: default;
}

.manage__primary {
  padding: 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.manage__primary:disabled {
  background: #1b2a37;
  color: #7d8a93;
  cursor: default;
}

.manage__empty,
.manage__hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.manage__alert {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
  font-size: 0.82rem;
  font-weight: 600;
}
</style>
