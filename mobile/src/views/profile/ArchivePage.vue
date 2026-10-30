<template>
  <ion-page>
    <SubPageHeader title="Archive" back-href="/profile" />
    <ion-content>
      <div class="archive-page">
        <SegmentTabs v-model="section" :options="sections" aria-label="Archive category" />

        <section v-if="section === 'stories'" class="archive-page__section" aria-label="Story archive">
          <p v-if="archivedStories.length === 0" class="archive-page__empty">No stories in your archive yet.</p>
          <ul v-else class="archive-page__stories">
            <li v-for="story in archivedStories" :key="story.id" class="archive-page__story">
              <span class="archive-page__thumb" :style="thumbStyle(story)" />
              <span class="archive-page__story-text">
                <strong>{{ story.media.caption || untitled(story) }}</strong>
                <span>{{ story.media.sport }} · Expired {{ formatTimeAgo(Date.parse(story.expiresAt), now) }}</span>
              </span>
              <StoryOptionsButton v-if="story.fromServer" :story="story" />
            </li>
          </ul>
        </section>

        <section v-else-if="section === 'posts'" class="archive-page__section" aria-label="Post archive">
          <p v-if="error" class="archive-page__empty" role="alert">{{ error }}</p>
          <p v-else-if="postsStore.archivedPosts.length === 0" class="archive-page__empty">No posts in your archive yet.</p>
          <div v-else class="archive-page__posts">
            <PostCard v-for="post in postsStore.archivedPosts" :key="post.id" :post="post" :now-ms="now" @like="likePost" @comment="commentOnPost" @share="sharePost" />
          </div>
        </section>

        <section v-else class="archive-page__section" aria-label="Saved posts">
          <p v-if="error" class="archive-page__empty" role="alert">{{ error }}</p>
          <p v-else-if="postsStore.savedPosts.length === 0" class="archive-page__empty">No saved posts yet.</p>
          <div v-else class="archive-page__posts">
            <PostCard v-for="post in postsStore.savedPosts" :key="post.id" :post="post" :now-ms="now" @like="likePost" @comment="commentOnPost" @share="sharePost" />
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import PostCard from '@/components/feed/PostCard.vue';
import SegmentTabs from '@/components/common/SegmentTabs.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import StoryOptionsButton from '@/components/media/StoryOptionsButton.vue';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { usePostsStore } from '@/stores/posts';
import { useStoriesStore } from '@/stores/stories';
import type { Story } from '@/types/story';
import { getSportVisual } from '@/utils/sports';
import { partitionStories } from '@/utils/stories';
import { formatTimeAgo } from '@/utils/time';

const sections = [
  { id: 'stories', label: 'Stories' },
  { id: 'posts', label: 'Posts' },
  { id: 'saved', label: 'Saved' },
] as const;
const section = ref<'stories' | 'posts' | 'saved'>('stories');
const postsStore = usePostsStore();
const storiesStore = useStoriesStore();
const now = useNow();
const error = ref<string | null>(null);
const { likePost, commentOnPost, sharePost } = usePostActions();
const archivedStories = computed(() => partitionStories(storiesStore.myStories, now.value).expired);

function thumbStyle(story: Story): Record<string, string> {
  const { gradient } = getSportVisual(story.media.sport);
  return story.media.type === 'image' && story.media.url
    ? { background: `center / cover no-repeat url("${encodeURI(story.media.url)}"), ${gradient}` }
    : { background: gradient };
}

function untitled(story: Story): string {
  return story.media.type === 'video' ? 'Video story' : 'Photo story';
}

onIonViewWillEnter(async () => {
  void storiesStore.load();
  const [archiveError, savedError] = await Promise.all([postsStore.loadArchived(), postsStore.loadSaved()]);
  error.value = archiveError ?? savedError;
});
</script>

<style scoped>
.archive-page { max-width: 720px; margin: 0 auto; padding: 16px; }
.archive-page__section { padding-top: 18px; }
.archive-page__empty { padding: 24px 8px; color: var(--gora-muted); text-align: center; }
.archive-page__stories, .archive-page__posts { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
.archive-page__story { display: flex; align-items: center; gap: 12px; }
.archive-page__thumb { width: 48px; height: 72px; flex: 0 0 auto; border-radius: 10px; }
.archive-page__story-text { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; font-size: .88rem; }
.archive-page__story-text span { color: var(--gora-muted); font-size: .75rem; }
</style>
