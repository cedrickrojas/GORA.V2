<template>
  <div class="audience">
    <div class="audience__options" role="radiogroup" aria-label="Who can see this post">
      <button
        v-for="option in POST_PRIVACY_OPTIONS"
        :key="option.id"
        type="button"
        role="radio"
        class="audience__option"
        :class="{ 'audience__option--active': option.id === visibility }"
        :aria-checked="option.id === visibility"
        @click="visibility = option.id"
      >
        <span class="audience__emoji" aria-hidden="true">{{ option.emoji }}</span>
        <span class="audience__label">{{ option.label }}</span>
      </button>
    </div>
    <p class="audience__hint">{{ getPrivacyOption(visibility).description }}</p>

    <PeoplePicker
      v-if="visibility === 'CUSTOM'"
      v-model="customViewerIds"
      class="audience__custom"
      title="Choose who can see it"
      :max="CUSTOM_VIEWERS_MAX"
    />
  </div>
</template>

<script setup lang="ts">
import type { PostVisibility } from '@/types/post';
import { CUSTOM_VIEWERS_MAX, POST_PRIVACY_OPTIONS, getPrivacyOption } from '@/utils/post-privacy';
import PeoplePicker from './PeoplePicker.vue';

const visibility = defineModel<PostVisibility>('visibility', { required: true });
const customViewerIds = defineModel<string[]>('customViewerIds', { required: true });
</script>

<style scoped>
.audience {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audience__options {
  display: grid;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: var(--gora-surface);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.audience__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 4px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 600;
}

.audience__option--active {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.audience__emoji {
  font-size: 1rem;
  line-height: 1.2;
}

.audience__hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.audience__custom {
  margin-top: 4px;
}
</style>
