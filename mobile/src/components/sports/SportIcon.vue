<template>
  <span
    class="sport-icon"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 2)}px`, background: visual.gradient }"
    aria-hidden="true"
  >
    <img v-if="iconUrl && !imageFailed" :src="iconUrl" alt="" class="sport-icon__image" @error="imageFailed = true" />
    <ion-icon v-else :icon="visual.icon" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { getSportVisual } from '@/utils/sports';

/** Sport.iconUrl when the server has one; until then, the built-in icon for the sport's name. */
const props = withDefaults(defineProps<{ name: string; iconUrl?: string | null; size?: number }>(), {
  iconUrl: null,
  size: 40,
});

const imageFailed = ref(false);
const visual = computed(() => getSportVisual(props.name));

watch(
  () => props.iconUrl,
  () => {
    imageFailed.value = false;
  },
);
</script>

<style scoped>
.sport-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-control);
  color: var(--ion-color-primary);
}

.sport-icon__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
