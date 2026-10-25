<template>
  <ion-page>
    <SubPageHeader :title="pageTitle" :back-href="editId ? `/games/${editId}` : '/create'" />

    <ion-content>
      <section v-if="created" class="game-created" aria-live="polite">
        <p class="game-created__badge">GAME CREATED!</p>
        <p class="game-created__note">Players can find it now. Join requests open in a later update.</p>
        <GamePreviewCard :game="created" />
        <button type="button" class="game-created__again" @click="startOver">Create another game</button>
      </section>

      <p v-else-if="editId && editBlocker" class="create-game__blocked" role="alert">{{ editBlocker }}</p>

      <form v-else class="create-game" novalidate @submit.prevent="submit">
        <p v-if="sportsError" class="create-game__alert" role="alert">{{ sportsError }}</p>

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
            Description
            <span class="create-game__counter">{{ form.description.trim().length }} / {{ GAME_DESCRIPTION_MAX }}</span>
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
          <p v-else class="create-game__hint">Everyone who plays, including you if you play. You are not added automatically.</p>
        </div>

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
        <p class="create-game__hint">Optional coordinates for the map, which arrives in a later phase.</p>

        <div class="create-game__field">
          <label class="create-game__label" for="game-club">Club</label>
          <select id="game-club" v-model="form.clubId" class="create-game__input">
            <option value="">No club</option>
            <option v-for="club in clubOptions" :key="club.id" :value="club.id">{{ club.name }}</option>
          </select>
          <p class="create-game__hint">Clubs you are an active member of. You stay the host.</p>
        </div>

        <p v-if="serverError" class="create-game__alert" role="alert">{{ serverError }}</p>
        <p v-else-if="submitted && hasErrors" class="create-game__alert" role="alert">
          Fix the highlighted fields to {{ editId ? 'save your changes' : 'create your game' }}.
        </p>

        <button type="submit" class="create-game__submit" :disabled="gamesStore.isSaving">
          {{ submitLabel }}
        </button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonPage, onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';
import GamePreviewCard from '@/components/games/GamePreviewCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useClubsStore } from '@/stores/clubs';
import { useGamesStore } from '@/stores/games';
import { useSportsStore } from '@/stores/sports';
import type { ApiGame } from '@/types/game';
import { isServerClubId } from '@/utils/club-chat';
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
const today = ref(deviceMoment().date);

const original = computed(() => (editId ? gamesStore.gameById(editId) : null));
const errors = computed(() => validateGameForm(form.value, deviceMoment(), original.value));
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

function shown(field: GameFormField): boolean {
  return Boolean(errors.value[field]) && (submitted.value || touched.value.has(field));
}

function resetForm(next: GameForm): void {
  form.value = next;
  touched.value = new Set();
  submitted.value = false;
  serverError.value = null;
}

async function submit(): Promise<void> {
  submitted.value = true;
  serverError.value = null;

  if (hasErrors.value || gamesStore.isSaving) {
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
  today.value = deviceMoment().date;

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
  margin-top: 8px;
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
