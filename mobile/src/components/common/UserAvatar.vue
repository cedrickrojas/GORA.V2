<template>
  <span class="avatar" :style="avatarStyle">
    <img
      v-if="user.avatarUrl && failedUrl !== user.avatarUrl"
      :src="user.avatarUrl"
      :alt="user.displayName"
      class="avatar__image"
      @error="failedUrl = user.avatarUrl"
    />
    <span v-else class="avatar__initials" aria-hidden="true">{{
      initials
    }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { UserSummary } from '@/types/user';
import { getAvatarTint, getInitials } from '@/utils/avatar';

const props = withDefaults(
  defineProps<{ user: UserSummary; size?: number }>(),
  {
    size: 56,
  },
);

/** A photo link that failed to load falls back to initials instead of a broken image. */
const failedUrl = ref<string | null>(null);
const initials = computed(() => getInitials(props.user.displayName));

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.36)}px`,
  '--avatar-tint': getAvatarTint(props.user.id),
}));
</script>

<style scoped>
.avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  border: 1px solid var(--gora-line);
  background: color-mix(in srgb, var(--avatar-tint) 30%, var(--gora-surface));
}

.avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar__initials {
  color: var(--ion-text-color);
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
