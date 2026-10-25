<template>
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="0.6"
    :breakpoints="[0, 0.6, 1]"
    class="join-request-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="join-request-content">
      <form class="join-request" @submit.prevent="send">
        <h2 class="join-request__title">Request to Join</h2>
        <p class="join-request__subtitle">
          {{ hostName }} will see your request for <strong>{{ gameTitle }}</strong> and can accept or decline it.
        </p>

        <label class="join-request__label" for="join-request-message">Message to the host (optional)</label>
        <textarea
          id="join-request-message"
          v-model="message"
          class="join-request__message"
          rows="4"
          :maxlength="JOIN_REQUEST_MESSAGE_MAX_LENGTH"
          placeholder="e.g. I usually play point guard."
        />
        <p class="join-request__count">{{ message.length }}/{{ JOIN_REQUEST_MESSAGE_MAX_LENGTH }}</p>

        <p v-if="error" class="join-request__error" role="alert">{{ error }}</p>

        <div class="join-request__buttons">
          <button type="button" class="join-request__cancel" :disabled="isSubmitting" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="join-request__send" :disabled="isSubmitting">
            {{ isSubmitting ? 'Sending…' : 'Send Request' }}
          </button>
        </div>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonContent, IonModal } from '@ionic/vue';
import { JOIN_REQUEST_MESSAGE_MAX_LENGTH } from '@/utils/join-requests';

const props = defineProps<{
  isOpen: boolean;
  gameTitle: string;
  hostName: string;
  isSubmitting: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ close: []; send: [message: string | null] }>();

const message = ref('');

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      message.value = '';
    }
  },
);

function send(): void {
  if (props.isSubmitting) {
    return;
  }

  emit('send', message.value.trim() || null);
}
</script>

<style scoped>
.join-request-modal {
  --background: var(--gora-surface);
  --border-radius: 24px;
}

.join-request-content {
  --background: var(--gora-surface);
}

.join-request {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom));
}

.join-request__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
}

.join-request__subtitle {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.86rem;
}

.join-request__label {
  margin-top: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}

.join-request__message {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
  font: inherit;
  resize: vertical;
}

.join-request__count {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.72rem;
  text-align: right;
}

.join-request__error {
  margin: 0;
  color: #ff7a7a;
  font-size: 0.82rem;
}

.join-request__buttons {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.join-request__cancel,
.join-request__send {
  flex: 1;
  padding: 13px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.join-request__cancel {
  border: 1px solid var(--gora-line-strong);
  background: transparent;
  color: var(--ion-text-color);
}

.join-request__send {
  border: 0;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.join-request__cancel:disabled,
.join-request__send:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
