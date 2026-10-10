<template>
  <ion-page>
    <SubPageHeader title="Add Story" back-href="/home" />
    <ion-content>
      <form class="create-media" @submit.prevent="share">
        <div v-if="author" class="create-media__author">
          <UserAvatar :user="author" :size="42" />
          <span class="create-media__author-meta">
            <strong>{{ author.displayName }}</strong>
            <span class="create-media__muted">{{ privacy.emoji }} {{ privacy.label }} · disappears after 24 hours</span>
          </span>
        </div>

        <label class="create-media__label" for="create-story-media">Upload photo/video</label>
        <label
          class="media-upload__picker"
          for="create-story-media"
          :class="{ 'media-upload__picker--disabled': isSaving }"
        >
          <ion-icon :icon="cloudUploadOutline" aria-hidden="true" />
          <strong>{{ mediaFile ? 'Change photo/video' : 'Choose a photo or video' }}</strong>
        </label>
        <input
          id="create-story-media"
          ref="fileInput"
          class="media-upload__file"
          type="file"
          :accept="STORY_MEDIA_ACCEPT"
          :disabled="isSaving"
          @change="selectMedia"
        />
        <div v-if="mediaFile" class="media-upload__selection">
          <span
            >{{ mediaFile.name }} <small>{{ (mediaFile.size / 1024 / 1024).toFixed(1) }} MB</small></span
          >
          <button type="button" :disabled="isSaving" @click="removeMedia">Remove</button>
        </div>
        <img
          v-if="previewUrl && mediaType === 'IMAGE'"
          :key="previewUrl"
          :src="previewUrl"
          alt="Story preview"
          class="media-upload__preview"
          @load="previewReady"
          @error="previewFailed"
        />
        <video
          v-else-if="previewUrl"
          :key="previewUrl"
          :src="previewUrl"
          class="media-upload__preview"
          controls
          playsinline
          preload="metadata"
          @loadedmetadata="previewReady"
          @error="previewFailed"
        />

        <label class="create-media__label" for="create-story-caption">Caption (optional)</label>
        <textarea
          id="create-story-caption"
          v-model="caption"
          :disabled="isSaving"
          class="create-media__input create-media__textarea"
          rows="3"
          :maxlength="STORY_CAPTION_MAX_LENGTH"
          placeholder="Game day!"
        />
        <span class="create-media__counter">{{ caption.length }}/{{ STORY_CAPTION_MAX_LENGTH }}</span>

        <span class="create-media__label">Who can see it</span>
        <fieldset class="media-upload__audience" :disabled="isSaving">
          <PostAudiencePicker v-model:visibility="visibility" v-model:custom-viewer-ids="customViewerIds" />
        </fieldset>
        <p v-if="error" class="create-media__error" role="alert">{{ error }}</p>
        <div v-if="isSaving" class="media-upload__progress" role="status" aria-live="polite">
          <progress :value="uploadProgress" max="100" aria-label="Story upload progress" />
          <span>{{ uploadProgress < 100 ? 'Uploading… ' + uploadProgress + '%' : 'Saving your story…' }}</span>
          <button type="button" @click="cancelUpload">Cancel upload</button>
        </div>
        <button type="submit" class="create-media__submit" :disabled="!mediaFile || !mediaReady || isSaving">
          {{ isSaving ? 'Uploading…' : 'Share Story' }}
        </button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, onIonViewWillLeave } from '@ionic/vue';
import { cloudUploadOutline } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PostAudiencePicker from '@/components/feed/PostAudiencePicker.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useStoriesStore } from '@/stores/stories';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import type { PostVisibility } from '@/types/post';
import { STORY_CAPTION_MAX_LENGTH } from '@/utils/media-api';
import { STORY_MEDIA_ACCEPT, storyFileType, validateStoryFile } from '@/utils/story-upload';
import { showNotice } from '@/utils/notice';
import { getPrivacyOption } from '@/utils/post-privacy';

const router = useRouter();
const storiesStore = useStoriesStore();
const auth = useAuthStore();
const author = computed(() => storiesStore.viewer);
const fileInput = ref<HTMLInputElement | null>(null);
const mediaFile = ref<File | null>(null);
const mediaType = computed(() => (mediaFile.value ? storyFileType(mediaFile.value) : null));
const previewUrl = ref('');
const mediaReady = ref(false);
const uploadProgress = ref(0);
const caption = ref('');
const visibility = ref<PostVisibility>('PUBLIC');
const customViewerIds = ref<string[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);
let uploadController: AbortController | null = null;
const privacy = computed(() => getPrivacyOption(visibility.value));

function clearMedia(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  mediaFile.value = null;
  mediaReady.value = false;
  if (fileInput.value) fileInput.value.value = '';
}
function removeMedia(): void {
  clearMedia();
  error.value = null;
}
function selectMedia(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  clearMedia();
  error.value = validateStoryFile(file);
  if (error.value) return;
  mediaFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}
function previewReady(event: Event): void {
  const element = event.target as HTMLImageElement | HTMLVideoElement;
  if (element.getAttribute('src') !== previewUrl.value) return;
  mediaReady.value = true;
  error.value = null;
}
function previewFailed(event: Event): void {
  if ((event.target as HTMLElement).getAttribute('src') !== previewUrl.value) return;
  mediaReady.value = false;
  error.value = 'This file cannot be previewed. Choose another photo or video.';
}
function cancelUpload(): void {
  uploadController?.abort();
}
function releaseMedia(): void {
  cancelUpload();
  clearMedia();
}

watch(
  [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
  () => {
    releaseMedia();
    caption.value = '';
    customViewerIds.value = [];
    visibility.value = 'PUBLIC';
    error.value = null;
  },
  { flush: 'sync' },
);
onIonViewWillLeave(releaseMedia);
onBeforeUnmount(releaseMedia);

async function share(): Promise<void> {
  if (isSaving.value || !mediaFile.value || !mediaReady.value) return;
  const isCurrent = captureSession(auth);
  const controller = new AbortController();
  uploadController = controller;
  isSaving.value = true;
  uploadProgress.value = 0;
  error.value = null;
  try {
    const result = await storiesStore.uploadStory(
      {
        media: mediaFile.value,
        caption: caption.value,
        visibility: visibility.value,
        customViewerIds: visibility.value === 'CUSTOM' ? customViewerIds.value : [],
      },
      {
        signal: controller.signal,
        onProgress: (percent) => {
          if (isCurrent()) uploadProgress.value = percent;
        },
      },
    );
    if (!isCurrent()) return;
    if ('error' in result) {
      error.value = result.error;
      return;
    }
    if (controller.signal.aborted) return;
    clearMedia();
    caption.value = '';
    visibility.value = 'PUBLIC';
    customViewerIds.value = [];
    void showNotice('Story added. It disappears after 24 hours.');
    await router.replace('/home');
  } finally {
    if (uploadController === controller) {
      uploadController = null;
      isSaving.value = false;
    }
  }
}
onMounted(() => {
  void storiesStore.load();
});
</script>

<style scoped src="@/theme/create-media.css"></style>
<style scoped src="@/theme/media-upload.css"></style>
