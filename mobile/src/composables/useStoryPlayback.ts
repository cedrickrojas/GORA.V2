import { computed, onUnmounted, ref, type Ref } from 'vue';
import type { StoryGroup } from '@/types/story';

export const STORY_DISPLAY_MS = 5000;

export function useStoryPlayback(groups: Ref<readonly StoryGroup[]>, onFinish: () => void) {
  const groupIndex = ref(0);
  const storyIndex = ref(0);
  const progress = ref(0);

  let frame: number | undefined;
  let segmentStartedAt = 0;
  let isRunning = false;

  const currentGroup = computed(() => groups.value[groupIndex.value] ?? null);
  const currentStory = computed(() => currentGroup.value?.stories[storyIndex.value] ?? null);

  function restartSegment(): void {
    segmentStartedAt = performance.now();
    progress.value = 0;
  }

  function tick(time: number): void {
    const elapsed = (time - segmentStartedAt) / STORY_DISPLAY_MS;

    if (elapsed >= 1) {
      next();
    } else {
      progress.value = Math.max(0, elapsed);
    }

    if (isRunning) {
      frame = requestAnimationFrame(tick);
    }
  }

  function start(startGroupIndex: number): void {
    stop();
    groupIndex.value = startGroupIndex;
    storyIndex.value = 0;
    restartSegment();
    isRunning = true;
    frame = requestAnimationFrame(tick);
  }

  function stop(): void {
    isRunning = false;

    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  }

  /** Holds the current story where it is (while a menu or editor is open). */
  function pause(): void {
    stop();
  }

  function resume(): void {
    if (isRunning || !currentStory.value) {
      return;
    }

    segmentStartedAt = performance.now() - progress.value * STORY_DISPLAY_MS;
    isRunning = true;
    frame = requestAnimationFrame(tick);
  }

  function finish(): void {
    stop();
    onFinish();
  }

  function next(): void {
    const group = currentGroup.value;

    if (!group) {
      finish();
      return;
    }

    if (storyIndex.value < group.stories.length - 1) {
      storyIndex.value += 1;
    } else if (groupIndex.value < groups.value.length - 1) {
      groupIndex.value += 1;
      storyIndex.value = 0;
    } else {
      finish();
      return;
    }

    restartSegment();
  }

  function previous(): void {
    if (storyIndex.value > 0) {
      storyIndex.value -= 1;
    } else if (groupIndex.value > 0) {
      groupIndex.value -= 1;
      storyIndex.value = Math.max(0, (currentGroup.value?.stories.length ?? 1) - 1);
    }

    restartSegment();
  }

  function getSegmentFill(index: number): number {
    if (index < storyIndex.value) {
      return 1;
    }

    return index === storyIndex.value ? progress.value : 0;
  }

  onUnmounted(stop);

  return { currentGroup, currentStory, start, stop, pause, resume, next, previous, getSegmentFill };
}
