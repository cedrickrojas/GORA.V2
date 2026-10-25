<template>
  <ion-page>
    <SubPageHeader title="Settings" />

    <ion-content :fullscreen="true">
      <p v-if="auth.currentUser" class="settings-account">
        Signed in as <strong>@{{ auth.currentUser.username }}</strong>
        <span>{{ auth.currentUser.email }}</span>
      </p>

      <ion-list inset>
        <ion-item router-link="/profile/edit" :detail="true">
          <ion-icon slot="start" :icon="personOutline" aria-hidden="true" />
          <ion-label>Edit Profile</ion-label>
        </ion-item>
        <ion-item router-link="/profile/clubs/new" :detail="true">
          <ion-icon slot="start" :icon="addCircleOutline" aria-hidden="true" />
          <ion-label>
            Create Club
            <p>Start a community for your sport and city</p>
          </ion-label>
        </ion-item>
        <ion-item v-for="item in SETTINGS_ITEMS" :key="item.label" button :detail="true" @click="showLaterPhaseNotice(item.label)">
          <ion-icon slot="start" :icon="item.icon" aria-hidden="true" />
          <ion-label>{{ item.label }}</ion-label>
        </ion-item>
        <ion-item button :detail="false" :disabled="isLoggingOut" class="settings-logout" @click="logOut">
          <ion-icon slot="start" :icon="logOutOutline" aria-hidden="true" />
          <ion-label>{{ isLoggingOut ? 'Logging out...' : 'Log Out' }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonPage } from '@ionic/vue';
import {
  addCircleOutline,
  helpCircleOutline,
  locationOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  personOutline,
} from 'ionicons/icons';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import { showLaterPhaseNotice } from '@/utils/notice';

const SETTINGS_ITEMS = [
  { label: 'Notification Settings', icon: notificationsOutline },
  { label: 'Privacy', icon: lockClosedOutline },
  { label: 'Location & Distance', icon: locationOutline },
  { label: 'Help', icon: helpCircleOutline },
] as const;

const auth = useAuthStore();
const router = useRouter();
const isLoggingOut = ref(false);

async function logOut(): Promise<void> {
  isLoggingOut.value = true;

  try {
    await auth.logout();
    await router.replace('/login');
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<style scoped>
.settings-account {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 16px 20px 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.settings-account strong {
  color: var(--ion-text-color);
}

.settings-account span {
  font-size: 0.78rem;
}

.settings-logout {
  --color: #ef5b5b;
}

.settings-logout ion-icon {
  color: #ef5b5b;
}
</style>
