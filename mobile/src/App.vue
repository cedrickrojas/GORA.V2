<template>
  <ion-app>
    <div v-if="offline" class="offline-banner" role="status" aria-live="polite">
      <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
      <span>No internet connection</span>
    </div>
    <ion-router-outlet :swipe-gesture="true" />
  </ion-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { IonApp, IonIcon, IonRouterOutlet } from '@ionic/vue';
import { cloudOfflineOutline } from 'ionicons/icons';
import { installFilipinoLocalization } from '@/i18n';
import { installKeyboardViewport } from '@/utils/keyboard-viewport';

let stopKeyboardViewport: (() => void) | undefined;
let stopLocalization: (() => void) | undefined;
const offline = ref(!navigator.onLine);
function updateConnection(): void {
  offline.value = !navigator.onLine;
}
onMounted(() => {
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  stopKeyboardViewport = installKeyboardViewport();
  stopLocalization = installFilipinoLocalization(document.body);
});
onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnection);
  window.removeEventListener('offline', updateConnection);
  stopKeyboardViewport?.();
  stopLocalization?.();
});
</script>

<style>
.offline-banner {
  position: fixed;
  z-index: 10000;
  top: env(safe-area-inset-top, 0px);
  right: 0;
  left: 0;
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: #8e2635;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  box-shadow: 0 2px 12px rgb(0 0 0 / 24%);
}

.offline-banner ion-icon {
  font-size: 18px;
}
</style>
