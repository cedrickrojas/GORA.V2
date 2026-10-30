<template>
  <ion-page>
    <SubPageHeader :title="pageTitle" :back-href="editId ? `/games/${editId}` : '/create'" />

    <ion-content ref="contentRef">
      <section v-if="created" class="game-created" aria-live="polite">
        <p class="game-created__badge">GAME CREATED!</p>
        <p class="game-created__note">
          {{
            created.autoAccept
              ? 'Players can join automatically while slots are available.'
              : 'Players can request to join. You decide who to accept.'
          }}
        </p>
        <GamePreviewCard :game="created" />
        <button type="button" class="game-created__again" @click="startOver">Create another game</button>
      </section>

      <p v-else-if="editId && editBlocker" class="create-game__blocked" role="alert">{{ editBlocker }}</p>

      <form id="create-game-form" ref="formRef" v-else class="create-game" novalidate @submit.prevent="advance">
        <header class="create-game__step-header">
          <p class="create-game__step-count">Step {{ activeStep + 1 }} of {{ GAME_STEPS.length }}</p>
          <div
            class="create-game__progress"
            role="progressbar"
            aria-label="Game setup progress"
            aria-valuemin="1"
            :aria-valuemax="GAME_STEPS.length"
            :aria-valuenow="activeStep + 1"
          >
            <span :style="{ width: `${((activeStep + 1) / GAME_STEPS.length) * 100}%` }" />
          </div>
          <h2 ref="stepHeading" class="create-game__step-title" tabindex="-1">{{ currentStep.title }}</h2>
          <p class="create-game__step-hint">{{ currentStep.hint }}</p>
        </header>
        <p v-if="sportsError" class="create-game__alert" role="alert">{{ sportsError }}</p>
        <section v-if="activeStep === 0" class="create-game__step" :aria-label="currentStep.title">
          <div class="create-game__field" @focusout="touch('sportId')">
            <label class="create-game__label" for="game-sport">Sport *</label>
            <select id="game-sport" v-model="form.sportId" class="create-game__input">
              <option value="" disabled>{{ sportOptions.length ? 'Choose a sport' : 'Loading sports…' }}</option>
              <option v-for="option in sportOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
            </select>
            <p v-if="shown('sportId')" class="create-game__error">{{ errors.sportId }}</p>
          </div>

          <div class="create-game__field" @focusout="touch('title')">
            <label class="create-game__label" for="game-title">
              Title *
              <span class="create-game__counter">{{ form.title.trim().length }} / {{ GAME_TITLE_MAX }}</span>
            </label>
            <input
              id="game-title"
              v-model="form.title"
              class="create-game__input"
              :maxlength="GAME_TITLE_MAX"
              placeholder="Sunday Pickup Basketball"
              autocomplete="off"
            />
            <p v-if="shown('title')" class="create-game__error">{{ errors.title }}</p>
          </div>

          <div class="create-game__field" @focusout="touch('description')">
            <label class="create-game__label" for="game-description">
              Caption
              <span class="create-game__counter"
                >{{ form.description.trim().length }} / {{ GAME_DESCRIPTION_MAX }}</span
              >
            </label>
            <textarea
              id="game-description"
              v-model="form.description"
              class="create-game__input"
              rows="3"
              :maxlength="GAME_DESCRIPTION_MAX"
              placeholder="Friendly 5v5, all levels. Bring a white and a dark shirt."
            />
            <p v-if="shown('description')" class="create-game__error">{{ errors.description }}</p>
          </div>
        </section>

        <section v-if="activeStep === 1" class="create-game__step" :aria-label="currentStep.title">
          <div class="create-game__field" @focusout="touch('requiredPlayers')">
            <label class="create-game__label" for="game-players">Required players *</label>
            <input
              id="game-players"
              v-model="form.requiredPlayers"
              type="number"
              inputmode="numeric"
              min="1"
              :max="GAME_PLAYERS_MAX"
              step="1"
              class="create-game__input create-game__input--narrow"
              placeholder="12"
            />
            <p v-if="shown('requiredPlayers')" class="create-game__error">{{ errors.requiredPlayers }}</p>
            <p v-else class="create-game__hint">
              Everyone who plays, including you if you play. You are not added automatically.
            </p>
          </div>

          <div class="create-game__field">
            <label class="create-game__label" for="game-acceptance">Player approval</label>
            <select id="game-acceptance" v-model="form.autoAccept" class="create-game__input">
              <option :value="false">Manual Accept</option>
              <option :value="true">Auto Accept</option>
            </select>
            <p class="create-game__hint">
              {{
                form.autoAccept
                  ? 'New requests are accepted automatically while slots are available.'
                  : 'Review each join request and accept or decline it yourself.'
              }}
              <span v-if="editId">Existing pending requests still need your review.</span>
            </p>
          </div>

          <div class="create-game__field">
            <label class="create-game__label" for="game-club">Club</label>
            <select id="game-club" v-model="form.clubId" class="create-game__input">
              <option value="">No club</option>
              <option v-for="club in clubOptions" :key="club.id" :value="club.id">{{ club.name }}</option>
            </select>
            <p class="create-game__hint">Clubs you are an active member of. You stay the host.</p>
          </div>
        </section>

        <section v-if="activeStep === 2" class="create-game__step" :aria-label="currentStep.title">
          <div class="create-game__field" @focusout="touch('gameDate')">
            <label class="create-game__label" for="game-date">Date *</label>
            <input id="game-date" v-model="form.gameDate" type="date" class="create-game__input" :min="today" />
            <p v-if="shown('gameDate')" class="create-game__error">{{ errors.gameDate }}</p>
          </div>

          <div class="create-game__grid">
            <div class="create-game__field" @focusout="touch('startTime')">
              <label class="create-game__label" for="game-start">Start *</label>
              <input id="game-start" v-model="form.startTime" type="time" class="create-game__input" />
              <p v-if="shown('startTime')" class="create-game__error">{{ errors.startTime }}</p>
            </div>
            <div class="create-game__field" @focusout="touch('endTime')">
              <label class="create-game__label" for="game-end">End *</label>
              <input id="game-end" v-model="form.endTime" type="time" class="create-game__input" />
              <p v-if="shown('endTime')" class="create-game__error">{{ errors.endTime }}</p>
            </div>
          </div>
          <p class="create-game__hint">Local time at the venue.</p>
        </section>

        <section v-if="activeStep === 3" class="create-game__step" :aria-label="currentStep.title">
          <div class="create-game__field" @focusout="touch('locationName')">
            <label class="create-game__label" for="game-location">Location *</label>
            <input
              id="game-location"
              v-model="form.locationName"
              class="create-game__input"
              :maxlength="GAME_LOCATION_MAX"
              placeholder="BGC Court, Taguig"
              autocomplete="off"
            />
            <p v-if="shown('locationName')" class="create-game__error">{{ errors.locationName }}</p>
          </div>

          <div class="create-game__grid">
            <div class="create-game__field" @focusout="touch('latitude')">
              <label class="create-game__label" for="game-lat">Latitude</label>
              <input
                id="game-lat"
                v-model="form.latitude"
                class="create-game__input"
                inputmode="decimal"
                placeholder="14.5509"
              />
              <p v-if="shown('latitude')" class="create-game__error">{{ errors.latitude }}</p>
            </div>
            <div class="create-game__field" @focusout="touch('longitude')">
              <label class="create-game__label" for="game-lng">Longitude</label>
              <input
                id="game-lng"
                v-model="form.longitude"
                class="create-game__input"
                inputmode="decimal"
                placeholder="121.0503"
              />
              <p v-if="shown('longitude')" class="create-game__error">{{ errors.longitude }}</p>
            </div>
          </div>
          <button type="button" class="create-game__pick-location" @click="locationPickerOpen = true">
            {{ selectedGameLocation ? 'Change location on map' : 'Choose location on map' }}
          </button>
          <p class="create-game__hint">Select a point on the map to save the location and coordinates with this game.</p>
        </section>

        <section v-if="isReview" class="create-game__step create-game__review" aria-label="Game review">
          <article class="create-game__review-card">
            <div class="create-game__review-heading">
              <h3>Game details</h3>
              <button type="button" aria-label="Edit game details" @click="goToStep(0)">Edit</button>
            </div>
            <strong>{{ form.title.trim() }}</strong>
            <p>{{ selectedSportName }}</p>
            <p v-if="form.description.trim()" class="create-game__review-description">
              <strong>Caption:</strong> {{ form.description.trim() }}
            </p>
          </article>
          <article class="create-game__review-card">
            <div class="create-game__review-heading">
              <h3>Players &amp; approval</h3>
              <button type="button" aria-label="Edit players and approval" @click="goToStep(1)">Edit</button>
            </div>
            <p>{{ form.requiredPlayers }} players</p>
            <p>{{ form.autoAccept ? 'Auto Accept' : 'Manual Accept' }}</p>
            <p v-if="form.clubId">{{ selectedClubName }}</p>
          </article>
          <article class="create-game__review-card">
            <div class="create-game__review-heading">
              <h3>Schedule</h3>
              <button type="button" aria-label="Edit schedule" @click="goToStep(2)">Edit</button>
            </div>
            <p>{{ formatGameDay(form.gameDate) }}</p>
            <p>{{ formatGameTimeRange(form.startTime, form.endTime) }} &middot; Local time at the venue</p>
          </article>
          <article class="create-game__review-card">
            <div class="create-game__review-heading">
              <h3>Location</h3>
              <button type="button" aria-label="Edit location" @click="goToStep(3)">Edit</button>
            </div>
            <p>{{ form.locationName.trim() }}</p>
            <p v-if="String(form.latitude).trim() && String(form.longitude).trim()">
              {{ form.latitude }}, {{ form.longitude }}
            </p>
          </article>
        </section>
        <p v-if="stepMessage" class="create-game__alert" role="alert">{{ stepMessage }}</p>
        <p v-if="serverError" class="create-game__alert" role="alert">{{ serverError }}</p>
      </form>
    </ion-content>
    <ion-footer v-if="!created && !(editId && editBlocker)" class="ion-no-border">
      <div class="create-game__actions">
        <button
          v-if="activeStep > 0"
          type="button"
          class="create-game__back"
          :disabled="gamesStore.isSaving"
          @click="goToStep(activeStep - 1)"
        >
          Back
        </button>
        <button
          v-if="!isReview"
          type="submit"
          form="create-game-form"
          class="create-game__submit"
          :disabled="gamesStore.isSaving"
        >
          Next
        </button>
        <button
          v-else
          type="submit"
          form="create-game-form"
          class="create-game__submit"
          :disabled="gamesStore.isSaving"
        >
          {{ submitLabel }}
        </button>
      </div>
    </ion-footer>
    <LocationPickerModal
      :is-open="locationPickerOpen"
      :current="selectedGameLocation"
      @close="locationPickerOpen = false"
      @confirm="applyGameLocation"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonFooter, IonPage, onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';
import GamePreviewCard from '@/components/games/GamePreviewCard.vue';
import LocationPickerModal from '@/components/feed/LocationPickerModal.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useClubsStore } from '@/stores/clubs';
import { useGamesStore } from '@/stores/games';
import { useSportsStore } from '@/stores/sports';
import type { ApiGame } from '@/types/game';
import type { PostLocation } from '@/types/post';
import { isServerClubId } from '@/utils/club-chat';
import { isValidPoint } from '@/utils/location-map';
import {
  GAME_DESCRIPTION_MAX,
  GAME_LOCATION_MAX,
  GAME_PLAYERS_MAX,
  GAME_TITLE_MAX,
  type GameForm,
  type GameFormField,
  deviceMoment,
  diffGameInput,
  emptyGameForm,
  formatGameDay,
  formatGameTimeRange,
  gameToForm,
  toCreateGameInput,
  validateGameForm,
} from '@/utils/game-form';

// Ionic keeps pages alive, so the id is read once for this page instance. No id: Create Game.
const editId = String(useRoute().params.gameId ?? '');

const router = useRouter();
const gamesStore = useGamesStore();
const sportsStore = useSportsStore();
const clubsStore = useClubsStore();

const form = ref<GameForm>(emptyGameForm());
const touched = ref<Set<GameFormField>>(new Set());
const submitted = ref(false);
const serverError = ref<string | null>(null);
const sportsError = ref<string | null>(null);
const created = ref<ApiGame | null>(null);
const validationMoment = ref(deviceMoment());
const today = computed(() => validationMoment.value.date);
const activeStep = ref(0);
const stepMessage = ref<string | null>(null);
const formRef = ref<HTMLFormElement | null>(null);
const stepHeading = ref<HTMLElement | null>(null);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const locationPickerOpen = ref(false);

const GAME_STEPS: readonly { title: string; hint: string; fields: readonly GameFormField[] }[] = [
  {
    title: 'Game Details',
    hint: 'Choose your sport and give your game a name.',
    fields: ['sportId', 'title', 'description'],
  },
  {
    title: 'Players & Approval',
    hint: 'Set the player count and choose how players join.',
    fields: ['requiredPlayers', 'autoAccept', 'clubId'],
  },
  {
    title: 'Schedule',
    hint: 'Choose the game date and local start and end times.',
    fields: ['gameDate', 'startTime', 'endTime'],
  },
  {
    title: 'Location',
    hint: 'Tell players where the game will happen.',
    fields: ['locationName', 'latitude', 'longitude'],
  },
  { title: 'Review', hint: 'Check your game before confirming. You can edit any section.', fields: [] },
];
const currentStep = computed(() => GAME_STEPS[activeStep.value]);
const isReview = computed(() => activeStep.value === GAME_STEPS.length - 1);

const original = computed(() => (editId ? gamesStore.gameById(editId) : null));
const errors = computed(() => validateGameForm(form.value, validationMoment.value, original.value));
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const pageTitle = computed(() => {
  if (created.value) return 'Game Created';
  return editId ? 'Edit Game' : 'Create Game';
});
const submitLabel = computed(() => {
  if (gamesStore.isSaving) return editId ? 'Saving…' : 'Creating…';
  return editId ? 'Save Changes' : 'Create Game';
});

/** A retired sport stays selectable on the game that already uses it. */
const sportOptions = computed(() => {
  const active = sportsStore.activeSports.map((sport) => ({ id: sport.id, name: sport.name }));
  const current = original.value?.sport;
  return current && !active.some((sport) => sport.id === current.id) ? [...active, current] : active;
});

/** Server clubs where the signed-in account is an ACTIVE member (the server checks again). */
const clubOptions = computed(() => {
  const mine = clubsStore.clubs
    .filter((club) => isServerClubId(club.id) && club.viewerMembership?.status === 'ACTIVE')
    .map((club) => ({ id: club.id, name: club.name }));
  const current = original.value?.club;
  return current && !mine.some((club) => club.id === current.id) ? [...mine, current] : mine;
});
const selectedSportName = computed(
  () => sportOptions.value.find((sport) => sport.id === form.value.sportId)?.name ?? '',
);
const selectedClubName = computed(() => clubOptions.value.find((club) => club.id === form.value.clubId)?.name ?? '');
const selectedGameLocation = computed<PostLocation | null>(() => {
  const latitude = Number(String(form.value.latitude).trim());
  const longitude = Number(String(form.value.longitude).trim());
  const point = { latitude, longitude };
  const name = form.value.locationName.trim();
  return name && isValidPoint(point) ? { name, ...point } : null;
});

const editBlocker = computed(() => {
  const status = editId ? gamesStore.detailStatus[editId] : undefined;

  if (status === 'error') return gamesStore.detailError[editId] ?? 'This game is not available.';
  if (!original.value) return status === 'loading' || status === undefined ? 'Loading game…' : null;
  if (!original.value.isHost) return 'Only the host can edit this game.';
  if (!original.value.canEdit) return 'This game can no longer be edited.';
  return null;
});

function touch(field: GameFormField): void {
  touched.value = new Set(touched.value).add(field);
}

function applyGameLocation(location: PostLocation): void {
  form.value.locationName = location.name;
  form.value.latitude = location.latitude.toFixed(6);
  form.value.longitude = location.longitude.toFixed(6);
  locationPickerOpen.value = false;
  touch('locationName');
  touch('latitude');
  touch('longitude');
}

function shown(field: GameFormField): boolean {
  return Boolean(errors.value[field]) && (submitted.value || touched.value.has(field));
}

function resetForm(next: GameForm): void {
  form.value = next;
  touched.value = new Set();
  submitted.value = false;
  serverError.value = null;
  activeStep.value = 0;
  stepMessage.value = null;
}

async function goToStep(index: number): Promise<void> {
  if (gamesStore.isSaving || index < 0 || index >= GAME_STEPS.length) return;
  activeStep.value = index;
  stepMessage.value = null;
  await nextTick();
  void contentRef.value?.$el.scrollToTop?.(0);
  stepHeading.value?.focus({ preventScroll: true });
}

async function focusFirstError(): Promise<void> {
  await nextTick();
  formRef.value
    ?.querySelector('.create-game__error')
    ?.closest('.create-game__field')
    ?.querySelector<HTMLElement>('input, select, textarea')
    ?.focus();
}

async function advance(): Promise<void> {
  if (gamesStore.isSaving) return;
  validationMoment.value = deviceMoment();
  serverError.value = null;
  if (isReview.value) {
    await submit();
    return;
  }
  touched.value = new Set([...touched.value, ...currentStep.value.fields]);
  if (currentStep.value.fields.some((field) => errors.value[field])) {
    stepMessage.value = 'Complete the highlighted fields to continue.';
    await focusFirstError();
    return;
  }
  await goToStep(activeStep.value + 1);
}

async function submit(): Promise<void> {
  if (gamesStore.isSaving) return;
  validationMoment.value = deviceMoment();
  submitted.value = true;
  serverError.value = null;

  if (hasErrors.value) {
    const invalidStep = GAME_STEPS.findIndex((step) => step.fields.some((field) => errors.value[field]));
    if (invalidStep >= 0) {
      await goToStep(invalidStep);
      stepMessage.value = 'Check the highlighted fields before confirming your game.';
      await focusFirstError();
    }
    return;
  }

  const input = toCreateGameInput(form.value);

  if (editId && original.value) {
    const result = await gamesStore.updateGame(editId, diffGameInput(original.value, input));

    if (result.ok) {
      void router.replace(`/games/${editId}`);
    } else {
      serverError.value = result.message;
    }
    return;
  }

  const result = await gamesStore.createGame(input);

  if (result.ok) {
    created.value = result.game;
    resetForm(emptyGameForm());
  } else {
    serverError.value = result.message;
  }
}

function startOver(): void {
  created.value = null;
  resetForm(emptyGameForm());
}

async function loadSports(): Promise<void> {
  const result = await sportsStore.fetchSports();
  sportsError.value = result.ok ? null : `Couldn't load sports: ${result.message}`;
}

onIonViewWillEnter(async () => {
  validationMoment.value = deviceMoment();

  if (editId) {
    const result = await gamesStore.fetchGame(editId);
    if (result.ok && original.value) {
      resetForm(gameToForm(original.value));
    }
  }
});

onIonViewDidLeave(() => {
  created.value = null;
});

onMounted(() => {
  void loadSports();
  void clubsStore.load();
});
</script>

<style scoped>
.create-game {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 16px 40px;
}

.create-game__step-header {
  display: grid;
  gap: 10px;
  margin-bottom: 8px;
}
.create-game__step-count {
  margin: 0;
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 700;
}
.create-game__progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--gora-line);
}
.create-game__progress span {
  display: block;
  height: 100%;
  background: var(--ion-color-primary);
}
.create-game__step-title {
  margin: 6px 0 0;
  font-size: 1.3rem;
  font-weight: 800;
}
.create-game__step-title:focus {
  outline: none;
}
.create-game__step-hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}
.create-game__step {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.create-game__review-card {
  padding: 16px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  background: var(--gora-surface);
  overflow-wrap: anywhere;
}
.create-game__review-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.create-game__review-heading h3 {
  margin: 0;
  font-size: 0.85rem;
}
.create-game__review-heading button {
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: var(--gora-surface-raised);
  color: var(--ion-color-primary);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.create-game__review-card p {
  margin: 6px 0 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}
.create-game__review-description {
  white-space: pre-line;
}
.create-game__actions {
  display: flex;
  max-width: var(--gora-column, 680px);
  gap: 12px;
  margin: 0 auto;
  padding: 12px 16px max(12px, var(--gora-input-safe-bottom, env(safe-area-inset-bottom)));
  border-top: 1px solid var(--gora-line);
  background: var(--ion-background-color);
}
.create-game__back {
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
.create-game__back:disabled {
  opacity: 0.5;
  cursor: wait;
}

.create-game__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.create-game__label {
  display: flex;
  justify-content: space-between;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.create-game__counter {
  font-weight: 500;
  letter-spacing: 0;
}

.create-game__input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.92rem;
  color-scheme: dark;
}

.create-game__input--narrow {
  max-width: 160px;
}

textarea.create-game__input {
  resize: vertical;
}

.create-game__grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.create-game__hint {
  margin: -6px 0 0;
  color: #7d8a93;
  font-size: 0.72rem;
}

.create-game__pick-location {
  align-self: flex-start;
  min-height: 42px;
  padding: 9px 14px;
  border: 1px solid var(--ion-color-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: .84rem;
  font-weight: 700;
}

.create-game__field .create-game__hint {
  margin: 0;
}

.create-game__error {
  margin: 0;
  color: #ef5b5b;
  font-size: 0.74rem;
  font-weight: 600;
}

.create-game__alert {
  margin: 4px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
  font-size: 0.82rem;
  font-weight: 600;
}

.create-game__blocked {
  margin: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.create-game__submit {
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

.create-game__submit:disabled {
  background: #1b2a37;
  color: #7d8a93;
  cursor: default;
}

.game-created {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px 16px 40px;
}

.game-created__badge {
  margin: 0;
  color: var(--ion-color-primary);
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: center;
}

.game-created__note {
  margin: 0 0 4px;
  color: var(--gora-muted);
  font-size: 0.85rem;
  text-align: center;
}

.game-created__again {
  padding: 13px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
</style>
