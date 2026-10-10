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

        <span class="create-media__label">Type</span>
        <div class="create-media__types" role="radiogroup" aria-label="Story type">
          <button
            v-for="option in MEDIA_TYPES"
            :key="option.id"
            type="button"
            role="radio"
            class="create-media__type"
            :class="{ 'create-media__type--active': mediaType === option.id }"
            :aria-checked="mediaType === option.id"
            @click="mediaType = option.id"
          >
            {{ option.label }}
          </button>
        </div>

        <label class="create-media__label" for="create-story-url">{{ mediaType === 'VIDEO' ? 'Video link' : 'Photo link' }}</label>
        <input
          id="create-story-url"
          v-model="mediaUrl"
          class="create-media__input"
          type="url"
          inputmode="url"
          :maxlength="MEDIA_URL_MAX_LENGTH"
          placeholder="https://…"
        />
        <p class="create-media__muted">Uploads come later; paste a link to an image or video that is already online.</p>
        <img
          v-if="mediaType === 'IMAGE' && hasValidUrl && !previewFailed"
          :src="mediaUrl.trim()"
          alt="Story preview"
          class="create-media__preview"
          @error="previewFailed = true"
        />

        <label class="create-media__label" for="create-story-caption">Caption (optional)</label>
        <textarea
          id="create-story-caption"
          v-model="caption"
          class="create-media__input create-media__textarea"
          rows="3"
          :maxlength="STORY_CAPTION_MAX_LENGTH"
          placeholder="Game day!"
        />
        <span class="create-media__counter">{{ caption.length }}/{{ STORY_CAPTION_MAX_LENGTH }}</span>

        <span class="create-media__label">Who can see it</span>
        <PostAudiencePicker v-model:visibility="visibility" v-model:custom-viewer-ids="customViewerIds" />
        <p v-if="error" class="create-media__error" role="alert">{{ error }}</p>

        <button type="submit" class="create-media__submit" :disabled="!hasValidUrl || isSaving">Share Story</button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonPage } from '@ionic/vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PostAudiencePicker from '@/components/feed/PostAudiencePicker.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useStoriesStore } from '@/stores/stories';
import type { PostVisibility } from '@/types/post';
import type { StoryDraft } from '@/types/story';
import { MEDIA_URL_MAX_LENGTH, STORY_CAPTION_MAX_LENGTH, isMediaUrl } from '@/utils/media-api';
import { showNotice } from '@/utils/notice';
import { getPrivacyOption } from '@/utils/post-privacy';

const MEDIA_TYPES = [
  { id: 'IMAGE', label: '📷 Photo' },
  { id: 'VIDEO', label: '🎬 Video' },
] as const;

const router = useRouter();
const storiesStore = useStoriesStore();
const author = computed(() => storiesStore.viewer);

const mediaType = ref<StoryDraft['mediaType']>('IMAGE');
const mediaUrl = ref('');
const caption = ref('');
const visibility = ref<PostVisibility>('PUBLIC');
const customViewerIds = ref<string[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);
const previewFailed = ref(false);

const privacy = computed(() => getPrivacyOption(visibility.value));
const hasValidUrl = computed(() => isMediaUrl(mediaUrl.value));

watch(mediaUrl, () => {
  previewFailed.value = false;
});

async function share(): Promise<void> {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  error.value = null;

  try {
    const result = await storiesStore.createStory({
      mediaType: mediaType.value,
      mediaUrl: mediaUrl.value,
      caption: caption.value,
      visibility: visibility.value,
      customViewerIds: visibility.value === 'CUSTOM' ? customViewerIds.value : [],
    });

    if ('error' in result) {
      error.value = result.error;
      return;
    }

    mediaUrl.value = '';
    caption.value = '';
    visibility.value = 'PUBLIC';
    customViewerIds.value = [];
    void showNotice('Story added. It disappears after 24 hours.');
    await router.replace('/home');
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void storiesStore.load();
});
</script>

<style scoped src="@/theme/create-media.css"></style>
