<template>
  <div class="achievement-progress" :class="{ 'achievement-progress--complete': isComplete }">
    <div class="achievement-progress__row">
      <span class="achievement-progress__label">{{ label }}</span>
      <span class="achievement-progress__count">{{ current }} / {{ target }}</span>
    </div>
    <div
      class="achievement-progress__track"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      :aria-valuemax="target"
      :aria-valuenow="Math.min(current, target)"
    >
      <span class="achievement-progress__fill" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getProgressPercent } from '@/utils/progress';

const props = defineProps<{
  current: number;
  target: number;
  label: string;
}>();

const percent = computed(() => getProgressPercent(props.current, props.target));
const isComplete = computed(() => props.current >= props.target);
</script>

<style scoped>
.achievement-progress__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}

.achievement-progress__label {
  color: var(--gora-muted);
}

.achievement-progress__count {
  color: var(--ion-text-color);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.achievement-progress__track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--gora-line);
}

.achievement-progress__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--ion-color-primary) 70%, #5c7a22);
  transition: width 0.4s ease;
}

.achievement-progress--complete .achievement-progress__fill {
  background: var(--ion-color-primary);
}
</style>
