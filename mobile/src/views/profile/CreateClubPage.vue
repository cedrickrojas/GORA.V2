<template>
  <ion-page>
    <SubPageHeader :title="created ? 'Club Created' : 'Create Club'" back-href="/profile/settings" />

    <ion-content>
      <section v-if="created" class="club-created" aria-live="polite">
        <p class="club-created__badge">CLUB CREATED!</p>
        <ClubAvatar :club="created" :image-url="created.profileImageUrl" :size="84" />
        <h1 class="club-created__name">
          <span aria-hidden="true">{{ getSportMarker(created.sport ?? 'Other') }}</span>
          {{ created.name }}
        </h1>
        <p class="club-created__handle">@{{ created.slug }}</p>
        <p class="club-created__owner">You are the Owner.</p>
        <p class="club-created__members">Members: {{ created.memberCount }} / {{ created.maxMembers }}</p>
        <p class="club-created__chat">
          <ion-icon :icon="chatbubblesOutline" aria-hidden="true" />
          Your official Club Group Chat has been created.
        </p>
        <div class="club-created__actions">
          <button type="button" class="club-created__primary" @click="goToClub">Go to Club</button>
          <button type="button" class="club-created__secondary" @click="openChat">Open Club Chat</button>
        </div>
      </section>

      <form v-else class="create-club" novalidate @submit.prevent="submit">
        <div class="create-club__preview">
          <ClubAvatar :club="previewSummary" :image-url="form.profileImageUrl.trim() || null" :size="64" />
          <span>
            <strong>{{ previewSummary.name }}</strong>
            <span>@{{ form.username || 'your-club' }}</span>
            <span>Members: 1 / {{ previewCapacity }}</span>
          </span>
        </div>

        <p v-if="sportsError" class="create-club__alert" role="alert">{{ sportsError }}</p>

        <ClubFormFields
          v-model="form"
          :errors="errors"
          :sport-options="sportsStore.activeSports"
          :show-all="submitted"
          suggest-username
        />

        <p v-if="serverError" class="create-club__alert" role="alert">{{ serverError }}</p>
        <p v-else-if="submitted && hasErrors" class="create-club__alert" role="alert">
          Fix the highlighted fields to create your club.
        </p>

        <button type="submit" class="create-club__submit" :disabled="isSaving">
          {{ isSaving ? 'Creating…' : 'Create Club' }}
        </button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, onIonViewDidLeave } from '@ionic/vue';
import { chatbubblesOutline } from 'ionicons/icons';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import ClubFormFields from '@/components/clubs/ClubFormFields.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useClubsStore } from '@/stores/clubs';
import { useSportsStore } from '@/stores/sports';
import type { Club, ClubForm, ClubSummary } from '@/types/club';
import { checkMaxMembers, emptyClubForm, toClubCreateInput, validateClubForm } from '@/utils/club-form';
import { getSportMarker } from '@/utils/sports';

const router = useRouter();
const clubsStore = useClubsStore();
const sportsStore = useSportsStore();

const form = ref<ClubForm>(emptyClubForm());
const submitted = ref(false);
const isSaving = ref(false);
const serverError = ref<string | null>(null);
const sportsError = ref<string | null>(null);
const created = ref<Club | null>(null);

const errors = computed(() => validateClubForm(form.value));
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const primarySportName = computed(
  () => sportsStore.activeSports.find((option) => option.id === form.value.primarySportId)?.name ?? null,
);
const previewSummary = computed<ClubSummary>(() => ({
  id: 'preview',
  slug: form.value.username,
  name: form.value.name.trim() || 'Your club',
  sport: primarySportName.value,
}));
const previewCapacity = computed(() =>
  checkMaxMembers(form.value.maxMembers) === null ? Number(form.value.maxMembers.trim()) : '?',
);

async function submit(): Promise<void> {
  submitted.value = true;
  serverError.value = null;

  if (hasErrors.value || isSaving.value) {
    return;
  }

  isSaving.value = true;

  try {
    const result = await clubsStore.create(toClubCreateInput(form.value));

    if (result.ok) {
      created.value = result.club;
      form.value = emptyClubForm();
      submitted.value = false;
    } else {
      serverError.value = result.message;
    }
  } finally {
    isSaving.value = false;
  }
}

function goToClub(): void {
  if (created.value) {
    void router.replace(`/clubs/${created.value.id}`);
  }
}

function openChat(): void {
  if (created.value) {
    void router.replace(`/chat/clubs/${created.value.id}`);
  }
}

async function loadSports(): Promise<void> {
  const result = await sportsStore.fetchSports();
  sportsError.value = result.ok ? null : `Couldn't load sports: ${result.message}`;
}

onIonViewDidLeave(() => {
  created.value = null;
});

onMounted(() => {
  void loadSports();
});
</script>

<style scoped>
.create-club {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 40px;
}

.create-club__preview {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
  padding: 14px;
  border-radius: 16px;
  background: var(--gora-surface);
}

.create-club__preview > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.create-club__preview strong {
  overflow: hidden;
  font-size: 1.05rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-club__preview > span span {
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.create-club__alert {
  margin: 4px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
  font-size: 0.82rem;
  font-weight: 600;
}

.create-club__submit {
  margin-top: 12px;
  padding: 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.create-club__submit:disabled {
  background: #1b2a37;
  color: #7d8a93;
  cursor: default;
}

.club-created {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.club-created__badge {
  margin: 0 0 12px;
  color: var(--ion-color-primary);
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.club-created__name {
  margin: 12px 0 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.club-created__handle {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.club-created__owner {
  margin: 8px 0 0;
  font-weight: 700;
}

.club-created__members {
  margin: 0;
  color: var(--ion-color-primary);
  font-weight: 700;
}

.club-created__chat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.club-created__actions {
  display: flex;
  width: 100%;
  max-width: 360px;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.club-created__primary,
.club-created__secondary {
  padding: 13px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.club-created__primary {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.club-created__secondary {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
}
</style>
