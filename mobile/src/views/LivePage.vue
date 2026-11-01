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
        <section v-if="live?.status === 'LIVE'" class="live-comments" aria-label="Live comments">
          <header class="live-comments__header">
            <h2>Live comments</h2>
            <span>{{ comments.length }}</span>
          </header>
          <p v-if="!comments.length" class="live-comments__empty">Be the first to say something.</p>
          <div v-else class="live-comments__list" aria-live="polite">
            <article v-for="comment in comments" :key="comment.id" class="live-comments__item">
              <UserAvatar :user="comment.author" :size="34" />
              <div class="live-comments__body">
                <div class="live-comments__meta">
                  <strong>{{ comment.author.displayName }}</strong>
                  <time :datetime="comment.createdAt">{{ formatCommentTime(comment.createdAt) }}</time>
                </div>
                <p>{{ comment.content }}</p>
              </div>
            </article>
          </div>
          <form class="live-comments__form" @submit.prevent="sendComment">
            <input
              v-model="commentDraft"
              maxlength="500"
              aria-label="Write a live comment"
              placeholder="Write a comment..."
              :disabled="commentSending"
            />
            <button class="live-comments__send" type="submit" :disabled="commentSending || !commentDraft.trim()">
              {{ commentSending ? 'Sending...' : 'Send' }}
            </button>
          </form>
          <p v-if="commentError" class="live-page__error" role="alert">{{ commentError }}</p>
        </section>
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
import { liveApi, type LiveComment } from '@/services/live-api.service';
import { createAuthorizedCall } from '@/stores/authorized';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const isCreate = computed(() => route.name === 'create-live');
const title = ref('');
const muted = ref(true);
const video = ref<HTMLVideoElement>();
const comments = ref<LiveComment[]>([]);
const commentDraft = ref('');
const commentSending = ref(false);
const commentError = ref('');
const auth = useAuthStore();
const authorized = createAuthorizedCall(auth);
let commentsTimer: ReturnType<typeof setInterval> | undefined;
let commentsRequest = false;
function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
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
async function refreshComments() {
  if (!live.value || live.value.status !== 'LIVE' || commentsRequest) return;
  const id = live.value.id;
  commentsRequest = true;
  try {
    const rows = await authorized((token) => liveApi.comments(token, id));
    if (live.value?.id === id) {
      comments.value = rows;
      commentError.value = '';
    }
  } catch {
    // Preserve the existing comments during brief connection interruptions.
  } finally {
    commentsRequest = false;
  }
}
async function sendComment() {
  const text = commentDraft.value.trim();
  const id = live.value?.id;
  if (!text || !id || commentSending.value) return;
  commentSending.value = true;
  commentError.value = '';
  try {
    const created = await authorized((token) => liveApi.comment(token, id, text));
    if (live.value?.id === id) {
      comments.value = [...comments.value, created].slice(-100);
      commentDraft.value = '';
    }
  } catch (caught) {
    commentError.value = caught instanceof Error ? caught.message : 'Could not send your comment.';
  } finally {
    commentSending.value = false;
  }
}
function stopCommentPolling() {
  if (commentsTimer) clearInterval(commentsTimer);
  commentsTimer = undefined;
  comments.value = [];
}
watch(() => [live.value?.id, live.value?.status] as const, ([id, liveStatus]) => {
  stopCommentPolling();
  commentError.value = '';
  if (id && liveStatus === 'LIVE') {
    void refreshComments();
    commentsTimer = setInterval(() => void refreshComments(), 2500);
  }
});
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
onIonViewWillLeave(() => {
  stopCommentPolling();
  dispose();
});
window.addEventListener('pagehide', dispose);
onBeforeUnmount(() => {
  dispose();
  stopCommentPolling();
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
.live-comments {
  border: 1px solid var(--gora-line);
  border-radius: 16px;
  background: var(--gora-surface);
  overflow: hidden;
}
.live-comments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--gora-line);
}
.live-comments__header h2 {
  margin: 0;
  font-size: 1rem;
}
.live-comments__header span,
.live-comments__meta time {
  color: var(--gora-muted);
  font-size: 0.78rem;
}
.live-comments__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 340px;
  overflow-y: auto;
  padding: 16px;
}
.live-comments__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.live-comments__body {
  min-width: 0;
  flex: 1;
}
.live-comments__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.live-comments__meta strong {
  font-size: 0.88rem;
}
.live-comments__body p {
  margin: 3px 0 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}
.live-comments__empty {
  padding: 14px 16px;
  margin: 0;
  color: var(--gora-muted);
}
.live-comments__form {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--gora-line);
}
.live-comments__form input {
  min-width: 0;
  flex: 1;
  padding: 12px 14px;
  border-radius: 999px;
}
.live-page .live-comments__send {
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: #101214;
}
@media (max-width: 520px) {
  .live-comments__form {
    position: sticky;
    bottom: 0;
    background: var(--gora-surface);
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }
}
</style>
