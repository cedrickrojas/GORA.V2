<template>
  <ion-modal
    :is-open="post !== null"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    class="edit-post-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="edit-post-content">
      <form class="edit-post" @submit.prevent="save">
        <h2 class="edit-post__title">Edit post</h2>

        <label class="edit-post__label" for="edit-post-caption">Caption</label>
        <textarea
          id="edit-post-caption"
          v-model="caption"
          class="edit-post__field"
          rows="5"
          :maxlength="POST_CAPTION_MAX_LENGTH"
        />
        <span class="edit-post__counter">{{ caption.length }}/{{ POST_CAPTION_MAX_LENGTH }}</span>

        <label class="edit-post__label" for="edit-post-sport">Sport</label>
        <select id="edit-post-sport" v-model="sport" class="edit-post__field">
          <option v-for="option in sportOptions" :key="option" :value="option">{{ option }}</option>
        </select>

        <span class="edit-post__label">Location</span>
        <div class="edit-post__location">
          <span v-if="location" class="edit-post__chip">
            📍 {{ location.name }}
            <button type="button" aria-label="Remove location" @click="location = null">
              <ion-icon :icon="close" aria-hidden="true" />
            </button>
          </span>
          <button type="button" class="edit-post__secondary" @click="isPickingLocation = true">
            <span aria-hidden="true">📍</span> {{ location ? 'Change location' : 'Add location' }}
          </button>
        </div>

        <p v-if="error" class="edit-post__error" role="alert">{{ error }}</p>
        <div class="edit-post__actions">
          <button type="button" class="edit-post__secondary" @click="emit('close')">Cancel</button>
          <button type="submit" class="edit-post__save" :disabled="isSaving">Save</button>
        </div>
      </form>

      <LocationPickerModal
        :is-open="isPickingLocation"
        :current="location"
        @confirm="location = $event"
        @close="isPickingLocation = false"
      />
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonIcon, IonModal } from '@ionic/vue';
import { close } from 'ionicons/icons';
import { useCatalogStore } from '@/stores/catalog';
import { usePostsStore } from '@/stores/posts';
import { useSportsStore } from '@/stores/sports';
import type { FeedPost, PostLocation } from '@/types/post';
import { POST_CAPTION_MAX_LENGTH } from '@/utils/feed';
import { showNotice } from '@/utils/notice';
import LocationPickerModal from './LocationPickerModal.vue';

const props = defineProps<{ post: FeedPost | null }>();
const emit = defineEmits<{ close: [] }>();

const postsStore = usePostsStore();
const sportsStore = useSportsStore();
const catalog = useCatalogStore();
const caption = ref('');
const sport = ref('');
const location = ref<PostLocation | null>(null);
const error = ref<string | null>(null);
const isSaving = ref(false);
const isPickingLocation = ref(false);

/** Active sports from the API (the demo catalog if that list could not load), plus the post's current one. */
const sportOptions = computed(() => {
  const names =
    sportsStore.activeSports.length > 0
      ? sportsStore.activeSports.map((option) => option.name)
      : catalog.sports.map((option) => option.name);
  const current = props.post?.sport;

  return current && !names.includes(current) ? [current, ...names] : names;
});

watch(
  () => props.post,
  (post) => {
    if (post) {
      caption.value = post.body;
      sport.value = post.sport;
      location.value = post.location ?? null;
      error.value = null;
      void sportsStore.fetchSports();
      void catalog.load();
    }
  },
  { immediate: true },
);

async function save(): Promise<void> {
  if (!props.post || isSaving.value) {
    return;
  }

  isSaving.value = true;

  try {
    error.value = await postsStore.editPost(props.post.id, {
      body: caption.value,
      sport: sport.value,
      location: location.value,
    });

    if (!error.value) {
      void showNotice('Post updated.');
      emit('close');
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.edit-post-modal {
  --background: var(--gora-surface);
  --border-radius: 24px;
}

.edit-post-content {
  --background: var(--gora-surface);
}

.edit-post {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom));
}

.edit-post__title {
  margin: 0 0 6px;
  font-size: 1.1rem;
  font-weight: 700;
}

.edit-post__label {
  margin-top: 8px;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.edit-post__field {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.92rem;
}

textarea.edit-post__field {
  resize: vertical;
}

.edit-post__counter {
  align-self: flex-end;
  color: #7d8a93;
  font-size: 0.7rem;
}

.edit-post__location {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.edit-post__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 12px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 600;
}

.edit-post__chip button {
  display: flex;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.edit-post__error {
  margin: 4px 0 0;
  color: #ff7a7a;
  font-size: 0.82rem;
}

.edit-post__actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.edit-post__secondary,
.edit-post__save {
  padding: 11px 16px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.edit-post__secondary {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
  font-size: 0.84rem;
}

.edit-post__actions > * {
  flex: 1;
}

.edit-post__save {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.edit-post__save:disabled {
  opacity: 0.6;
}
</style>
