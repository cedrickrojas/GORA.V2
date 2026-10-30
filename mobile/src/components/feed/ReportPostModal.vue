<template>
  <ion-modal :is-open="!!post" :can-dismiss="canDismiss" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Report post</ion-title>
        <ion-buttons slot="end"><ion-button :disabled="busy" @click="emit('close')">Cancel</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <form class="report-post" @submit.prevent="submit">
        <p>Reports are private. The post author will not see who reported it.</p>
        <label>
          Reason
          <select v-model="reason">
            <option v-for="option in REPORT_REASONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>Details (optional)<textarea v-model="description" rows="4" maxlength="1000" /></label>
        <p v-if="error" class="report-post__error" role="alert">{{ error }}</p>
        <ion-button type="submit" expand="block" :disabled="busy">{{
          busy ? 'Submitting…' : 'Submit report'
        }}</ion-button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue';
import { reportPost } from '@/services/posts-api.service';
import type { FeedPost } from '@/types/post';
import { useAuthStore } from '@/stores/auth';
import { captureSession, createAuthorizedCall } from '@/stores/authorized';
import { describeApiError } from '@/utils/api-errors';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ post: FeedPost | null }>();
const emit = defineEmits<{ close: [] }>();
const auth = useAuthStore();
const busy = ref(false);
const error = ref<string | null>(null);
const reason = ref('SPAM');
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
  () => props.post,
  () => {
    error.value = null;
    reason.value = 'SPAM';
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
  const post = props.post;
  if (!post || busy.value) return;
  const isCurrent = captureSession(auth);
  busy.value = true;
  error.value = null;
  try {
    await createAuthorizedCall(auth)((token) => reportPost(token, post.id, reason.value, description.value.trim()));
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
.report-post {
  max-width: 680px;
  margin: auto;
  padding: 20px 16px;
}
.report-post > p:first-child {
  color: var(--gora-muted);
  line-height: 1.5;
}
.report-post label {
  display: grid;
  gap: 8px;
  margin: 16px 0;
  font-weight: 650;
}
.report-post select,
.report-post textarea {
  width: 100%;
  border: 1px solid var(--gora-line);
  border-radius: 10px;
  padding: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
}
.report-post__error {
  color: #ff8585;
}
</style>
