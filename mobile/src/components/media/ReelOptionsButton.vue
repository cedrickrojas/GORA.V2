<template>
  <MediaOptionsButton
    kind="reel"
    :caption="reel.caption"
    :caption-max-length="REEL_CAPTION_MAX_LENGTH"
    :sport="reel.sport"
    :visibility="reel.visibility ?? 'PUBLIC'"
    :custom-viewer-ids="reel.customViewerIds ?? []"
    :save-caption="(caption, sport) => reelsStore.editReel(reel.id, { caption, sport })"
    :save-audience="(visibility, ids) => reelsStore.updateReelVisibility(reel.id, visibility, ids)"
    :remove="() => reelsStore.deleteReel(reel.id)"
    :tone="tone"
  />
</template>

<script setup lang="ts">
import { useReelsStore } from '@/stores/reels';
import type { Reel } from '@/types/reel';
import { REEL_CAPTION_MAX_LENGTH } from '@/utils/media-api';
import MediaOptionsButton from './MediaOptionsButton.vue';

withDefaults(defineProps<{ reel: Reel; tone?: 'dark' | 'overlay' }>(), { tone: 'overlay' });

const reelsStore = useReelsStore();
</script>
