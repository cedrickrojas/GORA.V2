<template>
  <ion-modal :is-open="isOpen" class="story-viewers-modal" @did-dismiss="emit('close')">
    <section class="story-viewers">
      <header class="story-viewers__header">
        <div>
          <h2>Story viewers</h2>
          <p>{{ viewers.length }} {{ viewers.length === 1 ? 'person' : 'people' }} viewed this story</p>
        </div>
        <button type="button" aria-label="Close viewers" @click="emit('close')">×</button>
      </header>
      <div v-if="storiesStore.loadingViewersStoryId === storyId" class="story-viewers__state">Loading viewers…</div>
      <div v-else-if="error" class="story-viewers__state" role="alert">{{ error }}</div>
      <div v-else-if="viewers.length === 0" class="story-viewers__state">No one has viewed this story yet.</div>
      <ul v-else class="story-viewers__list">
        <li v-for="viewer in viewers" :key="viewer.user.id">
          <UserAvatar :user="viewer.user" :size="42" />
          <div class="story-viewers__person">
            <strong>{{ viewer.user.displayName }}</strong>
            <span>@{{ viewer.user.username }}</span>
          </div>
          <time>{{ formatTimeAgo(Date.parse(viewer.viewedAt), nowMs) }}</time>
        </li>
      </ul>
    </section>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonModal } from '@ionic/vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useStoriesStore } from '@/stores/stories';
import { formatTimeAgo } from '@/utils/time';

const props = defineProps<{ isOpen: boolean; storyId: string | null }>();
const emit = defineEmits<{ close: [] }>();
const storiesStore = useStoriesStore();
const error = ref<string | null>(null);
const nowMs = Date.now();
const viewers = computed(() => (props.storyId ? storiesStore.viewersByStoryId[props.storyId] ?? [] : []));

watch(
  () => [props.isOpen, props.storyId] as const,
  async ([isOpen, storyId]) => {
    error.value = null;
    if (isOpen && storyId) error.value = await storiesStore.loadViewers(storyId);
  },
  { immediate: true },
);
</script>

<style scoped>
.story-viewers-modal {
  --width: min(100%, 440px);
  --height: min(72dvh, 560px);
  --border-radius: 20px;
  --background: #1c1d20;
  --backdrop-opacity: 0.72;
}

.story-viewers {
  height: 100%;
  overflow: auto;
  padding: 22px 18px;
  color: var(--ion-text-color);
}

.story-viewers__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--gora-line);
}

.story-viewers__header h2 { margin: 0; font-size: 1.1rem; }
.story-viewers__header p { margin: 5px 0 0; color: var(--gora-muted); font-size: 0.82rem; }
.story-viewers__header button { border: 0; background: transparent; color: inherit; font-size: 28px; cursor: pointer; }
.story-viewers__state { padding: 28px 8px; color: var(--gora-muted); text-align: center; }
.story-viewers__list { display: grid; gap: 2px; margin: 0; padding: 8px 0; list-style: none; }
.story-viewers__list li { display: flex; align-items: center; gap: 11px; padding: 9px 0; }
.story-viewers__person { display: grid; min-width: 0; flex: 1; gap: 3px; }
.story-viewers__person strong, .story-viewers__person span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.story-viewers__person span, .story-viewers__list time { color: var(--gora-muted); font-size: 0.78rem; }
</style>
