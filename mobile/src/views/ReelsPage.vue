<template>
  <ion-page>
    <ion-content :scroll-y="false" class="reels-page__content">
      <div class="reels-page">
        <div class="reels-top">
          <span class="reels-top__side" aria-hidden="true" />
          <div class="reels-top__tabs" role="tablist" aria-label="Reels feed">
            <button
              v-for="tab in REELS_TABS"
              :key="tab.id"
              type="button"
              role="tab"
              class="reels-top__tab"
              :class="{ 'reels-top__tab--active': activeTab === tab.id }"
              :aria-selected="activeTab === tab.id"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
          <div class="reels-top__side reels-top__side--end">
            <button type="button" class="reels-top__live" aria-label="Watch live" @click="router.push('/live')">
              <ion-icon :icon="radioOutline" aria-hidden="true" />
              <span class="reels-top__live-badge">LIVE</span>
            </button>
          </div>
        </div>

        <div v-if="visibleReels.length === 0 && reelsStore.serverStatus === 'loading'" class="reels-page__empty" role="status">
          <strong>Loading reels…</strong>
        </div>
        <div v-else-if="visibleReels.length === 0 && reelsStore.serverError" class="reels-page__empty" role="alert">
          <strong>Could not load reels</strong>
          <span>{{ reelsStore.serverError }}</span>
          <button type="button" class="reels-page__empty-action" @click="reelsStore.refresh()">Try again</button>
        </div>
        <div v-else-if="visibleReels.length === 0" class="reels-page__empty">
          <ion-icon :icon="peopleOutline" aria-hidden="true" />
          <strong>{{ activeTab === 'FOLLOWING' ? 'No reels from people you follow yet' : 'No reels yet' }}</strong>
          <span>{{ activeTab === 'FOLLOWING' ? 'Follow players from For You to see their reels here.' : 'Upload a reel to share your game highlights.' }}</span>
          <button v-if="activeTab === 'FOLLOWING'" type="button" class="reels-page__empty-action" @click="activeTab = 'FOR_YOU'">Browse For You</button>
        </div>

        <div v-else :key="activeTab" class="reels" :aria-label="`${activeTabLabel} reels`">
          <ReelCommentsModal :is-open="commentsOpen" :reel-id="commentReelId" @close="commentsOpen = false" />
          <ReelSlide
            v-for="reel in visibleReels"
            :key="reel.id"
            :reel="reel"
            :data-reel-id="reel.id"
            :is-following="followsStore.isFollowing(reel.author.id)"
            :can-follow="canFollow(session.me?.id ?? null, reel.author.id)"
            @like="likeReel($event.id)"
            @comment="openComments($event.id)"
            @share="shareReel($event)"
            @follow="followsStore.toggleFollow($event.author.id)"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage, onIonViewWillEnter } from '@ionic/vue';
import { peopleOutline, radioOutline } from 'ionicons/icons';
import ReelSlide from '@/components/reels/ReelSlide.vue';
import ReelCommentsModal from '@/components/reels/ReelCommentsModal.vue';
import { useFollowsStore } from '@/stores/follows';
import { useReelsStore } from '@/stores/reels';
import { useSessionStore } from '@/stores/session';
import { canFollow } from '@/utils/follows';
import { showNotice } from '@/utils/notice';
import type { Reel } from '@/types/reel';
import {
  DEFAULT_REELS_TAB,
  REELS_TABS,
  type ReelsTab,
  selectFollowingReels,
  selectForYouReels,
} from '@/utils/reels';

const reelsStore = useReelsStore();
const router = useRouter();
const route = useRoute();
const followsStore = useFollowsStore();
const session = useSessionStore();

const activeTab = ref<ReelsTab>(DEFAULT_REELS_TAB);
const commentsOpen = ref(false);
const commentReelId = ref<string | null>(null);
const activeTabLabel = computed(() => REELS_TABS.find((tab) => tab.id === activeTab.value)?.label ?? '');

/**
 * Following is captured when the tab opens, so unfollowing someone mid-scroll
 * does not yank the reel away from under the viewer.
 */
const followingSnapshot = ref<string[]>([]);

const visibleReels = computed(() =>
  activeTab.value === 'FOLLOWING'
    ? selectFollowingReels(reelsStore.feedReels, followingSnapshot.value)
    : selectForYouReels(reelsStore.feedReels),
);

function snapshotFollowing(): void {
  followingSnapshot.value = [...followsStore.followingIds];
}

watch(activeTab, (tab) => {
  if (tab === 'FOLLOWING') {
    snapshotFollowing();
  }
});

watch(
  () => [route.query.reel, visibleReels.value] as const,
  async ([reelId]) => {
    if (typeof reelId !== 'string') return;
    if (activeTab.value !== 'FOR_YOU') activeTab.value = 'FOR_YOU';
    await nextTick();
    document.querySelector<HTMLElement>(`[data-reel-id="${CSS.escape(reelId)}"]`)?.scrollIntoView({ behavior: 'smooth' });
  },
  { flush: 'post' },
);

onMounted(async () => {
  void reelsStore.load();
  await followsStore.load();
  snapshotFollowing();
});
onIonViewWillEnter(() => {
  if (reelsStore.isLoaded) void reelsStore.refresh();
});
async function likeReel(id: string): Promise<void> {
  const error = await reelsStore.toggleLike(id);
  if (error) void showNotice(error);
}

function openComments(reelId: string): void {
  commentReelId.value = reelId;
  commentsOpen.value = true;
}

async function shareReel(reel: Reel): Promise<void> {
  const url = new URL('/reels', window.location.origin);
  url.searchParams.set('reel', reel.id);
  const title = `${reel.author.displayName}'s GORA reel`;
  const text = reel.caption || `Watch ${reel.author.displayName}'s ${reel.sport} reel on GORA.`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url: url.toString() });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url.toString());
      await showNotice('Reel link copied.');
    } else {
      throw new Error('Sharing is not available on this device.');
    }
    if (reel.fromServer) {
      const error = await reelsStore.shareReel(reel.id);
      if (error) void showNotice(error);
    } else {
      reel.shares += 1;
    }
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') return;
    void showNotice(caught instanceof Error ? caught.message : 'Could not share this reel.');
  }
}
</script>

<style scoped>
.reels-page__content {
  --background: #000;
  --padding-start: 0;
  --padding-end: 0;
}

.reels-page {
  position: relative;
  height: 100%;
}

/* Wider screens show a centered 9:16 player, like TikTok on the web. */
@media (min-width: 768px) {
  .reels-page {
    max-width: 100%;
    margin: 0 auto;
    aspect-ratio: 9 / 16;
  }
}

.reels-top {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  left: 0;
  display: grid;
  align-items: center;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 28px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent);
  grid-template-columns: 1fr auto 1fr;
  pointer-events: none;
}

.reels-top > * {
  pointer-events: auto;
}

.reels-top__side--end {
  display: flex;
  justify-content: flex-end;
}

.reels-top__tabs {
  display: flex;
  gap: 18px;
}

.reels-top__tab {
  position: relative;
  padding: 6px 0 8px;
  border: 0;
  background: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.reels-top__tab--active {
  color: #fff;
}

.reels-top__tab--active::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 28px;
  height: 3px;
  border-radius: 2px;
  background: #fff;
  content: '';
  transform: translateX(-50%);
}

.reels-top__live {
  position: relative;
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: #fff;
  cursor: pointer;
}

.reels-top__live ion-icon {
  font-size: 26px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}

.reels-top__live-badge {
  position: absolute;
  bottom: 0;
  left: 50%;
  padding: 1px 5px;
  border-radius: 4px;
  background: #fe2c55;
  color: #fff;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  transform: translateX(-50%);
}

.reels {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
}

.reels::-webkit-scrollbar {
  display: none;
}

.reels-page__empty {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 32px;
  color: var(--gora-muted);
  font-size: 0.85rem;
  text-align: center;
}

.reels-page__empty ion-icon {
  color: var(--ion-color-primary);
  font-size: 44px;
}

.reels-page__empty strong {
  color: var(--ion-text-color);
  font-size: 1rem;
}

.reels-page__empty-action {
  margin-top: 8px;
  padding: 10px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
</style>
