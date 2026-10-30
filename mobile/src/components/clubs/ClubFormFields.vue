<template>
  <div class="club-form">
    <!-- Club identity -->
    <section v-if="section === 'all' || section === 'identity'" class="club-form__section">
      <h2 class="club-form__heading">Club identity</h2>

      <div class="club-form__field" @focusout="touch('name')">
        <label class="club-form__label" for="club-name">Club name *</label>
        <input
          id="club-name"
          v-model="form.name"
          class="club-form__input"
          :maxlength="CLUB_NAME_MAX"
          placeholder="Manila Volleyball Club"
          autocomplete="off"
        />
        <p v-if="shown('name')" class="club-form__error">{{ errors.name }}</p>
      </div>

      <div class="club-form__field" @focusout="touch('username')">
        <label class="club-form__label" for="club-username">Username *</label>
        <div class="club-form__prefixed">
          <span aria-hidden="true">@</span>
          <input
            id="club-username"
            :value="form.username"
            class="club-form__input"
            :maxlength="CLUB_USERNAME_MAX + 1"
            placeholder="manila-volleyball"
            autocomplete="off"
            @input="editUsername"
          />
        </div>
        <p v-if="shown('username')" class="club-form__error">{{ errors.username }}</p>
        <p v-else class="club-form__hint">Lowercase letters, numbers, and single hyphens. Must be unique.</p>
      </div>

      <div class="club-form__field" @focusout="touch('description')">
        <label class="club-form__label" for="club-description">
          Short description *
          <span class="club-form__counter">{{ form.description.trim().length }} / {{ CLUB_DESCRIPTION_MAX }}</span>
        </label>
        <input
          id="club-description"
          v-model="form.description"
          class="club-form__input"
          :maxlength="CLUB_DESCRIPTION_MAX"
          placeholder="Weekend volleyball for every level in Manila."
        />
        <p v-if="shown('description')" class="club-form__error">{{ errors.description }}</p>
      </div>
    </section>

    <section v-if="section === 'all' || section === 'photos'" class="club-form__section">
      <h2 class="club-form__heading">Photos &amp; about</h2>

      <div class="club-form__field" @focusout="touch('profileImageUrl')">
        <label class="club-form__label" for="club-photo">Profile photo URL</label>
        <input
          id="club-photo"
          v-model="form.profileImageUrl"
          class="club-form__input"
          inputmode="url"
          placeholder="https://…"
        />
        <p v-if="shown('profileImageUrl')" class="club-form__error">{{ errors.profileImageUrl }}</p>
      </div>

      <div class="club-form__field" @focusout="touch('coverImageUrl')">
        <label class="club-form__label" for="club-cover">Cover photo URL</label>
        <input
          id="club-cover"
          v-model="form.coverImageUrl"
          class="club-form__input"
          inputmode="url"
          placeholder="https://…"
        />
        <p v-if="shown('coverImageUrl')" class="club-form__error">{{ errors.coverImageUrl }}</p>
      </div>

      <div class="club-form__field" @focusout="touch('about')">
        <label class="club-form__label" for="club-about">About the club</label>
        <textarea
          id="club-about"
          v-model="form.about"
          class="club-form__input"
          rows="4"
          :maxlength="CLUB_ABOUT_MAX"
          placeholder="Who the club is for, how you play, what to bring…"
        />
        <p v-if="shown('about')" class="club-form__error">{{ errors.about }}</p>
      </div>
    </section>

    <!-- Sports -->
    <section v-if="section === 'all' || section === 'sports'" class="club-form__section">
      <h2 class="club-form__heading">Sports</h2>

      <div class="club-form__field" @focusout="touch('primarySportId')">
        <label class="club-form__label" for="club-sport">Primary sport *</label>
        <select id="club-sport" v-model="form.primarySportId" class="club-form__input">
          <option value="" disabled>{{ sportOptions.length ? 'Choose a sport' : 'Loading sports…' }}</option>
          <option v-for="option in sportOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
        </select>
        <p v-if="shown('primarySportId')" class="club-form__error">{{ errors.primarySportId }}</p>
      </div>

      <div class="club-form__field">
        <span class="club-form__label">Additional sports (optional)</span>
        <div class="club-form__chips" role="group" aria-label="Additional sports">
          <button
            v-for="option in additionalOptions"
            :key="option.id"
            type="button"
            class="club-form__chip"
            :class="{ 'club-form__chip--on': form.additionalSportIds.includes(option.id) }"
            :aria-pressed="form.additionalSportIds.includes(option.id)"
            @click="toggleAdditional(option.id)"
          >
            {{ option.name }}
          </button>
        </div>
        <p v-if="errors.additionalSportIds" class="club-form__error">{{ errors.additionalSportIds }}</p>
      </div>
    </section>

    <!-- Location -->
    <section v-if="section === 'all' || section === 'location'" class="club-form__section">
      <h2 class="club-form__heading">Location</h2>
      <div class="club-form__grid">
        <div class="club-form__field">
          <label class="club-form__label" for="club-country">Country</label>
          <input id="club-country" v-model="form.country" class="club-form__input" placeholder="Philippines" />
          <p v-if="errors.country" class="club-form__error">{{ errors.country }}</p>
        </div>
        <div class="club-form__field">
          <label class="club-form__label" for="club-city">City / Municipality</label>
          <input id="club-city" v-model="form.city" class="club-form__input" placeholder="Manila" />
          <p v-if="errors.city" class="club-form__error">{{ errors.city }}</p>
        </div>
        <div class="club-form__field">
          <label class="club-form__label" for="club-barangay">Barangay</label>
          <input id="club-barangay" v-model="form.barangay" class="club-form__input" placeholder="Malate" />
          <p v-if="errors.barangay" class="club-form__error">{{ errors.barangay }}</p>
        </div>
        <div class="club-form__field">
          <label class="club-form__label" for="club-court">Home court / venue</label>
          <input id="club-court" v-model="form.homeCourt" class="club-form__input" placeholder="Rizal Memorial Court" />
          <p v-if="errors.homeCourt" class="club-form__error">{{ errors.homeCourt }}</p>
        </div>
      </div>
      <div class="club-form__field">
        <label class="club-form__label" for="club-location-name">Location name</label>
        <input
          id="club-location-name"
          v-model="form.locationName"
          class="club-form__input"
          placeholder="Rizal Memorial Sports Complex, Malate"
        />
        <p v-if="errors.locationName" class="club-form__error">{{ errors.locationName }}</p>
      </div>
      <div class="club-form__grid" @focusout="touch('location')">
        <div class="club-form__field">
          <label class="club-form__label" for="club-lat">Latitude (optional)</label>
          <input
            id="club-lat"
            v-model="form.latitude"
            class="club-form__input"
            inputmode="decimal"
            placeholder="14.5636"
          />
        </div>
        <div class="club-form__field">
          <label class="club-form__label" for="club-lng">Longitude (optional)</label>
          <input
            id="club-lng"
            v-model="form.longitude"
            class="club-form__input"
            inputmode="decimal"
            placeholder="120.9917"
          />
        </div>
      </div>
      <p v-if="shown('location')" class="club-form__error">{{ errors.location }}</p>
      <p v-else class="club-form__hint">Only type coordinates you choose; GORA never reads your device location.</p>
    </section>

    <!-- Membership -->
    <section v-if="section === 'all' || section === 'membership'" class="club-form__section">
      <h2 class="club-form__heading">Membership</h2>
      <div class="club-form__field" @focusout="touch('maxMembers')">
        <label class="club-form__label" for="club-max">Maximum members *</label>
        <div class="club-form__chips" role="group" aria-label="Member presets">
          <button
            v-for="preset in presets"
            :key="preset"
            type="button"
            class="club-form__chip"
            :class="{ 'club-form__chip--on': form.maxMembers.trim() === String(preset) }"
            @click="form.maxMembers = String(preset)"
          >
            {{ preset }}
          </button>
        </div>
        <input
          id="club-max"
          v-model="form.maxMembers"
          class="club-form__input club-form__input--narrow"
          inputmode="numeric"
          placeholder="Custom number"
          aria-describedby="club-max-hint"
        />
        <p v-if="shown('maxMembers')" class="club-form__error" role="alert">{{ errors.maxMembers }}</p>
        <p v-else id="club-max-hint" class="club-form__hint">
          <template v-if="currentMembers > 0">
            {{ currentMembers }} active {{ currentMembers === 1 ? 'member' : 'members' }} now. You can raise the limit,
            but not below that.
          </template>
          <template v-else>You are the first member. Up to {{ limit }} members.</template>
        </p>
      </div>

      <div class="club-form__field">
        <span class="club-form__label">Who can join *</span>
        <div class="club-form__options" role="radiogroup" aria-label="Who can join">
          <label
            v-for="option in MEMBERSHIP_TYPE_OPTIONS"
            :key="option.id"
            class="club-form__option"
            :class="{ 'club-form__option--on': form.membershipType === option.id }"
          >
            <input v-model="form.membershipType" type="radio" name="club-membership-type" :value="option.id" />
            <span>
              <strong>{{ option.label }}</strong>
              <span>{{ option.hint }}</span>
            </span>
          </label>
        </div>
      </div>

      <div class="club-form__field">
        <span class="club-form__label">Privacy *</span>
        <SegmentTabs v-model="privacy" :options="PRIVACY_OPTIONS" aria-label="Club privacy" />
        <p class="club-form__hint">
          {{
            form.isPublic
              ? 'Anyone can see the club and its posts.'
              : 'Only members see posts, rules, schedule, and contact links.'
          }}
        </p>
      </div>
    </section>

    <!-- Rules -->
    <section v-if="section === 'all' || section === 'rules'" class="club-form__section">
      <h2 class="club-form__heading">Club rules</h2>
      <ol v-if="form.rules.length" class="club-form__rules">
        <li v-for="(_, index) in form.rules" :key="index" class="club-form__rule">
          <span class="club-form__rule-number">{{ index + 1 }}.</span>
          <input
            v-model="form.rules[index]"
            class="club-form__input"
            :maxlength="CLUB_RULE_MAX"
            :aria-label="`Rule ${index + 1}`"
            placeholder="Be on time"
          />
          <button
            type="button"
            class="club-form__remove"
            :aria-label="`Remove rule ${index + 1}`"
            @click="removeRule(index)"
          >
            <ion-icon :icon="closeOutline" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <button
        type="button"
        class="club-form__add"
        :disabled="form.rules.length >= CLUB_RULES_MAX"
        @click="form.rules.push('')"
      >
        + Add Rule
      </button>
      <p v-if="errors.rules && (showAll || form.rules.length > 0)" class="club-form__error">{{ errors.rules }}</p>
    </section>

    <!-- Tags -->
    <section v-if="section === 'all' || section === 'rules'" class="club-form__section">
      <h2 class="club-form__heading">Tags</h2>
      <div class="club-form__tag-entry">
        <input
          v-model="tagDraft"
          class="club-form__input"
          placeholder="#WeekendGames"
          aria-label="New tag"
          @keydown.enter.prevent="addTag"
        />
        <button type="button" class="club-form__add" :disabled="form.tags.length >= CLUB_TAGS_MAX" @click="addTag">
          + Add Tag
        </button>
      </div>
      <p v-if="tagMessage" class="club-form__error">{{ tagMessage }}</p>
      <div v-if="form.tags.length" class="club-form__chips">
        <span v-for="tag in form.tags" :key="tag" class="club-form__tag">
          #{{ tag }}
          <button type="button" :aria-label="`Remove tag ${tag}`" @click="removeTag(tag)">
            <ion-icon :icon="closeOutline" aria-hidden="true" />
          </button>
        </span>
      </div>
    </section>

    <!-- Activity -->
    <section v-if="section === 'all' || section === 'schedule'" class="club-form__section">
      <h2 class="club-form__heading">Activity schedule</h2>
      <div class="club-form__grid club-form__grid--three">
        <div class="club-form__field">
          <label class="club-form__label" for="club-day">Day</label>
          <select id="club-day" v-model="form.activityDay" class="club-form__input">
            <option value="">Not set</option>
            <option v-for="(label, day) in ACTIVITY_DAY_LABELS" :key="day" :value="day">{{ label }}</option>
          </select>
        </div>
        <div class="club-form__field" @focusout="touch('activityStartTime')">
          <label class="club-form__label" for="club-start">Start</label>
          <input id="club-start" v-model="form.activityStartTime" type="time" class="club-form__input" />
        </div>
        <div class="club-form__field" @focusout="touch('activityEndTime')">
          <label class="club-form__label" for="club-end">End</label>
          <input id="club-end" v-model="form.activityEndTime" type="time" class="club-form__input" />
        </div>
      </div>
      <p v-if="shown('activityStartTime')" class="club-form__error">{{ errors.activityStartTime }}</p>
      <p v-if="shown('activityEndTime')" class="club-form__error">{{ errors.activityEndTime }}</p>
      <div class="club-form__field">
        <label class="club-form__label" for="club-training">Training schedule</label>
        <textarea
          id="club-training"
          v-model="form.trainingSchedule"
          class="club-form__input"
          rows="2"
          :maxlength="CLUB_TRAINING_SCHEDULE_MAX"
          placeholder="Drills Tuesdays 7–9 PM, scrimmage Saturdays 8 AM"
        />
        <p v-if="errors.trainingSchedule" class="club-form__error">{{ errors.trainingSchedule }}</p>
      </div>
      <p class="club-form__hint">For information only. Games are still created separately.</p>
    </section>

    <!-- Contact -->
    <section v-if="section === 'all' || section === 'contact'" class="club-form__section">
      <h2 class="club-form__heading">Contact</h2>
      <div v-for="field in CONTACT_FIELDS" :key="field.key" class="club-form__field" @focusout="touch(field.key)">
        <label class="club-form__label" :for="`club-${field.key}`">{{ field.label }}</label>
        <input
          :id="`club-${field.key}`"
          v-model="form[field.key]"
          class="club-form__input"
          :inputmode="field.key === 'contactEmail' ? 'email' : 'url'"
          :placeholder="field.placeholder"
        />
        <p v-if="shown(field.key)" class="club-form__error">{{ errors[field.key] }}</p>
      </div>
      <p class="club-form__hint">The email is shown to active members only.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import type { ClubForm } from '@/types/club';
import type { SportOption } from '@/types/profile';
import {
  ACTIVITY_DAY_LABELS,
  CLUB_ABOUT_MAX,
  CLUB_ADDITIONAL_SPORTS_MAX,
  CLUB_DESCRIPTION_MAX,
  CLUB_MAX_MEMBERS_LIMIT,
  CLUB_MEMBER_PRESETS,
  CLUB_NAME_MAX,
  CLUB_RULE_MAX,
  CLUB_RULES_MAX,
  CLUB_TAGS_MAX,
  CLUB_TRAINING_SCHEDULE_MAX,
  CLUB_USERNAME_MAX,
  type ClubFormErrors,
  type ClubFormSection,
  type ClubFormField,
  MEMBERSHIP_TYPE_OPTIONS,
  normalizeClubTag,
  suggestClubUsername,
} from '@/utils/club-form';

type Privacy = 'PUBLIC' | 'PRIVATE';
type ContactKey = 'contactEmail' | 'websiteUrl' | 'facebookUrl' | 'instagramUrl' | 'tiktokUrl';

const PRIVACY_OPTIONS: { id: Privacy; label: string }[] = [
  { id: 'PUBLIC', label: 'Public' },
  { id: 'PRIVATE', label: 'Private' },
];

const CONTACT_FIELDS: { key: ContactKey; label: string; placeholder: string }[] = [
  { key: 'contactEmail', label: 'Email', placeholder: 'club@example.com' },
  { key: 'websiteUrl', label: 'Website', placeholder: 'https://…' },
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/yourclub' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/yourclub' },
  { key: 'tiktokUrl', label: 'TikTok', placeholder: 'https://tiktok.com/@yourclub' },
];

const form = defineModel<ClubForm>({ required: true });
const props = withDefaults(
  defineProps<{
    errors: ClubFormErrors;
    /** Omit for the full Manage Club form. Create shows one section per step. */
    section?: ClubFormSection | 'all';
    sportOptions: readonly SportOption[];
    /** Show every error, e.g. after pressing submit. Otherwise only fields the person has left. */
    showAll?: boolean;
    /** Suggest the username from the name until the person edits it (Create only). */
    suggestUsername?: boolean;
    /** Active members right now (Manage), so the limit cannot go below them. */
    currentMembers?: number;
    limit?: number;
  }>(),
  { section: 'all', showAll: false, suggestUsername: false, currentMembers: 0, limit: CLUB_MAX_MEMBERS_LIMIT },
);

const touched = ref(new Set<ClubFormField>());
const usernameEdited = ref(!props.suggestUsername);
const tagDraft = ref('');
const tagMessage = ref<string | null>(null);

const presets = computed(() => CLUB_MEMBER_PRESETS.filter((preset) => preset <= props.limit));
const additionalOptions = computed(() =>
  props.sportOptions.filter((option) => option.id !== form.value.primarySportId),
);
const privacy = computed<Privacy>({
  get: () => (form.value.isPublic ? 'PUBLIC' : 'PRIVATE'),
  set: (value) => {
    form.value.isPublic = value === 'PUBLIC';
  },
});

watch(
  () => form.value.name,
  (name) => {
    if (!usernameEdited.value) {
      form.value.username = suggestClubUsername(name);
    }
  },
);

watch(
  () => form.value.primarySportId,
  (primary) => {
    form.value.additionalSportIds = form.value.additionalSportIds.filter((id) => id !== primary);
  },
);

function touch(field: ClubFormField): void {
  touched.value = new Set(touched.value).add(field);
}

function shown(field: ClubFormField): boolean {
  return !!props.errors[field] && (props.showAll || touched.value.has(field));
}

function editUsername(event: Event): void {
  usernameEdited.value = true;
  form.value.username = (event.target as HTMLInputElement).value.replace(/^@+/, '').toLowerCase();
}

function toggleAdditional(sportId: string): void {
  const selected = form.value.additionalSportIds;

  if (selected.includes(sportId)) {
    form.value.additionalSportIds = selected.filter((id) => id !== sportId);
  } else if (selected.length < CLUB_ADDITIONAL_SPORTS_MAX) {
    form.value.additionalSportIds = [...selected, sportId];
  }
}

function removeRule(index: number): void {
  form.value.rules = form.value.rules.filter((_, position) => position !== index);
}

function addTag(): void {
  const tag = normalizeClubTag(tagDraft.value);

  if (tag.length < 2 || tag.length > 30) {
    tagMessage.value = 'Tags must be 2 to 30 letters or numbers.';
    return;
  }

  if (form.value.tags.includes(tag)) {
    tagMessage.value = `#${tag} is already added.`;
    return;
  }

  if (form.value.tags.length >= CLUB_TAGS_MAX) {
    tagMessage.value = `A club can have at most ${CLUB_TAGS_MAX} tags.`;
    return;
  }

  form.value.tags = [...form.value.tags, tag];
  tagDraft.value = '';
  tagMessage.value = null;
}

function removeTag(tag: string): void {
  form.value.tags = form.value.tags.filter((candidate) => candidate !== tag);
}
</script>

<style scoped>
.club-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.club-form__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 0;
  border-top: 1px solid var(--gora-line);
}

.club-form__section:first-child {
  border-top: 0;
  padding-top: 4px;
}

.club-form__heading {
  margin: 0;
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.club-form__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.club-form__label {
  display: flex;
  justify-content: space-between;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.club-form__counter {
  font-weight: 500;
  letter-spacing: 0;
}

.club-form__input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.92rem;
}

.club-form__input--narrow {
  max-width: 220px;
}

textarea.club-form__input {
  resize: vertical;
}

.club-form__prefixed {
  display: flex;
  align-items: center;
  gap: 6px;
}

.club-form__prefixed > span {
  color: var(--gora-muted);
  font-weight: 700;
}

.club-form__grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.club-form__grid--three {
  grid-template-columns: 1.4fr 1fr 1fr;
}

.club-form__hint {
  margin: 0;
  color: #7d8a93;
  font-size: 0.72rem;
}

.club-form__error {
  margin: 0;
  color: #ef5b5b;
  font-size: 0.74rem;
  font-weight: 600;
}

.club-form__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.club-form__chip {
  padding: 6px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.club-form__chip--on {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-weight: 700;
}

.club-form__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.club-form__option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  cursor: pointer;
}

.club-form__option--on {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.club-form__option input {
  margin-top: 3px;
  accent-color: var(--ion-color-primary);
}

.club-form__option > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.88rem;
}

.club-form__option > span span {
  color: var(--gora-muted);
  font-size: 0.76rem;
}

.club-form__rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.club-form__rule {
  display: flex;
  align-items: center;
  gap: 8px;
}

.club-form__rule-number {
  min-width: 20px;
  color: var(--gora-muted);
  font-weight: 700;
}

.club-form__remove,
.club-form__tag button {
  display: inline-flex;
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
}

.club-form__add {
  align-self: flex-start;
  flex-shrink: 0;
  padding: 9px 14px;
  border: 1px dashed rgba(var(--ion-color-primary-rgb), 0.5);
  border-radius: 999px;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
}

.club-form__add:disabled {
  opacity: 0.45;
  cursor: default;
}

.club-form__tag-entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

.club-form__tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 4px 4px 10px;
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-color-primary);
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
