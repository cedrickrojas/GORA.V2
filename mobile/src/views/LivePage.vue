<template>
  <ion-page>
    <SubPageHeader :title="isCreate ? 'Go Live' : 'Watch Live'" back-href="/home" />
    <ion-content>
      <main class="live-page">
        <div v-if="live" class="live-page__heading">
          <UserAvatar :user="live.host" :size="44" />
          <div>
            <strong>{{ live.host.displayName }}</strong>
            <h1>{{ live.title }}</h1>
          </div>
          <span v-if="live.status === 'LIVE'" class="live-page__badge">LIVE</span>
        </div>
        <div class="live-page__stage">
          <video ref="video" autoplay playsinline :muted="isCreate || muted" :controls="!isCreate && !!remoteStream" />
          <div v-if="!localStream && !remoteStream" class="live-page__placeholder">
            <ion-icon :icon="videocamOutline" aria-hidden="true" />
            <p>{{ isCreate ? 'Share the action with your community.' : status || 'Loading live...' }}</p>
          </div>
          <span v-if="broadcasting" class="live-page__viewers">{{ viewerCount }} watching</span>
        </div>
        <p class="live-page__status" role="status">{{ status }}</p>
        <p v-if="error" class="live-page__error" role="alert">{{ error }}</p>
        <template v-if="isCreate && !live">
          <label for="live-title">Live title</label>
          <input
            id="live-title"
            v-model="title"
            maxlength="120"
            placeholder="What's happening on the court?"
            :disabled="busy"
          />
          <p class="live-page__note">Public · Signed-in members can watch. Leaving this page ends your broadcast.</p>
          <button v-if="!localStream" class="live-page__primary" :disabled="busy" @click="preview">
            {{ busy ? 'Opening...' : 'Open camera & microphone' }}
          </button>
          <button v-else class="live-page__primary" :disabled="busy || !title.trim()" @click="start(title)">
            {{ busy ? 'Starting...' : 'Start Live' }}
          </button>
        </template>
        <div v-if="localStream" class="live-page__controls">
          <button :aria-pressed="!micOn" @click="toggle('audio')">{{ micOn ? 'Mute mic' : 'Unmute mic' }}</button>
          <button :aria-pressed="!cameraOn" @click="toggle('video')">
            {{ cameraOn ? 'Camera off' : 'Camera on' }}
          </button>
        </div>
        <button v-if="isOwner && live?.status === 'LIVE'" class="live-page__end" :disabled="busy" @click="end">
          {{ busy ? 'Ending...' : 'End Live' }}
        </button>
        <template v-if="!isCreate && !isOwner && live?.status === 'LIVE'">
          <button v-if="remoteStream" @click="enableSound">{{ muted ? 'Tap to enable sound' : 'Mute sound' }}</button>
          <button :disabled="busy" @click="watchLive">
            {{ busy ? 'Connecting...' : watching ? 'Reconnect' : 'Try connecting again' }}
          </button>
        </template>
        <router-link v-if="!isCreate && live?.status !== 'LIVE'" to="/home">Back to Home</router-link>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonContent, IonIcon, IonPage, onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue';
import { videocamOutline } from 'ionicons/icons';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useLive } from '@/composables/useLive';

const route = useRoute();
const isCreate = computed(() => route.name === 'create-live');
const title = ref('');
const muted = ref(true);
const video = ref<HTMLVideoElement>();
const {
  live,
  localStream,
  remoteStream,
  busy,
  error,
  status,
  micOn,
  cameraOn,
  viewerCount,
  broadcasting,
  watching,
  isOwner,
  enter,
  preview,
  start,
  watchLive,
  end,
  toggle,
  dispose,
} = useLive();
watch([localStream, remoteStream, video], async () => {
  await nextTick();
  if (video.value) {
    video.value.srcObject = localStream.value ?? remoteStream.value;
    void video.value.play().catch(() => undefined);
  }
});
function enableSound() {
  muted.value = !muted.value;
  if (video.value) {
    video.value.muted = muted.value;
    void video.value.play().catch(() => undefined);
  }
}
onIonViewWillEnter(() => {
  muted.value = true;
  void enter(isCreate.value ? undefined : String(route.params.liveId));
});
onIonViewWillLeave(dispose);
window.addEventListener('pagehide', dispose);
onBeforeUnmount(() => {
  dispose();
  window.removeEventListener('pagehide', dispose);
});
</script>

<style scoped>
.live-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.live-page__heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.live-page__heading > div {
  flex: 1;
  min-width: 0;
}
.live-page h1 {
  margin: 5px 0 0;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
.live-page__badge,
.live-page__viewers {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 800;
}
.live-page__badge {
  background: #db2543;
  color: white;
}
.live-page__stage {
  position: relative;
  aspect-ratio: 16 / 10;
  max-height: 65vh;
  background: #050607;
  border: 1px solid var(--gora-line);
  border-radius: 18px;
  overflow: hidden;
}
.live-page video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.live-page__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: var(--gora-muted);
  padding: 20px;
  text-align: center;
  pointer-events: none;
}
.live-page__placeholder ion-icon {
  font-size: 48px;
  color: var(--ion-color-primary);
}
.live-page__viewers {
  position: absolute;
  top: 12px;
  left: 12px;
  background: #101214cc;
}
.live-page input {
  width: 100%;
  padding: 14px;
  border: 1px solid var(--gora-line);
  border-radius: 12px;
  background: var(--gora-surface);
  color: inherit;
}
.live-page button {
  border-radius: 12px;
  border: 1px solid var(--gora-line);
  padding: 14px 18px;
  background: var(--gora-surface);
  color: inherit;
  font-weight: 700;
}
.live-page button:disabled {
  opacity: 0.5;
}
.live-page .live-page__primary {
  background: var(--ion-color-primary);
  color: #101214;
}
.live-page .live-page__end {
  background: #db2543;
  color: white;
}
.live-page__controls {
  display: flex;
  gap: 10px;
}
.live-page__controls button {
  flex: 1;
}
.live-page__controls button[aria-pressed='true'] {
  color: var(--ion-color-primary);
}
.live-page__note,
.live-page__status {
  color: var(--gora-muted);
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0;
}
.live-page__error {
  color: #ff8292;
  margin: 0;
  line-height: 1.5;
}
</style>
