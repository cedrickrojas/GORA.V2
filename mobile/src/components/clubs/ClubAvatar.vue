<template>
  <span class="club-avatar" :style="avatarStyle">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="club.name"
      class="club-avatar__image"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ClubSummary } from '@/types/club';
import { getInitials } from '@/utils/avatar';
import { getSportVisual } from '@/utils/sports';

const props = withDefaults(
  defineProps<{ club: ClubSummary; imageUrl?: string | null; size?: number }>(),
  {
    imageUrl: null,
    size: 48,
  },
);

const initials = computed(() => getInitials(props.club.name));

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${Math.min(10, Math.round(props.size * 0.16))}px`,
  fontSize: `${Math.round(props.size * 0.34)}px`,
  background: getSportVisual(props.club.sport ?? 'Other').gradient,
}));
</script>

<style scoped>
.club-avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.club-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
