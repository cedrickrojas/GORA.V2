<template>
  <ion-page>
    <SubPageHeader :title="created ? 'Club Created' : 'Create Club'" back-href="/profile/settings" />

    <ion-content ref="contentRef">
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

      <form id="create-club-form" ref="formRef" v-else class="create-club" novalidate @submit.prevent="advance">
        <header class="create-club__step-header">
          <p class="create-club__step-count">Step {{ activeStep + 1 }} of {{ CLUB_STEPS.length }}</p>
          <div
            class="create-club__progress"
            role="progressbar"
            aria-label="Club setup progress"
            aria-valuemin="1"
            :aria-valuemax="CLUB_STEPS.length"
            :aria-valuenow="activeStep + 1"
          >
            <span :style="{ width: `${((activeStep + 1) / CLUB_STEPS.length) * 100}%` }" />
          </div>
          <h2 ref="stepHeading" class="create-club__step-title" tabindex="-1">{{ currentStep.title }}</h2>
          <p class="create-club__step-hint">{{ currentStep.hint }}</p>
        </header>

        <p v-if="sportsError" class="create-club__alert" role="alert">{{ sportsError }}</p>
        <ClubFormFields
          v-show="!isReview"
          v-model="form"
          :section="currentStep.section ?? 'identity'"
          :errors="errors"
          :sport-options="sportsStore.activeSports"
          :show-all="submitted || attemptedSteps.has(activeStep)"
          suggest-username
        />

        <section v-if="isReview" class="create-club__review" aria-label="Review club">
          <div class="create-club__preview">
            <ClubAvatar :club="previewSummary" :image-url="form.profileImageUrl.trim() || null" :size="64" />
            <span>
              <strong>{{ previewSummary.name }}</strong>
              <span>@{{ form.username }}</span>
              <span>Members: 1 / {{ previewCapacity }}</span>
            </span>
          </div>
          <article v-for="(summary, index) in reviewSections" :key="summary.title" class="create-club__review-card">
            <div class="create-club__review-heading">
              <h3>{{ summary.title }}</h3>
              <button type="button" :disabled="isSaving" :aria-label="`Edit ${summary.title}`" @click="goToStep(index)">
                Edit
              </button>
            </div>
            <p v-for="(line, lineIndex) in summary.lines" :key="lineIndex">{{ line }}</p>
          </article>
        </section>

        <p v-if="serverError" class="create-club__alert" role="alert">{{ serverError }}</p>
        <p v-if="stepMessage" class="create-club__alert" role="alert">{{ stepMessage }}</p>
      </form>
    </ion-content>
    <ion-footer v-if="!created">
      <div class="create-club__actions">
        <button
          v-if="activeStep > 0"
          type="button"
          class="create-club__back"
          :disabled="isSaving"
          @click="goToStep(activeStep - 1)"
        >
          Back
        </button>
        <button type="submit" form="create-club-form" class="create-club__submit" :disabled="isSaving">
          {{ isReview ? (isSaving ? 'Creating...' : 'Create Club') : 'Next' }}
        </button>
      </div>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonFooter, IonIcon, IonPage, onIonViewDidLeave } from '@ionic/vue';
import { chatbubblesOutline } from 'ionicons/icons';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import ClubFormFields from '@/components/clubs/ClubFormFields.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useClubsStore } from '@/stores/clubs';
import { useSportsStore } from '@/stores/sports';
import type { Club, ClubForm, ClubSummary } from '@/types/club';
import {
  ACTIVITY_DAY_LABELS,
  MEMBERSHIP_TYPE_LABELS,
  checkMaxMembers,
  emptyClubForm,
  toClubCreateInput,
  validateClubForm,
  type ClubFormField,
  type ClubFormSection,
} from '@/utils/club-form';
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

const activeStep = ref(0);
const attemptedSteps = ref(new Set<number>());
const stepMessage = ref<string | null>(null);
const formRef = ref<HTMLFormElement | null>(null);
const stepHeading = ref<HTMLElement | null>(null);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const CLUB_STEPS: readonly {
  title: string;
  hint: string;
  section?: ClubFormSection;
  fields: readonly ClubFormField[];
}[] = [
  {
    title: 'Club Details',
    hint: 'Give your club a name, username, and short description.',
    section: 'identity',
    fields: ['name', 'username', 'description'],
  },
  {
    title: 'Photos & About',
    hint: 'Add optional photos and tell people about your club.',
    section: 'photos',
    fields: ['profileImageUrl', 'coverImageUrl', 'about'],
  },
  {
    title: 'Sports',
    hint: 'Choose your primary sport and any additional sports.',
    section: 'sports',
    fields: ['primarySportId', 'additionalSportIds'],
  },
  {
    title: 'Location',
    hint: 'Add your club location and home court. These details are optional.',
    section: 'location',
    fields: ['country', 'city', 'barangay', 'homeCourt', 'locationName', 'latitude', 'longitude', 'location'],
  },
  {
    title: 'Membership',
    hint: 'Set your member limit, joining options, and privacy.',
    section: 'membership',
    fields: ['maxMembers', 'membershipType', 'isPublic'],
  },
  {
    title: 'Rules & Tags',
    hint: 'Add optional club rules and tags to help people find you.',
    section: 'rules',
    fields: ['rules', 'tags'],
  },
  {
    title: 'Schedule',
    hint: 'Share your optional activity and training schedule.',
    section: 'schedule',
    fields: ['activityDay', 'activityStartTime', 'activityEndTime', 'trainingSchedule'],
  },
  {
    title: 'Contact',
    hint: 'Add optional contact details and social links.',
    section: 'contact',
    fields: ['contactEmail', 'websiteUrl', 'facebookUrl', 'instagramUrl', 'tiktokUrl'],
  },
  { title: 'Review', hint: 'Check your club before creating it. You can edit any section.', fields: [] },
];
const currentStep = computed(() => CLUB_STEPS[activeStep.value]);
const isReview = computed(() => activeStep.value === CLUB_STEPS.length - 1);

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

const reviewSections = computed(() => {
  const value = form.value;
  const sportName = (id: string) => sportsStore.activeSports.find((sport) => sport.id === id)?.name ?? id;
  const optionalLines = (lines: string[]) =>
    lines.filter((line) => line.trim()).length ? lines.filter((line) => line.trim()) : ['Not set'];
  return [
    { title: 'Club Details', lines: [value.name, `@${value.username}`, value.description] },
    {
      title: 'Photos & About',
      lines: optionalLines([
        value.profileImageUrl ? `Profile photo: ${value.profileImageUrl}` : '',
        value.coverImageUrl ? `Cover photo: ${value.coverImageUrl}` : '',
        value.about,
      ]),
    },
    { title: 'Sports', lines: [sportName(value.primarySportId), ...value.additionalSportIds.map(sportName)] },
    {
      title: 'Location',
      lines: optionalLines([
        value.country,
        value.city,
        value.barangay,
        value.homeCourt,
        value.locationName,
        value.latitude ? `${value.latitude}, ${value.longitude}` : '',
      ]),
    },
    {
      title: 'Membership',
      lines: [
        `Up to ${previewCapacity.value} members`,
        MEMBERSHIP_TYPE_LABELS[value.membershipType],
        value.isPublic ? 'Public' : 'Private',
      ],
    },
    {
      title: 'Rules & Tags',
      lines: optionalLines([
        ...value.rules.map((rule, index) => `${index + 1}. ${rule}`),
        value.tags.map((tag) => `#${tag}`).join(' '),
      ]),
    },
    {
      title: 'Schedule',
      lines: optionalLines([
        value.activityDay ? ACTIVITY_DAY_LABELS[value.activityDay] : '',
        [value.activityStartTime, value.activityEndTime].filter(Boolean).join(' - '),
        value.trainingSchedule,
      ]),
    },
    {
      title: 'Contact',
      lines: optionalLines([
        value.contactEmail,
        value.websiteUrl,
        value.facebookUrl,
        value.instagramUrl,
        value.tiktokUrl,
      ]),
    },
  ];
});

async function goToStep(index: number): Promise<void> {
  if (isSaving.value || index < 0 || index >= CLUB_STEPS.length) return;
  activeStep.value = index;
  stepMessage.value = null;
  await nextTick();
  void contentRef.value?.$el.scrollToTop?.(0);
  stepHeading.value?.focus({ preventScroll: true });
}

async function focusFirstError(): Promise<void> {
  await nextTick();
  const error = formRef.value?.querySelector('.club-form__error');
  const container = error?.closest('.club-form__field') ?? error?.closest('.club-form__section');
  container?.querySelector<HTMLElement>('input, select, textarea')?.focus();
}

async function advance(): Promise<void> {
  if (isSaving.value) return;
  serverError.value = null;
  if (isReview.value) {
    await submit();
    return;
  }
  attemptedSteps.value = new Set([...attemptedSteps.value, activeStep.value]);
  if (currentStep.value.fields.some((field) => errors.value[field])) {
    stepMessage.value = 'Complete the highlighted fields to continue.';
    await focusFirstError();
    return;
  }
  await goToStep(activeStep.value + 1);
}

async function submit(): Promise<void> {
  submitted.value = true;
  serverError.value = null;

  if (isSaving.value) return;
  if (hasErrors.value) {
    const invalidStep = CLUB_STEPS.findIndex((step) => step.fields.some((field) => errors.value[field]));
    if (invalidStep >= 0) {
      await goToStep(invalidStep);
      stepMessage.value = 'Check the highlighted fields before creating your club.';
      await focusFirstError();
    }
    return;
  }

  isSaving.value = true;

  try {
    const result = await clubsStore.create(toClubCreateInput(form.value));

    if (result.ok) {
      created.value = result.club;
      form.value = emptyClubForm();
      submitted.value = false;
      activeStep.value = 0;
      attemptedSteps.value = new Set();
      stepMessage.value = null;
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
.create-club__step-header {
  display: grid;
  gap: 10px;
  margin-bottom: 8px;
}
.create-club__step-count {
  margin: 0;
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 700;
}
.create-club__progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--gora-line);
}
.create-club__progress span {
  display: block;
  height: 100%;
  background: var(--ion-color-primary);
}
.create-club__step-title {
  margin: 6px 0 0;
  font-size: 1.3rem;
  font-weight: 800;
}
.create-club__step-title:focus {
  outline: none;
}
.create-club__step-hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}
.create-club__review {
  display: grid;
  gap: 14px;
}
.create-club__review-card {
  padding: 16px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  background: var(--gora-surface);
  overflow-wrap: anywhere;
}
.create-club__review-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.create-club__review-heading h3 {
  margin: 0;
  font-size: 0.85rem;
}
.create-club__review-heading button {
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: var(--gora-surface-raised);
  color: var(--ion-color-primary);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.create-club__review-card p {
  margin: 6px 0 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-line;
}
.create-club__actions {
  display: flex;
  max-width: var(--gora-column, 680px);
  gap: 12px;
  margin: 0 auto;
  padding: 12px 16px max(12px, var(--gora-input-safe-bottom, env(safe-area-inset-bottom)));
  border-top: 1px solid var(--gora-line);
  background: var(--ion-background-color);
}
.create-club__back {
  flex: 1;
  min-height: 48px;
  padding: 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
.create-club__back:disabled {
  opacity: 0.5;
  cursor: wait;
}

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
  flex: 1;
  min-height: 48px;
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
