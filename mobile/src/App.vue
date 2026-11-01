<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { installFilipinoLocalization } from '@/i18n';
import { installKeyboardViewport } from '@/utils/keyboard-viewport';

let stopKeyboardViewport: (() => void) | undefined;
let stopLocalization: (() => void) | undefined;
onMounted(() => {
  stopKeyboardViewport = installKeyboardViewport();
  stopLocalization = installFilipinoLocalization(document.body);
});
onBeforeUnmount(() => {
  stopKeyboardViewport?.();
  stopLocalization?.();
});
</script>
