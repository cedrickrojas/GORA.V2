<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { installKeyboardViewport } from '@/utils/keyboard-viewport';

let stopKeyboardViewport: (() => void) | undefined;
onMounted(() => {
  stopKeyboardViewport = installKeyboardViewport();
});
onBeforeUnmount(() => {
  stopKeyboardViewport?.();
});
</script>
