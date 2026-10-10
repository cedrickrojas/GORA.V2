<template>
  <MediaOptionsButton
    kind="story"
    :caption="story.media.caption"
    :caption-max-length="STORY_CAPTION_MAX_LENGTH"
    :visibility="story.visibility ?? 'PUBLIC'"
    :custom-viewer-ids="story.customViewerIds ?? []"
    :save-caption="(caption) => storiesStore.editStory(story.id, caption)"
    :save-audience="(visibility, ids) => storiesStore.updateStoryVisibility(story.id, visibility, ids)"
    :remove="() => storiesStore.deleteStory(story.id)"
    :tone="tone"
    @busy="emit('busy', $event)"
    @deleted="emit('deleted')"
  />
</template>

<script setup lang="ts">
import { useStoriesStore } from '@/stores/stories';
import type { Story } from '@/types/story';
import { STORY_CAPTION_MAX_LENGTH } from '@/utils/media-api';
import MediaOptionsButton from './MediaOptionsButton.vue';

withDefaults(defineProps<{ story: Story; tone?: 'dark' | 'overlay' }>(), { tone: 'dark' });
const emit = defineEmits<{ busy: [isBusy: boolean]; deleted: [] }>();

const storiesStore = useStoriesStore();
</script>
