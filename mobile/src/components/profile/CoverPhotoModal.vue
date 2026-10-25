<template>
  <ion-modal :is-open="isOpen" :can-dismiss="!profile.saving" @did-dismiss="emit('close')">
    <ion-header
      ><ion-toolbar
        ><ion-title>Cover photo</ion-title
        ><ion-buttons slot="end"
          ><ion-button :disabled="profile.saving" @click="emit('close')">Close</ion-button></ion-buttons
        ></ion-toolbar
      ></ion-header
    >
    <ion-content>
      <div class="cover-editor" :aria-busy="profile.saving">
        <div class="cover-editor__preview">
          <img v-if="preview || currentUrl" :src="preview || currentUrl || undefined" alt="Cover photo preview" />
          <p v-else>Choose a photo for the top of your profile.</p>
        </div>
        <p class="cover-editor__hint">Your photo will be centered to fit your cover.</p>
        <input
          ref="inputRef"
          class="cover-editor__file"
          type="file"
          accept="image/*"
          aria-label="Choose cover photo"
          :disabled="profile.saving"
          @change="select"
        />
        <p v-if="error" role="alert" class="cover-editor__error">{{ error }}</p>
        <div class="cover-editor__actions">
          <ion-button fill="outline" :disabled="profile.saving" @click="inputRef?.click()">{{
            file ? 'Choose another photo' : 'Choose photo'
          }}</ion-button>
          <ion-button
            v-if="currentUrl && !file"
            fill="clear"
            color="danger"
            :disabled="profile.saving"
            @click="save(true)"
            >Remove cover</ion-button
          >
          <ion-button :disabled="!file || profile.saving" @click="save(false)">{{
            profile.saving ? 'Saving…' : 'Save cover'
          }}</ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/vue';
import { useProfileStore } from '@/stores/profile';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import { POST_PHOTO_SOURCE_MAX_BYTES } from '@/utils/post-photos';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ isOpen: boolean; currentUrl: string | null }>();
const emit = defineEmits<{ close: [] }>();
const profile = useProfileStore();
const auth = useAuthStore();
const inputRef = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const preview = ref('');
const error = ref<string | null>(null);

function reset(): void {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = '';
  file.value = null;
  error.value = null;
}
function select(event: Event): void {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = '';
  if (!selected) return;
  if (!selected.type.startsWith('image/') || selected.size > POST_PHOTO_SOURCE_MAX_BYTES) {
    error.value = 'Choose an image smaller than 20 MB.';
    return;
  }
  reset();
  file.value = selected;
  preview.value = URL.createObjectURL(selected);
}
async function save(remove: boolean): Promise<void> {
  if (profile.saving || (!remove && !file.value)) return;
  const isCurrent = captureSession(auth);
  error.value = null;
  const result = await profile.updateCover(remove ? null : file.value);
  if (!isCurrent()) return;
  if (!result.ok) {
    error.value = result.message;
    return;
  }
  void showNotice(remove ? 'Cover photo removed.' : 'Cover photo updated.');
  emit('close');
}
watch(
  () => props.isOpen,
  (open) => {
    if (!open) reset();
  },
);
watch(
  () => auth.sessionVersion,
  () => {
    reset();
    emit('close');
  },
  { flush: 'sync' },
);
onBeforeUnmount(reset);
</script>

<style scoped>
.cover-editor {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 16px;
}
.cover-editor__preview {
  display: grid;
  place-items: center;
  aspect-ratio: 2.7;
  overflow: hidden;
  border-radius: 14px;
  background: var(--gora-surface-raised);
  color: var(--gora-muted);
}
.cover-editor__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-editor__preview p {
  padding: 16px;
  text-align: center;
}
.cover-editor__hint {
  color: var(--gora-muted);
  font-size: 0.85rem;
}
.cover-editor__file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}
.cover-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cover-editor__error {
  color: #ff8585;
}
</style>
