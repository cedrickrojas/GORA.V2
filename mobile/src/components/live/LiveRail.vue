<template>
  <section v-if="streams.length || error || showEmpty" class="live-rail" aria-label="Live now">
    <div class="live-rail__heading"><strong>LIVE NOW</strong><router-link to="/create/live">Go Live</router-link></div>
    <p v-if="error" role="alert">{{ error }} <button @click="load">Retry</button></p>
    <div class="live-rail__list">
      <router-link v-for="stream in streams" :key="stream.id" :to="`/live/${stream.id}`" class="live-rail__card">
        <UserAvatar :user="stream.host" :size="38" />
        <div>
          <strong>{{ stream.host.displayName }}</strong
          ><span>{{ stream.title }}</span>
        </div>
        <b>LIVE</b>
      </router-link>
    </div>
    <p v-if="showEmpty && !streams.length && !error" role="status">
      {{ loading ? 'Loading live broadcasts...' : 'No live broadcasts right now. Start one and share the action.' }}
    </p>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { liveApi, type LiveStreamInfo } from '@/services/live-api.service';
import { useAuthStore } from '@/stores/auth';
import { captureSession, createAuthorizedCall, describeContentError } from '@/stores/authorized';
const auth = useAuthStore();
const props = withDefaults(defineProps<{ active?: boolean; showEmpty?: boolean }>(), {
  active: true,
  showEmpty: false,
});
const authorized = createAuthorizedCall(auth);
const streams = ref<LiveStreamInfo[]>([]);
const error = ref('');
let timer: ReturnType<typeof setInterval> | undefined;
const loading = ref(false);
async function load() {
  if (loading.value || !auth.isAuthenticated) return;
  loading.value = true;
  const current = captureSession(auth);
  try {
    const rows = await authorized(liveApi.list);
    if (current()) {
      streams.value = rows;
      error.value = '';
    }
  } catch (caught) {
    if (current()) error.value = describeContentError(caught);
  } finally {
    loading.value = false;
  }
}
function stop() {
  clearInterval(timer);
}
watch(
  () => props.active,
  (active) => {
    stop();
    if (active) {
      void load();
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') void load();
      }, 10000);
    }
  },
  { immediate: true },
);
onBeforeUnmount(stop);
watch(
  () => auth.sessionVersion,
  () => {
    streams.value = [];
    error.value = '';
    if (props.active) void load();
  },
);
</script>
<style scoped>
.live-rail {
  padding: 16px;
}
.live-rail__heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 0.8rem;
}
.live-rail__heading strong {
  letter-spacing: 0.1em;
}
.live-rail__list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 5px;
}
.live-rail__card {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 270px;
  min-width: 0;
  padding: 14px;
  border: 1px solid #db254355;
  border-radius: 14px;
  color: inherit;
  text-decoration: none;
  background: var(--gora-surface);
}
.live-rail__card div {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.live-rail__card strong,
.live-rail__card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.live-rail__card span {
  font-size: 0.8rem;
  color: var(--gora-muted);
}
.live-rail__card b {
  font-size: 0.6rem;
  color: white;
  background: #db2543;
  padding: 4px 5px;
  border-radius: 4px;
}
</style>
