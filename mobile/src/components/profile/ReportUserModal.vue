<template>
  <ion-modal :is-open="!!user" :can-dismiss="canDismiss" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Report user</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="busy" @click="emit('close')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <form class="report-user" @submit.prevent="submit">
        <p>Reports are private. {{ user?.displayName }} will not see who reported them.</p>
        <label>
          Reason
          <select v-model="reason">
            <option v-for="option in REPORT_REASONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          Details (optional)
          <textarea v-model="description" rows="4" maxlength="1000" placeholder="Tell us what happened." />
        </label>
        <p v-if="error" class="report-user__error" role="alert">{{ error }}</p>
        <ion-button type="submit" expand="block" :disabled="busy">
          {{ busy ? 'Submitting…' : 'Submit report' }}
        </ion-button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue';
import type { ProfileIdentity } from '@/types/profile';
import { reportUser } from '@/services/profile-api.service';
import { useAuthStore } from '@/stores/auth';
import { captureSession, createAuthorizedCall } from '@/stores/authorized';
import { describeApiError } from '@/utils/api-errors';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ user: ProfileIdentity | null }>();
const emit = defineEmits<{ close: [] }>();
const auth = useAuthStore();
const busy = ref(false);
const error = ref<string | null>(null);
const reason = ref('HARASSMENT');
const description = ref('');
const canDismiss = async () => !busy.value;
const REPORT_REASONS = [
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'HATE_SPEECH', label: 'Hate speech' },
  { value: 'VIOLENCE', label: 'Violence or threats' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'OTHER', label: 'Other' },
] as const;

watch(
  () => props.user,
  () => {
    error.value = null;
    reason.value = 'HARASSMENT';
    description.value = '';
  },
);

watch(
  () => auth.sessionVersion,
  () => {
    busy.value = false;
    emit('close');
  },
  { flush: 'sync' },
);

async function submit(): Promise<void> {
  const user = props.user;
  if (!user || busy.value) return;
  const isCurrent = captureSession(auth);
  busy.value = true;
  error.value = null;
  try {
    await createAuthorizedCall(auth)((token) =>
      reportUser(token, user.username, reason.value, description.value.trim()),
    );
    if (!isCurrent()) return;
    void showNotice('Report submitted for review.');
    emit('close');
  } catch (caught) {
    if (isCurrent()) error.value = describeApiError(caught, 'Could not submit this report.');
  } finally {
    if (isCurrent()) busy.value = false;
  }
}
</script>

<style scoped>
.report-user {
  max-width: 680px;
  margin: auto;
  padding: 20px 16px;
}
.report-user > p:first-child {
  color: var(--gora-muted);
  line-height: 1.5;
}
.report-user label {
  display: grid;
  gap: 8px;
  margin: 16px 0;
  font-weight: 650;
}
.report-user select,
.report-user textarea {
  width: 100%;
  border: 1px solid var(--gora-line);
  border-radius: 10px;
  padding: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
}
.report-user__error {
  color: #ff8585;
}
</style>
