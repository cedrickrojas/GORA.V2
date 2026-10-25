<template>
  <aside class="desktop-side desktop-side--start" aria-label="Shortcuts">
    <nav class="desktop-side__navigation" aria-label="Your shortcuts">
      <router-link v-if="currentUser" to="/profile" class="desktop-side__row" :title="currentUser.displayName">
        <UserAvatar :user="currentUser" :size="48" />
        <strong>{{ currentUser.displayName }}</strong>
      </router-link>
      <router-link v-for="link in PROFILE_SECTION_LINKS" :key="link.to" :to="link.to" class="desktop-side__row">
        <span class="desktop-side__icon"><ion-icon :icon="link.icon" aria-hidden="true" /></span>
        <span>{{ link.label }}</span>
      </router-link>
    </nav>

    <template v-if="myClubs.length">
      <div class="desktop-side__divider" />
      <div class="desktop-side__heading">
        <span>Your clubs</span>
        <router-link to="/profile/clubs">See all</router-link>
      </div>
      <router-link
        v-for="club in myClubs"
        :key="club.id"
        :to="`/clubs/${club.id}`"
        class="desktop-side__row"
        :title="club.name"
        :aria-label="club.name"
      >
        <ClubAvatar :club="club" :image-url="club.profileImageUrl" :size="36" />
        <span>{{ club.name }}</span>
      </router-link>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import ClubAvatar from '@/components/clubs/ClubAvatar.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useClubsStore } from '@/stores/clubs';
import { useProfileStore } from '@/stores/profile';
import { useSessionStore } from '@/stores/session';
import { groupMyClubs } from '@/utils/clubs';
import { PROFILE_SECTION_LINKS } from '@/utils/navigation';

const sessionStore = useSessionStore();
const profileStore = useProfileStore();
const clubsStore = useClubsStore();
/** The signed-in account; the demo user only until the account has loaded. */
const currentUser = computed(() => profileStore.account ?? sessionStore.currentUser);

const myClubs = computed(() => {
  const sections = groupMyClubs(clubsStore.clubs);

  return [...sections.joined, ...sections.following].slice(0, 5);
});

onMounted(() => {
  void sessionStore.load();
  void clubsStore.load();
});
</script>
