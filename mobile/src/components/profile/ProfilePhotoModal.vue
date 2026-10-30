<template>
  <ion-modal :is-open="isOpen" :can-dismiss="!profile.saving" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile photo</ion-title>
        <ion-buttons slot="end"><ion-button :disabled="profile.saving" @click="emit('close')">Close</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="photo-editor" :aria-busy="profile.saving">
        <p class="photo-editor__hint">Drag the photo to position it, then adjust the zoom.</p>
        <div
          ref="viewport"
          class="photo-editor__viewport"
          :class="{ 'photo-editor__viewport--empty': !preview }"
          role="img"
          aria-label="Circular profile photo crop preview"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
        >
          <img v-if="preview" ref="imageElement" :src="preview" alt="" draggable="false" :style="imageTransform" />
          <span v-else>Choose a photo</span>
        </div>
        <label v-if="selectedFile" class="photo-editor__zoom">
          <span>Zoom</span>
          <input v-model.number="zoom" type="range" min="1" max="3" step="0.01" aria-label="Zoom profile photo" />
        </label>
        <input ref="fileInput" class="photo-editor__file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="select" />
        <p v-if="error" class="photo-editor__error" role="alert">{{ error }}</p>
        <div class="photo-editor__actions">
          <ion-button fill="outline" :disabled="profile.saving" @click="fileInput?.click()">{{ preview ? 'Choose another photo' : 'Choose photo' }}</ion-button>
          <ion-button v-if="currentUrl && !selectedFile" fill="clear" color="danger" :disabled="profile.saving" @click="remove">Remove photo</ion-button>
          <ion-button :disabled="!selectedFile || profile.saving" @click="save">
            <ion-spinner v-if="profile.saving" slot="start" name="crescent" />
            {{ profile.saving ? 'Saving…' : 'Save photo' }}
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonSpinner } from '@ionic/vue';
import { useProfileStore } from '@/stores/profile';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import { PROFILE_PHOTO_SOURCE_MAX_BYTES, prepareProfilePhoto } from '@/utils/profile-photo';
import { showNotice } from '@/utils/notice';

const props = defineProps<{ isOpen: boolean; currentUrl: string | null }>();
const emit = defineEmits<{ close: []; saved: [url: string | null] }>();
const profile = useProfileStore();
const auth = useAuthStore();
const fileInput = ref<HTMLInputElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const selectedFile = ref<File | null>(null);
const preview = ref('');
const error = ref('');
const zoom = ref(1);
const offset = ref({ x: 0, y: 0 });
const drag = ref<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
const imageTransform = computed(() => ({ transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0) scale(${zoom.value})` }));

function reset(): void {
  if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value);
  preview.value = '';
  selectedFile.value = null;
  error.value = '';
  zoom.value = 1;
  offset.value = { x: 0, y: 0 };
}

function select(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > PROFILE_PHOTO_SOURCE_MAX_BYTES) {
    error.value = 'Choose an image smaller than 20 MB.';
    return;
  }
  reset();
  selectedFile.value = file;
  preview.value = URL.createObjectURL(file);
}

function startDrag(event: PointerEvent): void {
  if (!selectedFile.value || !viewport.value) return;
  viewport.value.setPointerCapture(event.pointerId);
  drag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.value.x, offsetY: offset.value.y };
}

function moveDrag(event: PointerEvent): void {
  if (!drag.value || drag.value.pointerId !== event.pointerId || !imageElement.value || !viewport.value) return;
  const size = viewport.value.clientWidth;
  const image = imageElement.value;
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom.value;
  const maxX = Math.max(0, (image.naturalWidth * scale - size) / 2);
  const maxY = Math.max(0, (image.naturalHeight * scale - size) / 2);
  offset.value = {
    x: Math.max(-maxX, Math.min(maxX, drag.value.offsetX + event.clientX - drag.value.x)),
    y: Math.max(-maxY, Math.min(maxY, drag.value.offsetY + event.clientY - drag.value.y)),
  };
}

function endDrag(event: PointerEvent): void {
  if (drag.value?.pointerId === event.pointerId) drag.value = null;
}

async function save(): Promise<void> {
  if (!selectedFile.value || profile.saving || !viewport.value) return;
  const isCurrent = captureSession(auth);
  error.value = '';
  try {
    const photo = await prepareProfilePhoto(selectedFile.value, zoom.value, offset.value.x, offset.value.y, viewport.value.clientWidth);
    if (!isCurrent()) return;
    const result = await profile.updateProfilePhoto(photo);
    if (!isCurrent()) return;
    if (!result.ok) { error.value = result.message; return; }
    const url = profile.currentProfile?.profileImageUrl ?? null;
    emit('saved', url);
    void showNotice('Profile photo updated.');
    emit('close');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'That photo could not be saved.';
  }
}

async function remove(): Promise<void> {
  if (profile.saving || !props.currentUrl) return;
  const isCurrent = captureSession(auth);
  error.value = '';
  const result = await profile.updateProfilePhoto(null);
  if (!isCurrent()) return;
  if (!result.ok) { error.value = result.message; return; }
  emit('saved', null);
  void showNotice('Profile photo removed.');
  emit('close');
}

watch(() => props.isOpen, (open) => {
  reset();
  if (open) preview.value = props.currentUrl ?? '';
});
watch(() => auth.sessionVersion, () => { reset(); emit('close'); }, { flush: 'sync' });
onBeforeUnmount(reset);
</script>

<style scoped>
.photo-editor { display: flex; max-width: 560px; flex-direction: column; align-items: center; gap: 18px; margin: 0 auto; padding: 24px 18px 36px; }
.photo-editor__hint { max-width: 360px; margin: 0; color: var(--gora-muted); text-align: center; font-size: .9rem; }
.photo-editor__viewport { position: relative; display: grid; width: min(78vw, 320px); aspect-ratio: 1; place-items: center; overflow: hidden; border: 4px solid var(--ion-color-primary); border-radius: 50%; background: var(--gora-surface-raised); color: var(--gora-muted); touch-action: none; user-select: none; }
.photo-editor__viewport img { position: absolute; width: 100%; height: 100%; object-fit: cover; transform-origin: center; pointer-events: none; }
.photo-editor__viewport--empty { border-style: dashed; }
.photo-editor__zoom { display: flex; width: min(100%, 360px); align-items: center; gap: 12px; color: var(--ion-text-color); font-size: .86rem; font-weight: 700; }
.photo-editor__zoom input { flex: 1; accent-color: var(--ion-color-primary); }
.photo-editor__file { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
.photo-editor__error { width: 100%; margin: 0; color: #ff8585; font-size: .86rem; text-align: center; }
.photo-editor__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; width: 100%; }
</style>
