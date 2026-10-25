<template>
  <div class="story-avatar">
    <button
      type="button"
      class="story-avatar__ring"
      :class="{ 'story-avatar__ring--empty': lifetimeLeft === null }"
      :style="ringStyle"
      :aria-label="ariaLabel"
      @click="emit('select')"
    >
      <span class="story-avatar__inner">
        <UserAvatar :user="user" :size="60" />
      </span>
    </button>

    <button
      v-if="showAdd"
      type="button"
      class="story-avatar__add"
      aria-label="Add story"
      @click="emit('add')"
    >
      <ion-icon :icon="add" aria-hidden="true" />
    </button>

    <span class="story-avatar__label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { add } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import type { UserSummary } from '@/types/user';
import { getStoryRingBackground } from '@/utils/stories';

const props = withDefaults(
  defineProps<{
    user: UserSummary;
    label: string;
    /** Share of the 24-hour lifetime remaining, from 0 to 1. Null when there is no story. */
    lifetimeLeft: number | null;
    showAdd?: boolean;
  }>(),
  { showAdd: false },
);

const emit = defineEmits<{ select: []; add: [] }>();

const ringStyle = computed(() =>
  props.lifetimeLeft === null ? {} : { background: getStoryRingBackground(props.lifetimeLeft) },
);

const ariaLabel = computed(() =>
  props.lifetimeLeft === null ? `${props.label}, add a story` : `View story from ${props.label}`,
);
</script>

<style scoped>
.story-avatar {
  position: relative;
  display: flex;
  width: 76px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.story-avatar__ring {
  display: flex;
  width: 72px;
  height: 72px;
  align-items: center;
  justify-content: center;
  padding: 3px;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.story-avatar__ring--empty {
  background: transparent;
  outline: 1.5px dashed var(--gora-line-strong);
  outline-offset: -2px;
}

.story-avatar__inner {
  display: flex;
  padding: 3px;
  border-radius: 50%;
  background: var(--ion-background-color);
}

.story-avatar__add {
  position: absolute;
  top: 50px;
  right: 4px;
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 3px solid var(--ion-background-color);
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 15px;
  cursor: pointer;
}

.story-avatar__label {
  overflow: hidden;
  max-width: 100%;
  color: var(--ion-text-color);
  font-size: 0.75rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
