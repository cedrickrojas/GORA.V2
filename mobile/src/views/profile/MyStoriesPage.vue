<template>
  <ion-page>
    <SubPageHeader title="My Stories" />

    <ion-content :fullscreen="true">
      <div class="my-stories">
        <section class="my-stories__section">
          <SectionHeader title="Active">
            <router-link to="/create/story" class="my-stories__add">+ Add Story</router-link>
          </SectionHeader>
          <p v-if="ownStories.active.length === 0" class="my-stories__empty">No active stories.</p>
          <ul v-else class="my-stories__list">
            <li v-for="story in ownStories.active" :key="story.id" class="my-stories__item">
              <span class="my-stories__thumb" :style="thumbStyle(story)" />
              <span class="my-stories__text">
                <strong>{{ story.media.caption || untitled(story) }}</strong>
                <span>{{ details(story) }}{{ formatTimeLeft(getStoryRemainingMs(story, now)) }}</span>
              </span>
              <StoryOptionsButton v-if="story.fromServer" :story="story" />
            </li>
          </ul>
        </section>

        <section class="my-stories__section">
          <SectionHeader title="Archive" />
          <p class="my-stories__note">Expired stories are hidden from others but kept for your history.</p>
          <p v-if="ownStories.expired.length === 0" class="my-stories__empty">Nothing archived yet.</p>
          <ul v-else class="my-stories__list">
            <li v-for="story in ownStories.expired" :key="story.id" class="my-stories__item my-stories__item--expired">
              <span class="my-stories__thumb" :style="thumbStyle(story)" />
              <span class="my-stories__text">
                <strong>{{ story.media.caption || untitled(story) }}</strong>
                <span>{{ details(story) }}Expired {{ formatTimeAgo(Date.parse(story.expiresAt), now) }}</span>
              </span>
              <StoryOptionsButton v-if="story.fromServer" :story="story" />
            </li>
          </ul>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { IonContent, IonPage } from '@ionic/vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import StoryOptionsButton from '@/components/media/StoryOptionsButton.vue';
import { useNow } from '@/composables/useNow';
import { useStoriesStore } from '@/stores/stories';
import type { Story } from '@/types/story';
import { getPrivacyOption } from '@/utils/post-privacy';
import { getSportVisual } from '@/utils/sports';
import { getStoryRemainingMs, partitionStories } from '@/utils/stories';
import { formatTimeAgo, formatTimeLeft } from '@/utils/time';

const storiesStore = useStoriesStore();
const now = useNow();

/** Only the signed-in account's own stories (stored ones include expired, never deleted). */
const ownStories = computed(() => partitionStories(storiesStore.myStories, now.value));

function thumbStyle(story: Story): Record<string, string> {
  const { gradient } = getSportVisual(story.media.sport);

  return story.media.type === 'image' && story.media.url
    ? { background: `center / cover no-repeat url("${encodeURI(story.media.url)}"), ${gradient}` }
    : { background: gradient };
}

function untitled(story: Story): string {
  return story.media.type === 'video' ? 'Video story' : 'Photo story';
}

/** "Basketball · 🌎 Public · " before the time left / expiry. */
function details(story: Story): string {
  const parts = [story.media.sport];

  if (story.fromServer) {
    const privacy = getPrivacyOption(story.visibility ?? 'PUBLIC');
    parts.push(`${privacy.emoji} ${privacy.label}`);
  }

  return parts.filter((part) => part.length > 0).map((part) => `${part} · `).join('');
}

onMounted(() => {
  void storiesStore.load();
});
</script>

<style scoped>
.my-stories {
  padding: 16px 16px 32px;
}

.my-stories__section + .my-stories__section {
  margin-top: 28px;
}

.my-stories__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.my-stories__item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.my-stories__item--expired {
  opacity: 0.6;
}

.my-stories__thumb {
  width: 48px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 10px;
}

.my-stories__add {
  color: var(--ion-color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}

.my-stories__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  font-size: 0.88rem;
}

.my-stories__text span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.my-stories__note,
.my-stories__empty {
  margin: 0 0 12px;
  color: #7d8a93;
  font-size: 0.8rem;
}
</style>
