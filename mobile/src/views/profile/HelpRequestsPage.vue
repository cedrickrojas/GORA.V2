<template>
  <ion-page>
    <SubPageHeader title="My Help Requests" back-href="/profile/settings" />
    <ion-content :fullscreen="true">
      <div v-if="error" class="help-requests__feedback" role="alert">
        <p>{{ error }}</p>
        <ion-button fill="clear" :disabled="isLoading" @click="load">Try again</ion-button>
      </div>
      <div v-else-if="isLoading && !hasLoaded" class="help-requests__empty" role="status">
        <ion-spinner />
        <p>Loading your requests…</p>
      </div>
      <div v-else-if="items.length === 0" class="help-requests__empty">
        <ion-icon :icon="helpCircleOutline" aria-hidden="true" />
        <strong>No help requests yet</strong>
        <span>Messages you send to the admin team will appear here.</span>
        <ion-button router-link="/profile/settings">Contact Help</ion-button>
      </div>
      <ul v-else class="help-requests">
        <li v-for="item in items" :key="item.id" class="help-request">
          <header>
            <span class="help-request__status" :class="`help-request__status--${item.status.toLowerCase()}`">
              {{ statusLabel(item.status) }}
            </span>
            <time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time>
          </header>
          <p>{{ item.description }}</p>
          <small v-if="item.resolvedAt">Reviewed {{ formatDate(item.resolvedAt) }}</small>
          <small v-else-if="item.status === 'PENDING'">The admin team has not reviewed this request yet.</small>
          <small v-else>The admin team is reviewing your request.</small>
        </li>
      </ul>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonButton, IonContent, IonIcon, IonPage, IonSpinner, onIonViewWillEnter } from '@ionic/vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { getMyHelpRequests } from '@/services/profile-api.service';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { captureSession, createAuthorizedCall } from '@/stores/authorized';
import type { HelpRequestItem, HelpRequestStatus } from '@/types/help-request';
import { describeApiError } from '@/utils/api-errors';
import { helpCircleOutline } from 'ionicons/icons';

const auth = useAuthStore();
const notifications = useNotificationsStore();
const items = ref<HelpRequestItem[]>([]);
const isLoading = ref(false);
const hasLoaded = ref(false);
const error = ref('');

async function load(): Promise<void> {
  if (isLoading.value) return;
  const isCurrent = captureSession(auth);
  isLoading.value = true;
  error.value = '';
  try {
    const response = await createAuthorizedCall(auth)((token) => getMyHelpRequests(token));
    if (!isCurrent()) return;
    items.value = response.items;
    hasLoaded.value = true;
    await notifications.markHelpRequestsRead();
  } catch (caught) {
    if (isCurrent()) error.value = describeApiError(caught, 'Could not load your help requests.');
  } finally {
    if (isCurrent()) isLoading.value = false;
  }
}

function statusLabel(status: HelpRequestStatus): string {
  return ({ PENDING: 'Sent', REVIEWING: 'Under review', RESOLVED: 'Reviewed', DISMISSED: 'Closed' })[status];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

onMounted(() => void load());
onIonViewWillEnter(() => void load());
</script>

<style scoped>
.help-requests {
  display: grid;
  max-width: 760px;
  gap: 12px;
  margin: 0 auto;
  padding: 16px;
  list-style: none;
}

.help-request {
  padding: 16px;
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
}

.help-request header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.help-request time,
.help-request small {
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.help-request p {
  margin: 14px 0 10px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.help-request__status {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.help-request__status--resolved {
  background: rgba(212, 175, 55, 0.15);
  color: #d4af37;
}

.help-request__status--dismissed {
  background: rgba(239, 91, 91, 0.12);
  color: #ef5b5b;
}

.help-requests__empty,
.help-requests__feedback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 56px 20px;
  color: var(--gora-muted);
  text-align: center;
}

.help-requests__empty ion-icon {
  font-size: 34px;
}

.help-requests__empty strong {
  color: var(--ion-text-color);
}

.help-requests__feedback {
  color: #ef5b5b;
}
</style>
