<template>
  <ion-page>
    <SubPageHeader title="Upload Reel" back-href="/reels" />

    <ion-content>
      <form class="create-media" @submit.prevent="upload">
        <div v-if="author" class="create-media__author">
          <UserAvatar :user="author" :size="42" />
          <span class="create-media__author-meta">
            <strong>{{ author.displayName }}</strong>
            <span class="create-media__muted">{{ privacy.emoji }} {{ privacy.label }} · shows in your Highlights</span>
          </span>
        </div>

        <label class="create-media__label" for="create-reel-video">Upload video</label>
        <label
          class="reel-upload__picker"
          for="create-reel-video"
          :class="{ 'reel-upload__picker--disabled': isSaving }"
        >
          <ion-icon :icon="cloudUploadOutline" aria-hidden="true" />
          <strong>{{ videoFile ? 'Change video' : 'Choose a video' }}</strong>
        </label>
        <input
          id="create-reel-video"
          ref="fileInput"
          class="reel-upload__file"
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          :disabled="isSaving"
          @change="selectVideo"
        />
        <div v-if="videoFile" class="reel-upload__selection">
          <span
            >{{ videoFile.name }} <small>{{ (videoFile.size / 1024 / 1024).toFixed(1) }} MB</small></span
          >
          <button type="button" :disabled="isSaving" @click="clearVideo">Remove</button>
        </div>
        <video
          v-if="previewUrl"
          :key="previewUrl"
          class="reel-upload__preview"
          :src="previewUrl"
          controls
          playsinline
          preload="metadata"
          @loadedmetadata="readDuration"
          @error="previewFailed"
        />
        <p v-if="videoFile && !durationSeconds && !error" class="create-media__muted" role="status">
          Checking your video…
        </p>

        <label class="create-media__label" for="create-reel-caption">Caption (optional)</label>
        <textarea
          id="create-reel-caption"
          v-model="caption"
          :disabled="isSaving"
          class="create-media__input create-media__textarea"
          rows="3"
          :maxlength="REEL_CAPTION_MAX_LENGTH"
          placeholder="Buzzer beater from last night"
        />
        <span class="create-media__counter">{{ caption.length }}/{{ REEL_CAPTION_MAX_LENGTH }}</span>

        <label class="create-media__label" for="create-reel-sport">Sport</label>
        <select id="create-reel-sport" v-model="sport" class="create-media__input" :disabled="isSaving">
          <option value="">No sport</option>
          <option v-for="option in sportsStore.activeSports" :key="option.id" :value="option.name">
            {{ option.name }}
          </option>
        </select>

        <span class="create-media__label">Who can see it</span>
        <fieldset class="reel-upload__audience" :disabled="isSaving">
          <PostAudiencePicker v-model:visibility="visibility" v-model:custom-viewer-ids="customViewerIds" />
        </fieldset>
        <p v-if="error" class="create-media__error" role="alert">{{ error }}</p>
        <div v-if="isSaving" class="reel-upload__progress" role="status" aria-live="polite">
          <progress :value="uploadProgress" max="100" aria-label="Video upload progress" />
          <span>{{ uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Saving your reel…' }}</span>
          <button type="button" @click="cancelUpload">Cancel upload</button>
        </div>
        <button type="submit" class="create-media__submit" :disabled="!videoFile || !durationSeconds || isSaving">
          {{ isSaving ? 'Uploading…' : 'Upload Reel' }}
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
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import { useSportsStore } from '@/stores/sports';
import { useAuthStore } from '@/stores/auth';
import type { PostVisibility } from '@/types/post';
import { REEL_CAPTION_MAX_LENGTH } from '@/utils/media-api';
import { REEL_VIDEO_MAX_SECONDS, validateReelVideo } from '@/utils/reel-upload';
import { showNotice } from '@/utils/notice';
import { getPrivacyOption } from '@/utils/post-privacy';

const router = useRouter();
const session = useSessionStore();
const sportsStore = useSportsStore();
const reelsStore = useReelsStore();
const auth = useAuthStore();
const author = computed(() => session.me);

const fileInput = ref<HTMLInputElement | null>(null);
const videoFile = ref<File | null>(null);
const previewUrl = ref('');
const durationSeconds = ref(0);
const uploadProgress = ref(0);
let uploadController: AbortController | null = null;
const caption = ref('');
const sport = ref('');
const visibility = ref<PostVisibility>('PUBLIC');
const customViewerIds = ref<string[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);

const privacy = computed(() => getPrivacyOption(visibility.value));

function clearVideo(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  videoFile.value = null;
  durationSeconds.value = 0;
  if (fileInput.value) fileInput.value.value = '';
}

function selectVideo(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  clearVideo();
  error.value = validateReelVideo(file);
  if (error.value) return;
  videoFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

function readDuration(event: Event): void {
  const duration = (event.target as HTMLVideoElement).duration;
  if (!Number.isFinite(duration) || duration <= 0 || duration > REEL_VIDEO_MAX_SECONDS) {
    error.value = 'Choose a video up to 10 minutes long.';
    durationSeconds.value = 0;
    return;
  }
  durationSeconds.value = duration;
  error.value = null;
}

function previewFailed(): void {
  durationSeconds.value = 0;
  error.value = 'This video cannot be played. Try another MP4 or WebM video.';
}

function cancelUpload(): void {
  uploadController?.abort();
}

function releaseVideo(): void {
  cancelUpload();
  clearVideo();
}

watch(
  () => auth.sessionVersion,
  () => {
    releaseVideo();
    caption.value = '';
    customViewerIds.value = [];
    visibility.value = 'PUBLIC';
  },
);
onIonViewWillLeave(releaseVideo);
onBeforeUnmount(releaseVideo);

async function upload(): Promise<void> {
  if (isSaving.value || !videoFile.value || !durationSeconds.value) {
    return;
  }

  isSaving.value = true;
  error.value = null;
  uploadProgress.value = 0;
  const controller = new AbortController();
  uploadController = controller;

  try {
    const result = await reelsStore.uploadReel(
      {
        video: videoFile.value,
        durationSeconds: durationSeconds.value,
        caption: caption.value,
        sport: sport.value,
        visibility: visibility.value,
        customViewerIds: visibility.value === 'CUSTOM' ? customViewerIds.value : [],
      },
      {
        signal: controller.signal,
        onProgress: (percent) => {
          uploadProgress.value = percent;
        },
      },
    );

    if ('error' in result) {
      error.value = result.error;
      return;
    }

    clearVideo();
    caption.value = '';
    visibility.value = 'PUBLIC';
    customViewerIds.value = [];
    void showNotice('Reel uploaded to your Highlights.');
    await router.replace('/profile/reels');
  } finally {
    uploadController = null;
    isSaving.value = false;
  }
}

onMounted(() => {
  void session.load();
  void sportsStore.fetchSports();
  void reelsStore.load();
});
</script>

<style scoped src="@/theme/create-media.css"></style>
<style scoped>
.reel-upload__picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 16px;
  border: 2px dashed var(--gora-line-strong);
  border-radius: 16px;
  background: var(--gora-surface);
  cursor: pointer;
  text-align: center;
}
.reel-upload__picker:hover {
  border-color: var(--ion-color-primary);
}
.reel-upload__picker ion-icon {
  color: var(--ion-color-primary);
  font-size: 36px;
}
.reel-upload__picker--disabled {
  opacity: 0.6;
  cursor: default;
}
.reel-upload__file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.reel-upload__picker:has(+ input:focus-visible) {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 3px;
}
.reel-upload__preview {
  width: 100%;
  max-height: 360px;
  border-radius: 14px;
  background: #000;
  object-fit: contain;
}
.reel-upload__selection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.85rem;
}
.reel-upload__selection span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.reel-upload__selection small {
  color: var(--gora-muted);
}
.reel-upload__selection button,
.reel-upload__progress button {
  border: 0;
  background: transparent;
  color: var(--ion-color-primary);
  cursor: pointer;
  font: inherit;
}
.reel-upload__audience {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.reel-upload__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 16px;
  font-size: 0.85rem;
}
.reel-upload__progress progress {
  width: 100%;
  accent-color: var(--ion-color-primary);
}
</style>
