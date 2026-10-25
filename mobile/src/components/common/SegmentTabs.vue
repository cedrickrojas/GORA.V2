<template>
  <div class="segment-tabs" role="tablist">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="tab"
      class="segment-tabs__tab"
      :class="{ 'segment-tabs__tab--active': option.id === modelValue }"
      :aria-selected="option.id === modelValue"
      @click="emit('update:modelValue', option.id)"
    >
      {{ option.label }}
      <span v-if="option.count" class="segment-tabs__count">{{
        option.count
      }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T;
  options: readonly { id: T; label: string; count?: number }[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
</script>

<style scoped>
.segment-tabs {
  display: grid;
  gap: 4px;
  padding: 4px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
}

.segment-tabs__tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 8px;
  border: 0;
  border-radius: var(--gora-radius-control);
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
}

.segment-tabs__tab--active {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.segment-tabs__count {
  min-width: 18px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ef5b5b;
  color: #fff;
  font-size: 0.7rem;
  line-height: 16px;
}
</style>
