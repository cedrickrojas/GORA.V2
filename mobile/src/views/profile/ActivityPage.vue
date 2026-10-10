<template>
  <ion-page>
    <SubPageHeader title="Activity" />

    <ion-content :fullscreen="true">
      <div v-if="activityStats" class="activity">
        <ActivityStatsGrid :stats="activityStats" />
        <p class="activity__note">
          Game stats update after a game you were accepted into is marked completed. Badges are checked at the same time.
        </p>

        <section class="activity__section">
          <SectionHeader title="Next badges" />
          <div class="activity__progress">
            <AchievementProgress
              v-for="badge in nextBadges"
              :key="badge.id"
              :current="badge.progress"
              :target="badge.target"
              :label="badge.name"
            />
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { IonContent, IonPage } from '@ionic/vue';
import AchievementProgress from '@/components/achievements/AchievementProgress.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import ActivityStatsGrid from '@/components/profile/ActivityStatsGrid.vue';
import { useProfileStore } from '@/stores/profile';
import { isBadgeUnlocked, sortBadgesForShowcase } from '@/utils/badges';

const NEXT_BADGE_COUNT = 3;

const profileStore = useProfileStore();
const { activityStats, badges } = storeToRefs(profileStore);

const nextBadges = computed(() =>
  sortBadgesForShowcase(badges.value)
    .filter((badge) => !isBadgeUnlocked(badge))
    .slice(0, NEXT_BADGE_COUNT),
);

onMounted(() => {
  void profileStore.load();
});
</script>

<style scoped>
.activity {
  padding: 16px 16px 32px;
}

.activity__note {
  margin: 14px 0 0;
  color: #7d8a93;
  font-size: 0.78rem;
  line-height: 1.4;
}

.activity__section {
  margin-top: 28px;
}

.activity__progress {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--gora-surface);
}
</style>
