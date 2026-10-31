<template>
  <ion-modal :is-open="isOpen" :can-dismiss="!busy" @did-dismiss="emit('close')">
    <ion-header
      ><ion-toolbar
        ><ion-title>Cover photo</ion-title
        ><ion-buttons slot="end"
          ><ion-button :disabled="busy" @click="emit('close')">Close</ion-button></ion-buttons
        ></ion-toolbar
      ></ion-header
    >
    <ion-content>
      <div class="cover-editor" :aria-busy="busy">
        <div class="cover-editor__preview">
          <img v-if="preview || currentUrl" :src="preview || currentUrl || undefined" alt="Cover photo preview" />
          <p v-else>Choose a photo for the top of your profile.</p>
        </div>
        <p class="cover-editor__hint">Your photo will be centered to fit your cover.</p>
        <input
          ref="inputRef"
          class="cover-editor__file"
          type="file"
          accept="image/*"
          aria-label="Choose cover photo"
          :disabled="busy"
          @change="select"
        />
        <p v-if="error" role="alert" class="cover-editor__error">{{ error }}</p>
        <label v-if="file" class="cover-editor__share">
          <input v-model="shareToFeed" type="checkbox" :disabled="busy" />
          <span>Share this cover photo to your feed</span>
        </label>
        <label v-if="file && shareToFeed" class="cover-editor__caption-label" for="cover-feed-caption">Caption</label>
        <textarea
          v-if="file && shareToFeed"
          id="cover-feed-caption"
          v-model="caption"
          class="cover-editor__caption"
          maxlength="2200"
          placeholder="Add a caption for your feed post"
          :disabled="busy"
        />
        <span v-if="file && shareToFeed" class="cover-editor__counter">{{ caption.length }}/2200</span>
        <div class="cover-editor__actions">
          <ion-button fill="outline" :disabled="busy || coverSaved" @click="inputRef?.click()">{{
            file ? 'Choose another photo' : 'Choose photo'
          }}</ion-button>
          <ion-button
            v-if="currentUrl && !file"
            fill="clear"
            color="danger"
            :disabled="busy"
            @click="save(true)"
            >Remove cover</ion-button
          >
          <ion-button :disabled="!file || busy || (shareToFeed && !caption.trim())" @click="save(false)">
            <ion-spinner v-if="busy" slot="start" name="crescent" />
            {{ busy ? (isPosting ? 'Posting…' : 'Saving…') : coverSaved && shareToFeed ? 'Retry post' : shareToFeed ? 'Save & share' : 'Save cover' }}
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonSpinner } from '@ionic/vue';
import { useProfileStore } from '@/stores/profile';
import { usePostsStore } from '@/stores/posts';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import { POST_PHOTO_SOURCE_MAX_BYTES, preparePostPhoto } from '@/utils/post-photos';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ isOpen: boolean; currentUrl: string | null }>();
const emit = defineEmits<{ close: [] }>();
const profile = useProfileStore();
const posts = usePostsStore();
const auth = useAuthStore();
const inputRef = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const preview = ref('');
const error = ref<string | null>(null);
const shareToFeed = ref(false);
const caption = ref('');
const isPosting = ref(false);
const coverSaved = ref(false);
const preparedPhoto = ref<string | null>(null);
const busy = computed(() => profile.saving || isPosting.value);

function reset(): void {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = '';
  file.value = null;
  error.value = null;
  shareToFeed.value = false;
  caption.value = '';
  isPosting.value = false;
  coverSaved.value = false;
  preparedPhoto.value = null;
}
function select(event: Event): void {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = '';
  if (!selected) return;
  if (!selected.type.startsWith('image/') || selected.size > POST_PHOTO_SOURCE_MAX_BYTES) {
    error.value = 'Choose an image smaller than 20 MB.';
    return;
  }
  reset();
  file.value = selected;
  preview.value = URL.createObjectURL(selected);
}
async function save(remove: boolean): Promise<void> {
  if (busy.value || (!remove && !file.value)) return;
  const isCurrent = captureSession(auth);
  error.value = null;
  try {
    if (!remove && shareToFeed.value && file.value && !preparedPhoto.value) {
      preparedPhoto.value = await preparePostPhoto(file.value);
      if (!isCurrent()) return;
    }
    if (!coverSaved.value) {
      const result = await profile.updateCover(remove ? null : file.value, preparedPhoto.value ?? undefined);
      if (!isCurrent()) return;
      if (!result.ok) {
        error.value = result.message;
        return;
      }
      coverSaved.value = true;
    }

    if (!remove && shareToFeed.value && preparedPhoto.value) {
      isPosting.value = true;
      const postError = await posts.publishPhotoUpdate(caption.value, preparedPhoto.value);
      isPosting.value = false;
      if (!isCurrent()) return;
      if (postError) {
        error.value = `Cover photo saved, but the feed post failed: ${postError}`;
        return;
      }
    }
    void showNotice(remove ? 'Cover photo removed.' : shareToFeed.value ? 'Cover photo shared to your feed.' : 'Cover photo updated.');
    emit('close');
  } catch (caught) {
    isPosting.value = false;
    error.value = caught instanceof Error ? caught.message : 'That cover photo could not be saved.';
  }
}
watch(
  () => props.isOpen,
  (open) => {
    if (!open) reset();
  },
);
watch(
  () => auth.sessionVersion,
  () => {
    reset();
    emit('close');
  },
  { flush: 'sync' },
);
onBeforeUnmount(reset);
</script>

<style scoped>
.cover-editor {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 16px;
}
.cover-editor__preview {
  display: grid;
  place-items: center;
  aspect-ratio: 2.7;
  overflow: hidden;
  border-radius: 14px;
  background: var(--gora-surface-raised);
  color: var(--gora-muted);
}
.cover-editor__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-editor__preview p {
  padding: 16px;
  text-align: center;
}
.cover-editor__hint {
  color: var(--gora-muted);
  font-size: 0.85rem;
}
.cover-editor__share {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  color: var(--ion-text-color);
  font-weight: 700;
}
.cover-editor__share input { width: 18px; height: 18px; accent-color: var(--ion-color-primary); }
.cover-editor__caption-label { display: block; margin-top: 14px; color: var(--gora-muted); font-size: .85rem; font-weight: 700; }
.cover-editor__caption { width: 100%; min-height: 92px; margin-top: 6px; padding: 12px; border: 1px solid var(--gora-line-strong); border-radius: 10px; background: var(--gora-surface-raised); color: var(--ion-text-color); resize: vertical; }
.cover-editor__counter { display: block; color: var(--gora-muted); text-align: right; font-size: .78rem; }
.cover-editor__file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}
.cover-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cover-editor__error {
  color: #ff8585;
}
</style>
