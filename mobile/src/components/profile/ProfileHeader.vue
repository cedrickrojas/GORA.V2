<template>
  <section class="profile-header">
    <div
      class="profile-header__cover"
      :class="{ 'profile-header__cover--default': !profile.coverImageUrl }"
      :style="profile.coverImageUrl ? { backgroundImage: `url(${JSON.stringify(profile.coverImageUrl)})` } : undefined"
    >
      <div class="profile-header__cover-actions">
        <slot name="cover-actions" />
      </div>
      <button v-if="editable" type="button" class="profile-header__cover-edit" @click="coverOpen = true">
        <ion-icon :icon="cameraOutline" aria-hidden="true" />
        <span>{{ profile.coverImageUrl ? 'Edit cover' : 'Add cover photo' }}</span>
      </button>
    </div>

    <div class="profile-header__identity">
      <div class="profile-header__ring" :class="{ 'profile-header__ring--story': hasActiveStory }">
        <span class="profile-header__inner">
          <UserAvatar :user="summary" :size="112" />
        </span>
      </div>
      <h1 class="profile-header__name">{{ profile.displayName }}</h1>
      <p class="profile-header__username">@{{ profile.username }}</p>
      <div class="profile-header__points" :aria-label="`${profile.goraPoints} GORA points`">
        <span class="profile-header__torch-wrap">
          <svg class="profile-header__torch" viewBox="0 0 36 44" aria-hidden="true">
            <path d="M18 1C11 9 6 14 7 22c.5 4 3 7 6 8-1-5 1-8 5-11 0 5 4 7 4 12 4-2 7-6 7-11C29 13 22 7 18 1Z" fill="#ff6a00" />
            <path d="M18 13c-3 4-5 7-4 11 .4 2 1.5 3.5 3.5 4.3-.3-2.4.8-4.1 2.5-5.5.4 2.5 2 3.8 2.7 5.5 1.4-1.5 2-3.4 1.5-5.4-.7-4.2-4.1-7.3-10.2-10.9Z" fill="#ffb02e" />
            <path d="M12 32h12l-1.4 4H13.4L12 32Zm2 5h8l1 5H13l1-5Z" fill="#bd5a12" />
            <path d="M13 33h10" stroke="#ffd184" stroke-width="1" />
          </svg>
          <strong>{{ profile.goraPoints }}</strong>
        </span>
        <span>GORA Points</span>
      </div>
      <p v-if="profile.city" class="profile-header__city">
        <ion-icon :icon="locationOutline" aria-hidden="true" />
        <span>{{ profile.city }}</span>
      </p>
      <p v-if="profile.bio" class="profile-header__bio">{{ profile.bio }}</p>
      <router-link v-else-if="editable" to="/profile/edit" class="profile-header__add-bio">
        <ion-icon :icon="addOutline" aria-hidden="true" />
        Add a bio
      </router-link>
    </div>

    <div class="profile-header__actions">
      <slot name="actions" />
    </div>
    <CoverPhotoModal
      v-if="editable"
      :is-open="coverOpen"
      :current-url="profile.coverImageUrl"
      @close="coverOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { addOutline, cameraOutline, locationOutline } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import type { ProfileIdentity } from '@/types/profile';
import { toUserSummary } from '@/utils/display-name';
import CoverPhotoModal from './CoverPhotoModal.vue';

const props = withDefaults(
  defineProps<{
    profile: ProfileIdentity;
    /** The owner's header can change its cover and edit its bio. */
    editable?: boolean;
    hasActiveStory?: boolean;
  }>(),
  { editable: false, hasActiveStory: false },
);

const summary = computed(() => toUserSummary(props.profile));
const coverOpen = ref(false);
</script>

<style scoped>
.profile-header__cover {
  position: relative;
  height: 190px;
  background-position: center;
  background-size: cover;
}

.profile-header__points {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  padding: 6px 12px 6px 7px;
  border: 1px solid rgba(255, 138, 40, .45);
  border-radius: 999px;
  color: #a84700;
  background: linear-gradient(120deg, #fff4e8, #fffaf4);
  box-shadow: 0 3px 12px rgba(214, 92, 0, .12);
}

.profile-header__torch-wrap { position: relative; display: grid; place-items: center; width: 32px; height: 38px; flex: none; }
.profile-header__torch { position: absolute; inset: 0; width: 32px; height: 39px; }
.profile-header__torch-wrap strong { position: relative; z-index: 1; margin-top: -3px; color: #fff; font-size: .58rem; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px #853700; }
.profile-header__points span { color: #79502d; font-size: .76rem; font-weight: 650; }

.profile-header__cover--default {
  border-bottom: 2px solid var(--ion-color-primary);
  background: var(--gora-surface-raised);
}

.profile-header__cover-actions {
  position: absolute;
  z-index: 3;
  top: 12px;
  right: 12px;
}

@media (min-width: 768px) {
  .profile-header__cover {
    height: 250px;
    border-radius: 0 0 var(--gora-radius-card) var(--gora-radius-card);
  }
}

.profile-header__cover-edit {
  /* Keep this control above the identity section that overlaps the cover. */
  z-index: 2;
  border: 0;
  font-family: inherit;
  cursor: pointer;
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(8, 19, 31, 0.75);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}

.profile-header__cover-edit ion-icon {
  font-size: 18px;
}

.profile-header__identity {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: -64px;
  padding: 0 16px;
}

.profile-header__ring {
  display: flex;
  padding: 3px;
  border-radius: 50%;
  background: var(--gora-line);
}

.profile-header__ring--story {
  background: var(--ion-color-primary);
}

.profile-header__inner {
  display: flex;
  padding: 4px;
  border-radius: 50%;
  background: var(--ion-background-color);
}

.profile-header__name {
  margin: 10px 0 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.profile-header__username {
  margin: 2px 0 0;
  color: var(--gora-muted);
  font-size: 0.9rem;
}

.profile-header__city {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 8px 0 0;
  color: var(--gora-muted);
  font-size: 0.88rem;
}

.profile-header__city ion-icon {
  font-size: 16px;
}

.profile-header__bio {
  margin: 10px 0 0;
  font-size: 0.95rem;
  line-height: 1.45;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.profile-header__add-bio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  color: var(--ion-color-primary);
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
}

.profile-header__actions {
  display: flex;
  gap: 8px;
  padding: 14px 16px 0;
}

.profile-header__actions:empty {
  display: none;
}
</style>
