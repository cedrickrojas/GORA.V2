<template>
  <ion-page>
    <SubPageHeader title="My Reels" />

    <ion-content :fullscreen="true">
      <div class="my-reels">
        <div class="my-reels__top">
          <span class="my-reels__count">{{ highlights.length }} {{ highlights.length === 1 ? 'reel' : 'reels' }}</span>
          <router-link to="/create/reel" class="my-reels__add">+ Upload Reel</router-link>
        </div>
        <p v-if="reelsStore.serverError" class="my-reels__empty" role="alert">{{ reelsStore.serverError }}</p>
        <p v-else-if="highlights.length === 0" class="my-reels__empty">
          No reels yet. Upload one and it shows here and in your Highlights.
        </p>
        <HighlightGrid v-else :highlights="highlights" :editable-reels="reelsStore.myReels" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { IonContent, IonPage } from '@ionic/vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import HighlightGrid from '@/components/profile/HighlightGrid.vue';
import { useProfileStore } from '@/stores/profile';
import { useReelsStore } from '@/stores/reels';
import { toHighlight } from '@/utils/media-api';

const profileStore = useProfileStore();
const reelsStore = useReelsStore();

/** Your own reels, newest first (the demo highlights only when nobody is signed in). */
const highlights = computed(() =>
  reelsStore.savesToServer ? reelsStore.myReels.map(toHighlight) : (profileStore.profile?.highlights ?? []),
);

onMounted(() => {
  void profileStore.load();
  void reelsStore.load();
});
</script>

<style scoped>
.my-reels {
  padding: 16px;
}

.my-reels__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.my-reels__count {
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.my-reels__add {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}

.my-reels__empty {
  margin: 0;
  color: #7d8a93;
  font-size: 0.85rem;
}
</style>
