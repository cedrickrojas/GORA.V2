<template>
  <ion-page>
    <SubPageHeader title="My Clubs" />

    <ion-content :fullscreen="true">
      <div class="my-clubs">
        <section v-for="section in sections" :key="section.title" class="my-clubs__section">
          <SectionHeader :title="section.title">
            <span class="my-clubs__count">{{ section.clubs.length }}</span>
          </SectionHeader>
          <p v-if="section.clubs.length === 0" class="my-clubs__empty">{{ section.empty }}</p>
          <ul v-else class="my-clubs__list">
            <ClubRow v-for="club in section.clubs" :key="club.id" :club="club" />
          </ul>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useClubsStore } from '@/stores/clubs';
import { groupMyClubs } from '@/utils/clubs';

const clubsStore = useClubsStore();

const sections = computed(() => {
  const groups = groupMyClubs(clubsStore.clubs);

  return [
    { title: 'Your clubs', clubs: groups.joined, empty: 'Clubs you create or join show up here.' },
    { title: 'Requested', clubs: groups.requested, empty: 'No pending requests to private clubs.' },
    { title: 'Following', clubs: groups.following, empty: 'Follow a club to see its posts without joining.' },
  ];
});

onIonViewWillEnter(() => {
  void clubsStore.load();
});
</script>

<style scoped>
.my-clubs {
  padding: 12px 16px 32px;
}

.my-clubs__section {
  margin-top: 24px;
}

.my-clubs__section:first-child {
  margin-top: 4px;
}

.my-clubs__count {
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.my-clubs__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
}

.my-clubs__empty {
  margin: 0;
  color: #7d8a93;
  font-size: 0.85rem;
}
</style>
