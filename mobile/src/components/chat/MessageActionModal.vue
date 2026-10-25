<template>
  <div class="message-action-host">
    <ion-modal :is-open="!!message" :can-dismiss="canDismiss" @did-dismiss="emit('close')">
      <ion-header
        ><ion-toolbar
          ><ion-title>{{ mode === 'forward' ? 'Forward message' : 'Report message' }}</ion-title
          ><ion-buttons slot="end"
            ><ion-button :disabled="busy" @click="emit('close')">Cancel</ion-button></ion-buttons
          ></ion-toolbar
        ></ion-header
      >
      <ion-content>
        <div class="message-action-editor">
          <template v-if="mode === 'forward'">
            <label
              >Find a friend or chat<input v-model="search" type="search" placeholder="Search by name"
            /></label>
            <p v-if="!people.length">No matching friends or chats.</p>
            <button
              v-for="person in people"
              :key="person.id"
              type="button"
              class="forward-person"
              :disabled="busy"
              @click="forward(person)"
            >
              <UserAvatar :user="person" :size="36" />{{ person.displayName }}<span>Forward</span>
            </button>
          </template>
          <form v-else @submit.prevent="report">
            <p>Reports are private. The other person will not see who reported them.</p>
            <label
              >Reason<select v-model="reason">
                <option v-for="option in reasons" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select></label
            >
            <label>Details (optional)<textarea v-model="description" rows="4" maxlength="1000" /></label>
            <ion-button type="submit" :disabled="busy">{{
              busy ? 'Submitting…' : 'Submit report'
            }}</ion-button>
          </form>
          <p v-if="error" role="alert">{{ error }}</p>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useChatStore } from '@/stores/chat';
import { useFriendsStore } from '@/stores/friends';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import { showNotice } from '@/utils/notice';
import type { ChatMessage } from '@/types/chat';
import type { UserSummary } from '@/types/user';
const props = defineProps<{
  message: ChatMessage | null;
  mode: 'forward' | 'report';
}>();
const emit = defineEmits<{ close: [] }>();
const chat = useChatStore();
const friends = useFriendsStore();
const auth = useAuthStore();
const busy = ref(false);
const canDismiss = async () => !busy.value;
const error = ref<string | null>(null);
const search = ref('');
const reason = ref('HARASSMENT');
const description = ref('');
const reasons = [
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'HATE_SPEECH', label: 'Hate speech' },
  { value: 'VIOLENCE', label: 'Violence or threats' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'OTHER', label: 'Other' },
];
const people = computed(() =>
  [
    ...new Map(
      [...chat.sortedConversations.map((c) => c.partner), ...friends.friends].map((p) => [p.id, p]),
    ).values(),
  ].filter((p) => `${p.displayName} ${p.username}`.toLowerCase().includes(search.value.trim().toLowerCase())),
);
watch(
  () => props.message,
  (message) => {
    error.value = null;
    search.value = '';
    description.value = '';
    if (message) {
      void chat.refresh();
      void friends.load();
    }
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
async function forward(person: UserSummary) {
  const message = props.message;
  if (!message || busy.value) return;
  const isCurrent = captureSession(auth);
  busy.value = true;
  error.value = null;
  try {
    const destination = chat.findDirectWith(person.id)?.id ?? (await chat.openDirect(person, Date.now()));
    if (!isCurrent()) return;
    if (!destination) {
      error.value = chat.error ?? 'Could not open this chat.';
      return;
    }
    const result = await chat.forwardMessage(message.conversationId, message.id, destination);
    if (!isCurrent()) return;
    error.value = result;
    if (!error.value) {
      busy.value = false;
      void showNotice(`Forwarded to ${person.displayName}.`);
      emit('close');
    }
  } finally {
    if (isCurrent()) busy.value = false;
  }
}
async function report() {
  const message = props.message;
  if (!message || busy.value) return;
  const isCurrent = captureSession(auth);
  busy.value = true;
  error.value = null;
  try {
    const result = await chat.reportMessage(
      message.conversationId,
      message.id,
      reason.value,
      description.value.trim(),
    );
    if (!isCurrent()) return;
    error.value = result;
    if (!error.value) {
      busy.value = false;
      void showNotice('Report submitted for review.');
      emit('close');
    }
  } finally {
    if (isCurrent()) busy.value = false;
  }
}
</script>
<style scoped>
.message-action-editor {
  max-width: 680px;
  margin: auto;
  padding: 20px 16px;
}
.message-action-editor label {
  display: grid;
  gap: 8px;
  margin: 16px 0;
}
.message-action-editor input,
.message-action-editor select,
.message-action-editor textarea {
  width: 100%;
  border: 1px solid var(--gora-line);
  border-radius: 10px;
  padding: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
}
.message-action-editor [role='alert'] {
  color: #ff8585;
}
.forward-person {
  display: flex;
  width: 100%;
  gap: 12px;
  align-items: center;
  margin: 8px 0;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  text-align: left;
}
.forward-person span {
  margin-left: auto;
  color: var(--ion-color-primary);
  font-size: 0.8rem;
}
</style>
