<template>
  <div class="badge-grid">
    <BadgeTile v-for="badge in badges" :key="badge.id" :badge="badge" @select="emit('select', $event)" />
  </div>
</template>

<script setup lang="ts">
import type { Badge } from '@/types/achievement';
import BadgeTile from './BadgeTile.vue';

defineProps<{ badges: readonly Badge[] }>();
const emit = defineEmits<{ select: [badge: Badge] }>();
</script>

<style scoped>
.badge-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
</style>
