<template>
  <ion-page>
    <SubPageHeader title="My Clubs" />

    <ion-content ref="contentRef" :fullscreen="true">
      <div class="my-clubs">
        <div class="my-clubs__menu" role="tablist" aria-label="My Clubs sections">
          <button
            v-for="(section, index) in sections"
            :id="`my-clubs-tab-${section.id}`"
            :key="section.id"
            type="button"
            role="tab"
            class="my-clubs__menu-item"
            :class="{ 'my-clubs__menu-item--active': activeSection === section.id }"
            :aria-selected="activeSection === section.id"
            :aria-controls="`my-clubs-${section.id}`"
            :tabindex="activeSection === section.id ? 0 : -1"
            @click="selectSection(section.id)"
            @keydown="navigateMenu($event, index)"
          >
            <span>{{ section.title }}</span>
            <span class="my-clubs__menu-count">{{ section.clubs.length }}</span>
          </button>
        </div>
        <section
          :id="`my-clubs-${active.id}`"
          class="my-clubs__section"
          role="tabpanel"
          :aria-labelledby="`my-clubs-tab-${active.id}`"
        >
          <SectionHeader :title="active.title">
            <span class="my-clubs__count">{{ active.clubs.length }}</span>
          </SectionHeader>
          <p v-if="active.clubs.length === 0" class="my-clubs__empty">{{ active.empty }}</p>
          <ul v-else class="my-clubs__list">
            <ClubRow v-for="club in active.clubs" :key="club.id" :club="club" />
          </ul>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import ClubRow from '@/components/clubs/ClubRow.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useClubsStore } from '@/stores/clubs';
import { groupMyClubs } from '@/utils/clubs';

const clubsStore = useClubsStore();
type ClubsSection = 'joined' | 'requested' | 'following';
const activeSection = ref<ClubsSection>('joined');
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

const sections = computed(() => {
  const groups = groupMyClubs(clubsStore.clubs);

  return [
    { id: 'joined' as const, title: 'Your clubs', clubs: groups.joined, empty: 'Clubs you create or join show up here.' },
    { id: 'requested' as const, title: 'Requested', clubs: groups.requested, empty: 'No pending requests to private clubs.' },
    { id: 'following' as const, title: 'Following', clubs: groups.following, empty: 'Follow a club to see its posts without joining.' },
  ];
});
const active = computed(() => sections.value.find((section) => section.id === activeSection.value) ?? sections.value[0]);

function selectSection(section: ClubsSection): void {
  if (activeSection.value === section) return;
  activeSection.value = section;
  void nextTick(() => void contentRef.value?.$el.scrollToTop?.(0));
}

function navigateMenu(event: KeyboardEvent, index: number): void {
  let next: number;
  if (event.key === 'ArrowRight') next = (index + 1) % sections.value.length;
  else if (event.key === 'ArrowLeft') next = (index + sections.value.length - 1) % sections.value.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = sections.value.length - 1;
  else return;
  event.preventDefault();
  selectSection(sections.value[next].id);
  (event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

onIonViewWillEnter(() => {
  void clubsStore.load();
});
</script>

<style scoped>
.my-clubs {
  padding: 12px 16px 32px;
}

.my-clubs__menu {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 4px;
  padding: 4px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}

.my-clubs__menu-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 6px;
  border: 0;
  border-radius: var(--gora-radius-control);
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
}

.my-clubs__menu-item--active {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.my-clubs__menu-count {
  min-width: 18px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  font-size: 0.7rem;
  line-height: 16px;
}

.my-clubs__section {
  margin-top: 18px;
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
