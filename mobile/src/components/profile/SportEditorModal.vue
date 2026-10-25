<template>
  <ion-modal :is-open="isOpen" class="sport-editor" @did-dismiss="emit('close')" @will-present="reset">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button :disabled="isSaving" @click="emit('close')">Cancel</ion-button>
        </ion-buttons>
        <ion-title>{{ entry ? `Edit ${entry.name}` : 'Add Sport' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form class="sport-editor__form" @submit.prevent="submit">
        <section v-if="!entry" class="sport-editor__group">
          <h2 id="sport-editor-sport" class="sport-editor__label">Sport</h2>
          <div
            v-if="optionsLoading && options.length === 0"
            class="sport-editor__grid"
            aria-busy="true"
            aria-label="Loading sports"
          >
            <ion-skeleton-text v-for="n in 6" :key="n" :animated="true" class="sport-editor__tile-skeleton" />
          </div>
          <div v-else-if="optionsError && options.length === 0" class="sport-editor__hint" role="alert">
            <p>{{ optionsError }}</p>
            <ion-button fill="outline" size="small" @click="emit('retry')">Try again</ion-button>
          </div>
          <p v-else-if="options.length === 0" class="sport-editor__hint">
            {{ noSportsAvailable ? 'No sports are currently available.' : 'Every sport is already on your profile.' }}
          </p>
          <div v-else class="sport-editor__grid" role="radiogroup" aria-labelledby="sport-editor-sport">
            <button
              v-for="option in options"
              :key="option.id"
              type="button"
              role="radio"
              class="sport-editor__tile"
              :class="{ 'sport-editor__tile--active': sportId === option.id }"
              :aria-checked="sportId === option.id"
              @click="sportId = option.id"
            >
              <SportIcon :name="option.name" :icon-url="option.iconUrl" :size="36" />
              <span class="sport-editor__tile-name">{{ option.name }}</span>
              <ion-icon
                v-if="sportId === option.id"
                :icon="checkmarkCircle"
                class="sport-editor__tile-check"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <div v-else class="sport-editor__fixed">
          <SportIcon :name="entry.name" :icon-url="entry.iconUrl" :size="36" />
          <span>
            <strong>{{ entry.name }}</strong>
            <small>To change the sport, remove it and add another.</small>
          </span>
        </div>

        <section class="sport-editor__group">
          <h2 id="sport-editor-level" class="sport-editor__label">Skill level</h2>
          <div class="sport-editor__levels" role="radiogroup" aria-labelledby="sport-editor-level">
            <button
              v-for="level in SKILL_LEVELS"
              :key="level.value"
              type="button"
              role="radio"
              class="sport-editor__level"
              :class="{ 'sport-editor__level--active': skillLevel === level.value }"
              :aria-checked="skillLevel === level.value"
              @click="skillLevel = level.value"
            >
              {{ level.label }}
            </button>
          </div>
        </section>

        <section class="sport-editor__group">
          <ion-input
            v-model="position"
            label="Position (optional)"
            label-placement="stacked"
            fill="outline"
            :maxlength="POSITION_MAX_LENGTH"
            :counter="true"
            :placeholder="suggestions.length > 0 ? `e.g. ${suggestions[0]}` : 'Leave blank if it does not apply'"
            :error-text="positionProblem ?? undefined"
            :class="{ 'ion-invalid ion-touched': positionProblem }"
          />
          <div v-if="suggestions.length > 0" class="sport-editor__suggestions" aria-label="Suggested positions">
            <ion-chip
              v-for="suggestion in suggestions"
              :key="suggestion"
              :outline="position.trim() !== suggestion"
              @click="position = suggestion"
            >
              {{ suggestion }}
            </ion-chip>
          </div>
        </section>

        <p v-if="saveError" class="sport-editor__error" role="alert">{{ saveError }}</p>

        <ion-button type="submit" expand="block" :disabled="!canSave">
          <ion-spinner v-if="isSaving" slot="start" name="crescent" />
          {{ isSaving ? 'Saving...' : entry ? 'Save Changes' : 'Save Sport' }}
        </ion-button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { checkmarkCircle } from 'ionicons/icons';
import SportIcon from '@/components/sports/SportIcon.vue';
import type { ActionResult } from '@/stores/profile';
import type { AddSportInput, SkillLevel, SportOption, UserSportEntry } from '@/types/profile';
import {
  POSITION_MAX_LENGTH,
  SKILL_LEVELS,
  normalizePosition,
  positionError,
  positionSuggestionsFor,
} from '@/utils/sports-profile';

const props = defineProps<{
  isOpen: boolean;
  /** Set when editing; the sport itself cannot change, only level and position. */
  entry: UserSportEntry | null;
  /** Active sports that can still be added. */
  options: readonly SportOption[];
  optionsLoading?: boolean;
  optionsError?: string | null;
  /** True when the server has no active sports at all (not just none left to add). */
  noSportsAvailable?: boolean;
  save: (draft: AddSportInput) => Promise<ActionResult>;
}>();
const emit = defineEmits<{ close: []; retry: [] }>();

const sportId = ref<string | null>(null);
const skillLevel = ref<SkillLevel | null>(null);
const position = ref('');
const isSaving = ref(false);
const saveError = ref<string | null>(null);

const sportName = computed(
  () => props.entry?.name ?? props.options.find((option) => option.id === sportId.value)?.name ?? '',
);
const suggestions = computed(() => positionSuggestionsFor(sportName.value));
const positionProblem = computed(() => positionError(position.value));
const canSave = computed(
  () =>
    !isSaving.value &&
    positionProblem.value === null &&
    skillLevel.value !== null &&
    (props.entry !== null || sportId.value !== null),
);

function reset(): void {
  sportId.value = props.entry?.sportId ?? null;
  skillLevel.value = props.entry?.skillLevel ?? null;
  position.value = props.entry?.position ?? '';
  saveError.value = null;
  isSaving.value = false;
}

async function submit(): Promise<void> {
  const id = props.entry?.sportId ?? sportId.value;

  if (!canSave.value || !id || !skillLevel.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = null;

  const result = await props.save({ sportId: id, skillLevel: skillLevel.value, position: normalizePosition(position.value) });
  isSaving.value = false;

  if (result.ok) {
    emit('close');
  } else {
    saveError.value = result.message;
  }
}
</script>

<style scoped>
.sport-editor__form {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 520px;
  margin: 0 auto;
}

.sport-editor__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sport-editor__label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--gora-muted);
}

.sport-editor__hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.88rem;
}

.sport-editor__hint p {
  margin: 0 0 8px;
}

.sport-editor__grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sport-editor__tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.sport-editor__tile--active {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 1px var(--ion-color-primary) inset;
}

.sport-editor__tile-name {
  overflow: hidden;
  flex: 1;
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sport-editor__tile-check {
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-size: 18px;
}

.sport-editor__tile-skeleton {
  height: 58px;
  margin: 0;
  border-radius: 14px;
}

.sport-editor__fixed {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--gora-surface);
}

.sport-editor__fixed span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sport-editor__fixed small {
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.sport-editor__levels {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sport-editor__level {
  padding: 12px 8px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
}

.sport-editor__level--active {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.sport-editor__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sport-editor__error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 123, 127, 0.12);
  color: #ff9ea1;
  font-size: 0.88rem;
}
</style>
