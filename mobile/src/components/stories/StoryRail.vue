<template>
  <section class="story-rail" aria-label="Stories">
    <SectionHeader title="Stories" class="story-rail__header">
      <span class="story-rail__hint">
        <ion-icon :icon="hourglassOutline" aria-hidden="true" />
        Gone in 24h
      </span>
    </SectionHeader>

    <div class="story-rail__track">
      <StoryAvatarButton
        v-if="viewer"
        :user="viewer"
        label="Your Story"
        :lifetime-left="own ? getGroupLifetimeLeft(own, nowMs) : null"
        show-add
        @select="own ? emit('open', own) : emit('add')"
        @add="emit('add')"
      />

      <StoryAvatarButton
        v-for="group in others"
        :key="group.user.id"
        :user="group.user"
        :label="group.user.username"
        :lifetime-left="getGroupLifetimeLeft(group, nowMs)"
        @select="emit('open', group)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { hourglassOutline } from 'ionicons/icons';
import SectionHeader from '@/components/common/SectionHeader.vue';
import type { StoryGroup } from '@/types/story';
import type { UserSummary } from '@/types/user';
import { getGroupLifetimeLeft } from '@/utils/stories';
import StoryAvatarButton from './StoryAvatarButton.vue';

defineProps<{
  viewer: UserSummary | null;
  own: StoryGroup | null;
  others: StoryGroup[];
  nowMs: number;
}>();

const emit = defineEmits<{ open: [group: StoryGroup]; add: [] }>();
</script>

<style scoped>
.story-rail {
  padding: 20px 0 8px;
}

.story-rail__header {
  padding: 0 20px;
}

.story-rail__hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.story-rail__track {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 0 16px 8px;
  scrollbar-width: none;
}

.story-rail__track::-webkit-scrollbar {
  display: none;
}
</style>
