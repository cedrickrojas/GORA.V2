<template>
  <ion-page>
    <SubPageHeader title="Settings" />

    <ion-content :fullscreen="true">
      <p v-if="auth.currentUser" class="settings-account">
        Signed in as <strong>@{{ auth.currentUser.username }}</strong>
        <span>{{ auth.currentUser.email }}</span>
      </p>

      <ion-list inset>
        <ion-item v-if="auth.currentUser?.role === 'SUPER_ADMIN'" router-link="/admin" :detail="true">
          <ion-icon slot="start" :icon="shieldCheckmarkOutline" aria-hidden="true" />
          <ion-label
            >Super Admin Dashboard
            <p>Manage GORA, accounts, and reports</p></ion-label
          >
        </ion-item>
        <ion-item router-link="/profile/saved" :detail="true">
          <ion-icon slot="start" :icon="bookmarkOutline" aria-hidden="true" />
          <ion-label>Saved Posts</ion-label>
        </ion-item>
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
        <ion-item button :detail="true" @click="openHelp">
          <ion-icon slot="start" :icon="helpCircleOutline" aria-hidden="true" />
          <ion-label>
            Help
            <p>Send a message to the GORA admin team</p>
          </ion-label>
        </ion-item>
        <ion-item
          v-for="item in SETTINGS_ITEMS"
          :key="item.label"
          button
          :detail="true"
          @click="openSetting(item.id)"
        >
          <ion-icon slot="start" :icon="item.icon" aria-hidden="true" />
          <ion-label>
            {{ item.label }}
            <p>{{ item.summary }}</p>
          </ion-label>
        </ion-item>
        <ion-item button :detail="false" :disabled="isLoggingOut" class="settings-logout" @click="logOut">
          <ion-icon slot="start" :icon="logOutOutline" aria-hidden="true" />
          <ion-label>{{ isLoggingOut ? 'Logging out...' : 'Log Out' }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-modal :is-open="activeSetting !== null" @did-dismiss="activeSetting = null">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ activeSettingTitle }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="activeSetting = null">Done</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <p v-if="settings.isLoading" class="settings-help">Loading your settings…</p>
        <ion-list v-else inset>
          <template v-if="activeSetting === 'notifications'">
            <ion-item>
              <ion-label>Friend activity<p>Friend requests, accepted requests, and new followers</p></ion-label>
              <ion-toggle slot="end" :checked="settings.values.notifyFriends" :disabled="settings.isSaving" @ionChange="saveSetting({ notifyFriends: $event.detail.checked })" />
            </ion-item>
            <ion-item>
              <ion-label>Game activity<p>Join requests, responses, and game updates</p></ion-label>
              <ion-toggle slot="end" :checked="settings.values.notifyGames" :disabled="settings.isSaving" @ionChange="saveSetting({ notifyGames: $event.detail.checked })" />
            </ion-item>
            <ion-item>
              <ion-label>Messages<p>New messages and message requests</p></ion-label>
              <ion-toggle slot="end" :checked="settings.values.notifyMessages" :disabled="settings.isSaving" @ionChange="saveSetting({ notifyMessages: $event.detail.checked })" />
            </ion-item>
            <ion-item>
              <ion-label>Posts and activity<p>Likes, comments, story replies, lives, and badges</p></ion-label>
              <ion-toggle slot="end" :checked="settings.values.notifyContent" :disabled="settings.isSaving" @ionChange="saveSetting({ notifyContent: $event.detail.checked })" />
            </ion-item>
          </template>
          <template v-else-if="activeSetting === 'privacy'">
            <ion-item>
              <ion-label>Who can view your profile</ion-label>
              <ion-select :value="settings.values.profileVisibility" interface="popover" :disabled="settings.isSaving" @ionChange="saveSetting({ profileVisibility: $event.detail.value })">
                <ion-select-option value="PUBLIC">Everyone</ion-select-option>
                <ion-select-option value="FRIENDS">Friends only</ion-select-option>
              </ion-select>
            </ion-item>
            <p class="settings-description">When set to friends only, people who are not your friends cannot open your profile.</p>
          </template>
          <template v-else-if="activeSetting === 'location'">
            <ion-item>
              <ion-label>Use device location<p>Use your current location to find nearby games. Location is only used for search.</p></ion-label>
              <ion-toggle slot="end" :checked="settings.values.useDeviceLocation" :disabled="settings.isSaving" @ionChange="saveSetting({ useDeviceLocation: $event.detail.checked })" />
            </ion-item>
            <ion-item>
              <ion-label>Default search distance</ion-label>
              <ion-select :value="settings.values.defaultDistanceKm" interface="popover" :disabled="settings.isSaving" @ionChange="saveSetting({ defaultDistanceKm: $event.detail.value })">
                <ion-select-option :value="null">Any distance</ion-select-option>
                <ion-select-option v-for="distance in DISTANCE_OPTIONS" :key="distance" :value="distance">{{ distance }} km</ion-select-option>
              </ion-select>
            </ion-item>
            <p class="settings-description">You can change the distance any time from the games search filters.</p>
          </template>
        </ion-list>
      </ion-content>
    </ion-modal>

    <ion-modal :is-open="isHelpOpen" :can-dismiss="!isSendingHelp" @did-dismiss="isHelpOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Contact Help</ion-title>
          <ion-buttons slot="end">
            <ion-button :disabled="isSendingHelp" @click="isHelpOpen = false">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <form class="settings-help" @submit.prevent="sendHelp">
          <p>Tell us what you need help with. Your message will be sent to the admin inbox.</p>
          <ion-textarea
            v-model="helpMessage"
            label="Your message"
            label-placement="stacked"
            placeholder="Describe the issue or question..."
            :maxlength="2000"
            :disabled="isSendingHelp"
            :auto-grow="true"
            required
          />
          <p v-if="helpError" class="settings-help__error" role="alert">{{ helpError }}</p>
          <ion-button type="submit" expand="block" :disabled="isSendingHelp || !helpMessage.trim()">
            {{ isSendingHelp ? 'Sending...' : 'Send to Admin' }}
          </ion-button>
        </form>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue';
import {
  addCircleOutline,
  bookmarkOutline,
  helpCircleOutline,
  locationOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  personOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import { captureSession, createAuthorizedCall } from '@/stores/authorized';
import { sendHelpRequest } from '@/services/profile-api.service';
import { describeApiError } from '@/utils/api-errors';
import { showNotice } from '@/utils/notice';
import { useSettingsStore } from '@/stores/settings';
import type { UserSettings } from '@/types/user-settings';
import { DISTANCE_FILTERS } from '@/utils/search';
import { useDiscoveryStore } from '@/stores/discovery';
import { useFiltersStore } from '@/stores/filters';

const SETTINGS_ITEMS = [
  { id: 'notifications', label: 'Notification Settings', summary: 'Choose what updates you receive', icon: notificationsOutline },
  { id: 'privacy', label: 'Privacy', summary: 'Control who can view your profile', icon: lockClosedOutline },
  { id: 'location', label: 'Location & Distance', summary: 'Set your nearby games search preferences', icon: locationOutline },
] as const;
const DISTANCE_OPTIONS = DISTANCE_FILTERS.filter((distance): distance is Exclude<typeof distance, null> => distance !== null);

const auth = useAuthStore();
const settings = useSettingsStore();
const discovery = useDiscoveryStore();
const filters = useFiltersStore();
const router = useRouter();
const isLoggingOut = ref(false);
const isHelpOpen = ref(false);
const isSendingHelp = ref(false);
const helpMessage = ref('');
const helpError = ref('');
const activeSetting = ref<(typeof SETTINGS_ITEMS)[number]['id'] | null>(null);
const activeSettingTitle = computed(() => SETTINGS_ITEMS.find((item) => item.id === activeSetting.value)?.label ?? 'Settings');

onMounted(() => { void settings.load().catch(() => showNotice('Could not load your settings. Please try again.')); });

async function openSetting(id: (typeof SETTINGS_ITEMS)[number]['id']): Promise<void> {
  activeSetting.value = id;
  try {
    await settings.load();
  } catch {
    await showNotice('Could not load your settings. Please try again.');
  }
}

async function saveSetting(changes: Partial<UserSettings>): Promise<void> {
  try {
    await settings.update(changes);
    if (changes.defaultDistanceKm !== undefined) filters.maxDistanceKm = changes.defaultDistanceKm;
    if (changes.useDeviceLocation === false) {
      discovery.clearLocation();
      void discovery.fetchNearbyGames();
    }
  } catch {
    await showNotice('Could not save this setting. Please try again.');
    await settings.load(true).catch(() => undefined);
  }
}

function openHelp(): void {
  helpMessage.value = '';
  helpError.value = '';
  isHelpOpen.value = true;
}

async function sendHelp(): Promise<void> {
  const message = helpMessage.value.trim();
  if (!message || isSendingHelp.value) return;
  const isCurrent = captureSession(auth);
  isSendingHelp.value = true;
  helpError.value = '';
  try {
    await createAuthorizedCall(auth)((token) => sendHelpRequest(token, message));
    if (!isCurrent()) return;
    isHelpOpen.value = false;
    void showNotice('Your help message was sent to the admin inbox.');
  } catch (caught) {
    if (isCurrent()) helpError.value = describeApiError(caught, 'Could not send your message.');
  } finally {
    if (isCurrent()) isSendingHelp.value = false;
  }
}

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

.settings-help {
  display: grid;
  gap: 18px;
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 16px;
}

.settings-help > p:first-child {
  margin: 0;
  color: var(--gora-muted);
  line-height: 1.5;
}

.settings-help__error {
  margin: 0;
  color: #ff8585;
}

.settings-description {
  margin: 8px 24px 20px;
  color: var(--gora-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}
</style>
