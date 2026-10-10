<template>
  <div class="chat-tools">
    <button type="button" :disabled="disabled || busy" aria-label="Record voice message" @click="record">
      <ion-icon :icon="micOutline" />
    </button>
    <button
      type="button"
      :disabled="disabled || busy"
      aria-label="Send photo from gallery"
      @click="input?.click()"
    >
      <ion-icon :icon="imageOutline" />
    </button>
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="chat-tools__file"
      aria-label="Choose chat photo"
      @change="choose"
    />
    <ion-modal :is-open="open" :can-dismiss="canDismiss" @did-dismiss="cancel">
      <ion-header
        ><ion-toolbar
          ><ion-title>{{
            recording
              ? 'Recording voice message'
              : file?.type.startsWith('audio/')
                ? 'Voice message'
                : 'Send photo'
          }}</ion-title
          ><ion-buttons slot="end"
            ><ion-button :disabled="busy" @click="cancel">Cancel</ion-button></ion-buttons
          ></ion-toolbar
        ></ion-header
      >
      <ion-content>
        <div class="attachment-editor">
          <p v-if="recording" role="status">Recording · {{ seconds }}s / 60s</p>
          <ion-button v-if="recording" color="danger" @click="stop">Stop recording</ion-button>
          <audio
            v-else-if="preview && file?.type.startsWith('audio/')"
            :src="preview"
            controls
            preload="metadata"
          />
          <img v-else-if="preview" :src="preview" alt="Photo to send" />
          <p v-if="error" role="alert">{{ error }}</p>
          <ion-button v-if="file && !recording" :disabled="busy" @click="publish">{{
            busy ? 'Sending…' : 'Send'
          }}</ion-button>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue';
import {
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  onIonViewDidLeave,
} from '@ionic/vue';
import { micOutline, imageOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';
import { showNotice } from '@/utils/notice';
const props = defineProps<{
  disabled?: boolean;
  send: (file: File) => Promise<string | null>;
}>();
const auth = useAuthStore();
const input = ref<HTMLInputElement | null>(null);
const open = ref(false);
const busy = ref(false);
const canDismiss = async () => !busy.value;
const recording = ref(false);
const seconds = ref(0);
const file = ref<File | null>(null);
const preview = ref('');
const error = ref<string | null>(null);
let recorder: MediaRecorder | undefined;
let stream: MediaStream | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let generation = 0;
function release() {
  clearInterval(timer);
  stream?.getTracks().forEach((t) => t.stop());
  stream = undefined;
}
function cancel() {
  if (busy.value) return;
  generation++;
  if (recorder?.state === 'recording') {
    recorder.onstop = null;
    recorder.stop();
  }
  recorder = undefined;
  release();
  recording.value = false;
  open.value = false;
  file.value = null;
  error.value = null;
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = '';
}
function choose(event: Event) {
  const element = event.target as HTMLInputElement;
  const selected = element.files?.[0];
  element.value = '';
  if (!selected) return;
  if (!selected.type.startsWith('image/') || selected.size > 20 * 1024 * 1024) {
    void showNotice('Choose an image smaller than 20 MB.');
    return;
  }
  cancel();
  file.value = selected;
  preview.value = URL.createObjectURL(selected);
  open.value = true;
}
async function record() {
  if (props.disabled || busy.value) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    void showNotice('Voice recording is not supported in this browser.');
    return;
  }
  cancel();
  const version = generation;
  const isCurrent = captureSession(auth);
  open.value = true;
  try {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (version !== generation || !isCurrent()) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = media;
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    if (!mime) throw new Error('This browser cannot record a supported audio format.');
    recorder = new MediaRecorder(media, {
      mimeType: mime,
      audioBitsPerSecond: 64000,
    });
    const chunks: Blob[] = [];
    let size = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunks.push(event.data);
        size += event.data.size;
        if (size > 1024 * 1024 && recorder?.state === 'recording') stop();
      }
    };
    recorder.onstop = () => {
      release();
      recording.value = false;
      if (version !== generation || !isCurrent()) return;
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size || blob.size > 1024 * 1024) {
        error.value = 'Record a shorter voice message, up to 1 MB.';
        return;
      }
      file.value = new File(
        [blob],
        mime.includes('mp4') ? 'voice.m4a' : mime.includes('ogg') ? 'voice.ogg' : 'voice.webm',
        { type: mime },
      );
      preview.value = URL.createObjectURL(blob);
    };
    recorder.onerror = () => {
      error.value = 'Recording failed. Please try again.';
      stop();
    };
    seconds.value = 0;
    recording.value = true;
    recorder.start(1000);
    timer = setInterval(() => {
      seconds.value++;
      if (seconds.value >= 60) stop();
    }, 1000);
  } catch {
    release();
    error.value = 'Microphone access failed. Allow microphone access in your browser and try again.';
  }
}
function stop() {
  if (recorder?.state === 'recording') recorder.stop();
}
async function publish() {
  if (!file.value || busy.value) return;
  const isCurrent = captureSession(auth);
  busy.value = true;
  error.value = null;
  try {
    const result = await props.send(file.value);
    if (!isCurrent()) return;
    error.value = result;
    if (!result) {
      busy.value = false;
      cancel();
    }
  } finally {
    if (isCurrent()) busy.value = false;
  }
}
function cleanup() {
  busy.value = false;
  cancel();
}
watch(() => auth.sessionVersion, cleanup, { flush: 'sync' });
onBeforeUnmount(cleanup);
onIonViewDidLeave(cleanup);
</script>

<style scoped>
.chat-tools {
  display: flex;
  gap: 2px;
  align-items: center;
  height: 44px;
}
.chat-tools button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ion-color-primary);
  font-size: 24px;
  cursor: pointer;
}
.chat-tools button:disabled {
  opacity: 0.4;
}
.chat-tools__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}
.attachment-editor {
  display: grid;
  gap: 16px;
  padding: 24px 16px;
  max-width: 680px;
  margin: auto;
}
.attachment-editor img {
  width: 100%;
  max-height: 65vh;
  object-fit: contain;
}
.attachment-editor audio {
  width: 100%;
}
.attachment-editor [role='alert'] {
  color: #ff8585;
}
</style>
