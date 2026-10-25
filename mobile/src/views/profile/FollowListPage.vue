<template>
  <ion-page>
    <SubPageHeader :title="title" back-href="/profile" />

    <ion-content :fullscreen="true" class="ion-padding">
      <div class="follow-list">
        <ion-spinner v-if="count === null && profileStore.loading" name="crescent" aria-label="Loading" />
        <template v-else>
          <p class="follow-list__count">
            <strong>{{ count ?? 0 }}</strong>
            {{ title.toLowerCase() }}
          </p>
          <p class="follow-list__empty">{{ message }}</p>
          <router-link to="/discover" class="follow-list__link">Find players on Discover</router-link>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonContent, IonPage, IonSpinner } from '@ionic/vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useProfileStore } from '@/stores/profile';

const route = useRoute();
const profileStore = useProfileStore();

/** One route per list; read once because Ionic keeps each page instance cached. */
const kind = route.name === 'following' ? 'following' : 'followers';
const title = kind === 'following' ? 'Following' : 'Followers';

/** The real count from UserFollow rows (GET /profiles/me). */
const count = computed(() => profileStore.currentProfile?.stats[kind] ?? null);

const message = computed(() => {
  if (count.value === 0) {
    return kind === 'following' ? "You don't follow anyone yet." : 'No followers yet.';
  }

  return kind === 'following'
    ? 'The list of accounts you follow arrives with the follow system.'
    : 'The list of your followers arrives with the follow system.';
});

onMounted(() => {
  if (!profileStore.currentProfile) {
    void profileStore.fetchMyProfile();
  }
});
</script>

<style scoped>
.follow-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
}

.follow-list__count {
  margin: 0;
  color: var(--gora-muted);
}

.follow-list__count strong {
  display: block;
  color: var(--ion-text-color);
  font-size: 2rem;
}

.follow-list__empty {
  max-width: 320px;
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.9rem;
}

.follow-list__link {
  margin-top: 8px;
  color: var(--ion-color-primary);
  font-weight: 700;
  text-decoration: none;
}
</style>
