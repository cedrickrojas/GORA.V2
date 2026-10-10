<template>
  <ul class="highlight-grid">
    <li v-for="highlight in highlights" :key="highlight.id" class="highlight-grid__item" :style="itemStyle(highlight)">
      <button
        v-if="highlight.videoUrl"
        type="button"
        class="highlight-grid__open"
        :aria-label="`Play ${highlight.title}`"
        @click="playingId = highlight.id"
      />
      <ion-icon :icon="playCircle" class="highlight-grid__play" aria-hidden="true" />
      <span v-if="highlight.visibility" class="highlight-grid__privacy" :title="privacyLabel(highlight)">
        {{ getPrivacyOption(highlight.visibility).emoji }}
      </span>
      <span v-if="editableById.get(highlight.id)" class="highlight-grid__options">
        <ReelOptionsButton :reel="editableById.get(highlight.id)!" />
      </span>
      <span v-else-if="highlight.durationSeconds > 0" class="highlight-grid__duration">
        {{ formatDuration(highlight.durationSeconds) }}
      </span>
      <span class="highlight-grid__info">
        <strong>{{ highlight.title }}</strong>
        <span>
          <ion-icon :icon="eyeOutline" aria-hidden="true" />
          {{ formatCompactNumber(highlight.views) }}
        </span>
      </span>
    </li>
  </ul>
  <ion-modal :is-open="!!playingHighlight" @did-dismiss="playingId = null">
    <ion-header>
      <ion-toolbar>
        <ion-title>Watch Reel</ion-title>
        <ion-buttons slot="end"><ion-button @click="playingId = null">Close</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="playingHighlight" class="highlight-grid__viewer">
        <video :key="playingHighlight.id" :src="playingHighlight.videoUrl ?? undefined" controls autoplay playsinline />
        <p>{{ playingHighlight.title }}</p>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/vue';
import { eyeOutline, playCircle } from 'ionicons/icons';
import ReelOptionsButton from '@/components/media/ReelOptionsButton.vue';
import type { Highlight } from '@/types/profile';
import type { Reel } from '@/types/reel';
import { getPrivacyOption } from '@/utils/post-privacy';
import { getSportVisual } from '@/utils/sports';
import { formatCompactNumber, formatDuration } from '@/utils/time';

const props = withDefaults(
  defineProps<{
    highlights: readonly Highlight[];
    /** Your own stored reels: these highlights get the "⋯" menu (edit, privacy, delete). */
    editableReels?: readonly Reel[];
  }>(),
  { editableReels: () => [] },
);

const editableById = computed(() => new Map(props.editableReels.map((reel) => [reel.id, reel])));
const playingId = ref<string | null>(null);
const playingHighlight = computed(() => props.highlights.find((highlight) => highlight.id === playingId.value));

function itemStyle(highlight: Highlight): Record<string, string> {
  const { gradient } = getSportVisual(highlight.sport);
  const thumbnail = editableById.value.get(highlight.id)?.thumbnailUrl;

  return thumbnail
    ? { background: `center / cover no-repeat url("${encodeURI(thumbnail)}"), ${gradient}` }
    : { background: gradient };
}

function privacyLabel(highlight: Highlight): string {
  return getPrivacyOption(highlight.visibility ?? 'PUBLIC').label;
}
</script>

<style scoped>
.highlight-grid {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
}

.highlight-grid__item {
  position: relative;
  display: flex;
  aspect-ratio: 9 / 14;
  align-items: flex-end;
  overflow: hidden;
  border-radius: 14px;
}

.highlight-grid__play {
  pointer-events: none;
  position: absolute;
  top: 50%;
  left: 50%;
  color: rgba(255, 255, 255, 0.85);
  font-size: 34px;
  transform: translate(-50%, -60%);
}

.highlight-grid__privacy {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 0.7rem;
}

.highlight-grid__duration {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 0.66rem;
  font-weight: 600;
}

.highlight-grid__options {
  position: absolute;
  z-index: 1;
  top: 4px;
  right: 4px;
}

.highlight-grid__info {
  pointer-events: none;
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 2px;
  padding: 24px 8px 8px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.65), transparent);
  font-size: 0.72rem;
}

.highlight-grid__info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.highlight-grid__info span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.66rem;
}

.highlight-grid__open {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.highlight-grid__open:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: -3px;
}
.highlight-grid__viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.highlight-grid__viewer video {
  width: 100%;
  max-height: 70vh;
  border-radius: 12px;
  background: #000;
}
.highlight-grid__viewer p {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
