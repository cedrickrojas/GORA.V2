<template>
  <ion-page>
    <SubPageHeader title="Live broadcasts" back-href="/reels" />
    <ion-content><LiveRail :active="active" show-empty /></ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage, onIonViewWillEnter, onIonViewDidLeave } from '@ionic/vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import LiveRail from '@/components/live/LiveRail.vue';
const active = ref(true);
onIonViewWillEnter(() => {
  active.value = true;
});
onIonViewDidLeave(() => {
  active.value = false;
});
</script>
