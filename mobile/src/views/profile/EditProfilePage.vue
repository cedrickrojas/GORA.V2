<template>
  <ion-page>
    <SubPageHeader title="Edit Profile" back-href="/profile" />

    <ion-content :fullscreen="true" class="ion-padding">
      <div v-if="!original" class="edit-profile__state">
        <ion-spinner v-if="profileStore.loading" name="crescent" aria-label="Loading profile" />
        <template v-else>
          <p role="alert">{{ profileStore.error ?? "We couldn't load your profile." }}</p>
          <ion-button fill="outline" @click="load">Try again</ion-button>
        </template>
      </div>

      <form v-else class="edit-profile" novalidate @submit.prevent="save">
        <section class="edit-profile__photo" aria-labelledby="edit-photo-title">
          <UserAvatar :user="preview" :size="96" />
          <div class="edit-profile__photo-body">
            <h2 id="edit-photo-title">Profile photo</h2>
            <div class="edit-profile__photo-actions">
              <ion-button size="small" fill="outline" :disabled="profileStore.saving" @click="pickPhoto">
                <ion-icon slot="start" :icon="cameraOutline" aria-hidden="true" />
                Upload photo
              </ion-button>
              <ion-button
                v-if="form.profileImageUrl"
                size="small"
                fill="clear"
                color="medium"
                :disabled="profileStore.saving"
                @click="form.profileImageUrl = ''"
              >
                Remove
              </ion-button>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="edit-profile__file" @change="onFilePicked" />
          </div>
        </section>

        <ion-input
          v-model="form.profileImageUrl"
          label="Photo link"
          label-placement="stacked"
          fill="outline"
          type="url"
          inputmode="url"
          placeholder="https://..."
          helper-text="Paste a link to an image. Uploading from your device is coming soon."
          :error-text="visibleErrors.profileImageUrl"
          :class="fieldClass('profileImageUrl')"
        />

        <div class="edit-profile__row">
          <ion-input
            v-model="form.firstName"
            label="First name"
            label-placement="stacked"
            fill="outline"
            autocomplete="given-name"
            :maxlength="PROFILE_NAME_MAX_LENGTH"
            :error-text="visibleErrors.firstName"
            :class="fieldClass('firstName')"
          />
          <ion-input
            v-model="form.lastName"
            label="Last name"
            label-placement="stacked"
            fill="outline"
            autocomplete="family-name"
            :maxlength="PROFILE_NAME_MAX_LENGTH"
            :error-text="visibleErrors.lastName"
            :class="fieldClass('lastName')"
          />
        </div>

        <ion-textarea
          v-model="form.bio"
          label="Bio"
          label-placement="stacked"
          fill="outline"
          :auto-grow="true"
          :rows="3"
          :counter="true"
          :maxlength="PROFILE_BIO_MAX_LENGTH"
          placeholder="Your sports, your position, where you play."
          :error-text="visibleErrors.bio"
          :class="fieldClass('bio')"
        />

        <ion-input
          v-model="form.city"
          label="City"
          label-placement="stacked"
          fill="outline"
          autocomplete="address-level2"
          :maxlength="PROFILE_CITY_MAX_LENGTH"
          :error-text="visibleErrors.city"
          :class="fieldClass('city')"
        />

        <ion-input
          v-model="form.dateOfBirth"
          label="Date of birth"
          label-placement="stacked"
          fill="outline"
          type="date"
          :max="today"
          helper-text="Only you can see this."
          :error-text="visibleErrors.dateOfBirth"
          :class="fieldClass('dateOfBirth')"
        />

        <ion-input
          v-model="form.coverImageUrl"
          label="Cover photo link"
          label-placement="stacked"
          fill="outline"
          type="url"
          inputmode="url"
          placeholder="https://..."
          :error-text="visibleErrors.coverImageUrl"
          :class="fieldClass('coverImageUrl')"
        />

        <p v-if="saveError" class="edit-profile__error" role="alert">{{ saveError }}</p>

        <div class="edit-profile__actions">
          <ion-button fill="outline" color="medium" :disabled="profileStore.saving" @click="cancel">Cancel</ion-button>
          <ion-button type="submit" :disabled="profileStore.saving">
            <ion-spinner v-if="profileStore.saving" slot="start" name="crescent" />
            {{ profileStore.saving ? 'Saving...' : 'Save Changes' }}
          </ion-button>
        </div>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonPage,
  IonSpinner,
  IonTextarea,
  onIonViewWillEnter,
} from '@ionic/vue';
import { cameraOutline } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { uploadImage } from '@/services/upload.service';
import { useProfileStore } from '@/stores/profile';
import type { OwnProfile } from '@/types/profile';
import { toUserSummary } from '@/utils/display-name';
import { showNotice } from '@/utils/notice';
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_CITY_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  type ProfileForm,
  type ProfileFormErrors,
  isImageUrl,
  profileFormFrom,
  profileUpdateFrom,
  validateProfileForm,
} from '@/utils/profile';

const router = useRouter();
const profileStore = useProfileStore();

const original = ref<OwnProfile | null>(null);
const form = reactive<ProfileForm>({
  firstName: '',
  lastName: '',
  bio: '',
  city: '',
  dateOfBirth: '',
  profileImageUrl: '',
  coverImageUrl: '',
});
const submitted = ref(false);
const saveError = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const today = new Date().toISOString().slice(0, 10);

const errors = computed<ProfileFormErrors>(() => validateProfileForm(form));
/** Errors show after the first Save attempt, so the form does not start out red. */
const visibleErrors = computed<ProfileFormErrors>(() => (submitted.value ? errors.value : {}));

/** Live preview: the photo updates as soon as the link is a valid image URL. */
const preview = computed(() =>
  toUserSummary({
    id: original.value?.id ?? '',
    username: original.value?.username ?? '',
    firstName: form.firstName,
    lastName: form.lastName,
    profileImageUrl: isImageUrl(form.profileImageUrl) ? form.profileImageUrl.trim() : null,
  }),
);

function fieldClass(field: keyof ProfileForm): Record<string, boolean> {
  return { 'ion-invalid': Boolean(visibleErrors.value[field]), 'ion-touched': Boolean(visibleErrors.value[field]) };
}

function fillForm(profile: OwnProfile): void {
  original.value = profile;
  Object.assign(form, profileFormFrom(profile));
}

async function load(): Promise<void> {
  const profile = profileStore.currentProfile ?? (await profileStore.fetchMyProfile());

  if (profile) {
    fillForm(profile);
  }
}

function pickPhoto(): void {
  fileInput.value?.click();
}

async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  try {
    form.profileImageUrl = await uploadImage(file);
  } catch (caught) {
    void showNotice(caught instanceof Error ? caught.message : 'That photo could not be uploaded.');
  }
}

async function save(): Promise<void> {
  submitted.value = true;
  saveError.value = null;

  if (!original.value || Object.keys(errors.value).length > 0) {
    return;
  }

  const update = profileUpdateFrom(form, original.value);

  if (Object.keys(update).length === 0) {
    await router.replace('/profile');
    return;
  }

  const result = await profileStore.updateProfile(update);

  if (!result.ok) {
    saveError.value = result.message;
    return;
  }

  void showNotice('Profile updated.');
  await router.replace('/profile');
}

async function cancel(): Promise<void> {
  if (original.value) {
    fillForm(original.value);
  }

  submitted.value = false;
  saveError.value = null;
  await router.replace('/profile');
}

// Ionic can keep this page cached, so the form is refilled from the latest profile on every visit.
onIonViewWillEnter(() => {
  submitted.value = false;
  saveError.value = null;
  void load();
});
</script>

<style scoped>
.edit-profile {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 560px;
  margin: 0 auto;
  padding-bottom: 32px;
}

.edit-profile__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--gora-muted);
  text-align: center;
}

.edit-profile__photo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.edit-profile__photo-body h2 {
  margin: 0 0 6px;
  font-size: 1rem;
}

.edit-profile__photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.edit-profile__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.edit-profile__row {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 420px) {
  .edit-profile__row {
    grid-template-columns: 1fr;
  }
}

.edit-profile__error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 123, 127, 0.12);
  color: #ff9ea1;
  font-size: 0.88rem;
}

.edit-profile__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
