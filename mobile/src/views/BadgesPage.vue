<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>Badges</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="badges-page">
        <AchievementProgress
          class="badges-page__summary"
          :current="unlockedCount"
          :target="badges.length"
          label="Badges unlocked"
        />

        <section v-for="group in groups" :key="group.category" class="badges-page__group">
          <SectionHeader :title="group.label" />
          <BadgeGrid :badges="group.badges" @select="selectedBadge = $event" />
        </section>
      </div>

      <BadgeDetailModal :badge="selectedBadge" @close="selectedBadge = null" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import AchievementProgress from '@/components/achievements/AchievementProgress.vue';
import BadgeDetailModal from '@/components/achievements/BadgeDetailModal.vue';
import BadgeGrid from '@/components/achievements/BadgeGrid.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import { useProfileStore } from '@/stores/profile';
import type { Badge } from '@/types/achievement';
import { groupBadgesByCategory, isBadgeUnlocked } from '@/utils/badges';

const profileStore = useProfileStore();
const { badges } = storeToRefs(profileStore);

const selectedBadge = ref<Badge | null>(null);

const groups = computed(() => groupBadgesByCategory(badges.value));
const unlockedCount = computed(() => badges.value.filter(isBadgeUnlocked).length);

onMounted(() => {
  void profileStore.load();
});
</script>

<style scoped>
.badges-page {
  padding: 20px 16px 32px;
}

.badges-page__summary {
  padding: 16px;
  border-radius: 16px;
  background: var(--gora-surface);
}

.badges-page__group {
  margin-top: 28px;
}
</style>
