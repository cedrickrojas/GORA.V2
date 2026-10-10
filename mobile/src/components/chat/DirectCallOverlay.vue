<template>
  <Teleport to="body">
    <section
      v-if="calls.call"
      class="direct-call"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-partner"
    >
      <div class="direct-call__panel">
        <UserAvatar v-if="calls.partner" :user="calls.partner" :size="72" />
        <h2 id="call-partner">{{ calls.partner?.displayName }}</h2>
        <p role="status">
          {{
            calls.incoming
              ? calls.call.mode === 'VIDEO'
                ? 'Incoming video call'
                : 'Incoming voice call'
              : calls.connected
                ? 'Connected'
                : calls.call.status === 'RINGING'
                  ? 'Calling…'
                  : 'Connecting…'
          }}
        </p>
        <audio ref="remoteAudio" autoplay />
        <video
          v-show="remoteHasVideo"
          ref="remoteVideo"
          class="direct-call__remote"
          autoplay
          muted
          playsinline
        />
        <video v-if="calls.cameraOn" ref="localVideo" class="direct-call__local" autoplay muted playsinline />
        <p v-if="playBlocked">
          <button type="button" @click="playRemote">Tap to hear the call</button>
        </p>
        <div v-if="calls.incoming" class="direct-call__controls">
          <button type="button" :disabled="calls.busy" @click="calls.answer(false)">Answer voice</button>
          <button type="button" :disabled="calls.busy" @click="calls.answer(true)">Answer with camera</button>
          <button type="button" class="direct-call__end" @click="calls.end">Decline</button>
        </div>
        <div v-else class="direct-call__controls">
          <button type="button" :aria-pressed="calls.muted" @click="calls.toggleMute">
            {{ calls.muted ? 'Unmute mic' : 'Mute mic' }}
          </button>
          <button
            type="button"
            :disabled="calls.busy"
            :aria-pressed="calls.cameraOn"
            @click="calls.toggleCamera"
          >
            {{ calls.cameraOn ? 'Camera off' : 'Camera on' }}
          </button>
          <button type="button" class="direct-call__end" @click="calls.end">End call</button>
        </div>
      </div>
    </section>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useDirectCallStore } from '@/stores/direct-call';
const calls = useDirectCallStore();
const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const remoteAudio = ref<HTMLAudioElement | null>(null);
const remoteHasVideo = computed(() => calls.remoteStream?.getVideoTracks().some((track) => !track.muted));
const playBlocked = ref(false);
async function playRemote() {
  try {
    await remoteAudio.value?.play();
    playBlocked.value = false;
  } catch {
    playBlocked.value = true;
  }
}
watch([() => calls.call?.id, () => calls.remoteStream], async () => {
  await nextTick();
  if (remoteAudio.value && calls.remoteStream) {
    remoteAudio.value.srcObject = new MediaStream(calls.remoteStream.getAudioTracks());
    void playRemote();
  }
  if (remoteVideo.value) {
    remoteVideo.value.srcObject = calls.remoteStream
      ? new MediaStream(calls.remoteStream.getVideoTracks())
      : null;
    if (remoteHasVideo.value) void remoteVideo.value.play().catch(() => undefined);
  }
});
watch([() => calls.call?.id, () => calls.localStream, () => calls.cameraOn], async () => {
  await nextTick();
  if (localVideo.value) {
    localVideo.value.srcObject = calls.localStream;
    void localVideo.value.play().catch(() => undefined);
  }
});
function leave() {
  calls.stopPolling();
}
function resume() {
  calls.startPolling();
}
onMounted(() => {
  calls.startPolling();
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', resume);
});
onBeforeUnmount(() => {
  calls.stopPolling();
  window.removeEventListener('pagehide', leave);
  window.removeEventListener('pageshow', resume);
});
</script>
<style scoped>
.direct-call {
  position: fixed;
  inset: 0;
  z-index: 25000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 85%);
  overflow-y: auto;
}
.direct-call__panel {
  width: min(100%, 760px);
  padding: 24px 16px;
  text-align: center;
  border-radius: 24px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
}
.direct-call__panel > :first-child {
  margin: auto;
}
.direct-call__remote {
  display: block;
  width: 100%;
  max-height: 50vh;
  min-height: 40px;
  background: #080b0e;
  border-radius: 16px;
}
.direct-call__local {
  display: block;
  width: 140px;
  height: 100px;
  margin: 12px auto;
  object-fit: cover;
  border-radius: 12px;
  transform: scaleX(-1);
}
.direct-call__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}
.direct-call button {
  border: 0;
  border-radius: 20px;
  padding: 12px 16px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font: inherit;
  cursor: pointer;
}
.direct-call button:disabled {
  opacity: 0.4;
}
.direct-call .direct-call__end {
  background: #cf3448;
  color: white;
}
</style>
