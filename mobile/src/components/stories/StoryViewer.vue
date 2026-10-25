<template>
  <ion-modal :is-open="isOpen" class="story-viewer-modal" @did-dismiss="emit('close')">
    <div v-if="currentGroup && currentStory" class="story-viewer">
      <div class="story-viewer__media" :style="{ background: visual.gradient }">
        <img
          v-if="currentStory.media.url && currentStory.media.type === 'image'"
          :src="currentStory.media.url"
          :alt="currentStory.media.caption"
          class="story-viewer__image"
        />
        <video
          v-else-if="currentStory.media.url && currentStory.fromServer"
          :src="currentStory.media.url"
          class="story-viewer__image"
          autoplay
          muted
          playsinline
        />
        <div v-else class="story-viewer__placeholder" aria-hidden="true">
          <ion-icon :icon="visual.icon" class="story-viewer__sport-icon" />
          <span v-if="currentStory.media.type === 'video'" class="story-viewer__media-type">
            <ion-icon :icon="play" /> Video
          </span>
        </div>
      </div>

      <div class="story-viewer__top">
        <div class="story-viewer__segments">
          <span v-for="(story, index) in currentGroup.stories" :key="story.id" class="story-viewer__segment">
            <span class="story-viewer__segment-fill" :style="{ transform: `scaleX(${getSegmentFill(index)})` }" />
          </span>
        </div>

        <div class="story-viewer__header">
          <UserAvatar :user="currentGroup.user" :size="36" />
          <div class="story-viewer__meta">
            <strong>{{ currentGroup.user.displayName }}</strong>
            <span>
              {{ postedLabel }}
              <template v-if="isOwnStory"> · {{ privacyLabel }}</template>
            </span>
          </div>
          <StoryOptionsButton
            v-if="isOwnStory"
            :story="currentStory"
            tone="overlay"
            @busy="$event ? pause() : resume()"
            @deleted="emit('close')"
          />
          <button type="button" class="story-viewer__close" aria-label="Close story" @click="emit('close')">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <span class="story-viewer__expiry">
          <ion-icon :icon="hourglassOutline" aria-hidden="true" />
          {{ timeLeftLabel }}
        </span>
      </div>

      <button type="button" class="story-viewer__tap story-viewer__tap--prev" aria-label="Previous story" @click="previous" />
      <button type="button" class="story-viewer__tap story-viewer__tap--next" aria-label="Next story" @click="next" />

      <div class="story-viewer__bottom">
        <div v-if="currentStory.music" class="story-viewer__music" aria-label="Story music">
          <ion-icon :icon="musicalNotes" class="story-viewer__music-icon" aria-hidden="true" />
          <span class="story-viewer__music-text">
            <strong>{{ currentStory.music.title }}</strong>
            <span>
              <template v-if="currentStory.music.artist">{{ currentStory.music.artist }} · </template>
              {{ formatMusicSegment(currentStory.music) }}
            </span>
          </span>
        </div>
        <span v-if="currentStory.media.sport" class="story-viewer__sport">{{ currentStory.media.sport }}</span>
        <p v-if="currentStory.media.caption" class="story-viewer__caption">{{ currentStory.media.caption }}</p>
        <p class="story-viewer__note">Stories disappear 24 hours after posting.</p>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, toRef, watch } from 'vue';
import { IonIcon, IonModal } from '@ionic/vue';
import { closeOutline, hourglassOutline, musicalNotes, play } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import StoryOptionsButton from '@/components/media/StoryOptionsButton.vue';
import { useStoryPlayback } from '@/composables/useStoryPlayback';
import { useStoriesStore } from '@/stores/stories';
import type { StoryGroup } from '@/types/story';
import { getPrivacyOption } from '@/utils/post-privacy';
import { getSportVisual } from '@/utils/sports';
import { formatMusicSegment, getStoryRemainingMs } from '@/utils/stories';
import { formatTimeAgo, formatTimeLeft } from '@/utils/time';

const props = defineProps<{
  isOpen: boolean;
  groups: readonly StoryGroup[];
  startIndex: number;
  nowMs: number;
}>();

const emit = defineEmits<{ close: [] }>();

const storiesStore = useStoriesStore();
const { currentGroup, currentStory, start, stop, pause, resume, next, previous, getSegmentFill } = useStoryPlayback(
  toRef(props, 'groups'),
  () => emit('close'),
);

/** Only your own stored stories get the "⋯" menu (Edit caption, Edit privacy, Delete). */
const isOwnStory = computed(
  () => currentStory.value?.fromServer === true && currentStory.value.user.id === storiesStore.viewer?.id,
);
const privacyLabel = computed(() => {
  const option = getPrivacyOption(currentStory.value?.visibility ?? 'PUBLIC');
  return `${option.emoji} ${option.label}`;
});

const visual = computed(() => getSportVisual(currentStory.value?.media.sport ?? ''));

const postedLabel = computed(() =>
  currentStory.value ? formatTimeAgo(Date.parse(currentStory.value.createdAt), props.nowMs) : '',
);

const timeLeftLabel = computed(() =>
  currentStory.value ? `Disappears · ${formatTimeLeft(getStoryRemainingMs(currentStory.value, props.nowMs))}` : '',
);

watch(
  () => props.isOpen,
  (isOpen) => (isOpen ? start(props.startIndex) : stop()),
  { immediate: true },
);
</script>

<style scoped>
.story-viewer-modal {
  --width: 100%;
  --height: 100%;
  --border-radius: 0;
  --background: #000;
}

.story-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #fff;
}

.story-viewer__media {
  position: absolute;
  inset: 0;
}

.story-viewer__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.story-viewer__placeholder {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.story-viewer__sport-icon {
  font-size: 120px;
  opacity: 0.35;
}

.story-viewer__media-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.story-viewer__top {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  left: 0;
  padding: calc(12px + env(safe-area-inset-top)) 14px 24px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent);
}

.story-viewer__segments {
  display: flex;
  gap: 4px;
}

.story-viewer__segment {
  height: 3px;
  flex: 1;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.3);
}

.story-viewer__segment-fill {
  display: block;
  height: 100%;
  background: #fff;
  transform-origin: left;
}

.story-viewer__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.story-viewer__meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: 0.85rem;
  line-height: 1.25;
}

.story-viewer__meta span {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.75rem;
}

.story-viewer__close {
  display: flex;
  padding: 6px;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 26px;
  cursor: pointer;
}

.story-viewer__expiry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.16);
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.story-viewer__tap {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  width: 40%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.story-viewer__tap--prev {
  left: 0;
}

.story-viewer__tap--next {
  right: 0;
  width: 60%;
}

.story-viewer__bottom {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 48px 20px calc(24px + env(safe-area-inset-bottom));
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.7), transparent);
  pointer-events: none;
}

.story-viewer__music {
  display: flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 8px 14px 8px 10px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
}

.story-viewer__music-icon {
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-size: 20px;
}

.story-viewer__music-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  font-size: 0.85rem;
  line-height: 1.25;
}

.story-viewer__music-text strong,
.story-viewer__music-text span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-viewer__music-text span {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.75rem;
}

.story-viewer__sport {
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.story-viewer__caption {
  margin: 8px 0 0;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.35;
}

.story-viewer__note {
  margin: 14px 0 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
}
</style>
