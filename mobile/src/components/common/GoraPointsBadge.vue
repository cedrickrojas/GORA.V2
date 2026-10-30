<template>
  <span class="gora-points-badge" :aria-label="`${points} GORA points`" :title="`${points} GORA points`">
    <svg class="gora-points-badge__torch" viewBox="0 0 24 28" aria-hidden="true">
      <path d="M12 1C8 6 4.5 9.5 5 15c.25 2.8 1.8 4.8 3.8 5.8-.5-3.2 1-5.2 3.2-7.2.3 3.7 3 5.2 3.1 8.3 2.7-1.5 4.4-4 4.4-7.4C19.5 9 15.7 5 12 1Z" fill="#ff6a00" />
      <path d="M12.1 10c-2.2 2.8-3.5 4.8-2.8 7 .3 1.1 1 1.8 2 2.3-.1-1.8.7-2.8 1.8-3.8.3 1.7 1.5 2.6 1.9 3.8 1-1 1.4-2.3 1.1-3.7-.4-2.2-2.1-3.8-4-5.6Z" fill="#ffd05a" />
      <path d="M7 22h10l-1 2H8l-1-2Zm2 3h6l.6 2H8.4l.6-2Z" fill="#bd5a12" />
    </svg>
    <span class="gora-points-badge__value">{{ points }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ points: number }>();
</script>

<style scoped>
.gora-points-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  padding: 2px 6px 2px 4px;
  border: 1px solid rgba(255, 138, 40, .48);
  border-radius: 999px;
  background: linear-gradient(120deg, #fff4e8, #fffaf4);
  color: #a84700;
  font-size: .66rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.gora-points-badge__torch {
  display: block;
  width: 13px;
  height: 16px;
}
</style>
