<template>
  <article class="post-card">
    <header class="post-card__header">
      <router-link :to="authorPath" class="post-card__avatar" :aria-label="`${post.author.displayName}'s profile`">
        <UserAvatar :user="post.author" :size="38" />
      </router-link>
      <span class="post-card__meta">
        <router-link :to="authorPath" class="post-card__author">{{ post.author.displayName }}</router-link>
        <router-link v-if="post.club" :to="`/clubs/${post.club.id}`" class="post-card__club">
          <ion-icon :icon="peopleCircleOutline" aria-hidden="true" />
          {{ post.club.name }}
        </router-link>
        <span>
          {{ post.sport }} · {{ formatTimeAgo(Date.parse(post.createdAt), nowMs) }}
          <template v-if="post.editedAt">· Edited</template>
          <ion-icon
            :icon="PRIVACY_ICONS[post.visibility]"
            role="img"
            :aria-label="`Visible to: ${privacy.label}`"
            :title="privacy.label"
          />
        </span>
      </span>
      <span v-if="post.isAnnouncement" class="post-card__announcement">
        <ion-icon :icon="megaphoneOutline" aria-hidden="true" />
        Announcement
      </span>
      <button
        v-if="isOwnPost"
        type="button"
        class="post-card__menu"
        :class="{ 'post-card__menu--solo': !post.isAnnouncement }"
        aria-label="Post options"
        @click="openOptions"
      >
        <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
      </button>
    </header>
    <template v-if="isOwnPost">
      <EditPostModal :post="isEditingPost ? post : null" @close="isEditingPost = false" />
      <EditPostPrivacyModal :post="isEditingPrivacy ? post : null" @close="isEditingPrivacy = false" />
      <TagPeopleModal
        :is-open="isEditingTags"
        :initial-ids="taggedIds"
        :save="saveTags"
        @close="isEditingTags = false"
      />
    </template>

    <p v-if="post.body" class="post-card__body">{{ post.body }}</p>

    <p v-if="tagSummary.shown.length > 0" class="post-card__with">
      with
      <span v-for="(person, index) in tagSummary.shown" :key="person.id"
        ><router-link :to="profilePath(person.username)" class="post-card__tag">{{ person.displayName }}</router-link
        >{{ tagSeparator(index) }}</span
      >
    </p>
    <router-link
      v-if="post.location"
      :to="locationMapPath(post.location)"
      class="post-card__location"
      :aria-label="`Location: ${post.location.name}. Open map`"
    >
      <span aria-hidden="true">📍</span> {{ post.location.name }}
    </router-link>

    <div
      v-if="availableMedia.length > 0"
      class="post-card__media"
      :class="`post-card__media--${Math.min(availableMedia.length, MEDIA_PREVIEW_LIMIT)}`"
    >
      <div v-for="(item, index) in visibleMedia" :key="item.id" class="post-card__photo">
        <video
          v-if="item.type === 'video' && item.url"
          :src="item.url"
          :aria-label="`Video ${index + 1} from ${post.author.displayName}`"
          controls
          playsinline
          preload="metadata"
          @error="failedMedia.add(item.id)"
        />
        <button
          v-else
          type="button"
          class="post-card__open-photo"
          :aria-label="`Open photo ${index + 1}`"
          @click="galleryOpen = true"
        >
          <img
            :src="item.url ?? undefined"
            :alt="`Photo ${index + 1} from ${post.author.displayName}`"
            loading="lazy"
            @error="failedMedia.add(item.id)"
          />
        </button>
        <span v-if="index === visibleMedia.length - 1 && hiddenMediaCount > 0" class="post-card__more">
          +{{ hiddenMediaCount }}
        </span>
      </div>
    </div>

    <ion-modal :is-open="galleryOpen" @did-dismiss="galleryOpen = false">
      <ion-header
        ><ion-toolbar
          ><ion-title>Photos</ion-title
          ><ion-buttons slot="end"
            ><ion-button @click="galleryOpen = false">Close</ion-button></ion-buttons
          ></ion-toolbar
        ></ion-header
      >
      <ion-content>
        <div class="post-card__gallery">
          <img
            v-for="(item, index) in availableMedia.filter((photo) => photo.type === 'image')"
            :key="item.id"
            :src="item.url ?? undefined"
            :alt="`Photo ${index + 1} from ${post.author.displayName}`"
            loading="lazy"
          />
        </div>
      </ion-content>
    </ion-modal>

    <footer class="post-card__actions">
      <button
        type="button"
        class="post-card__action"
        :class="{ 'post-card__action--liked': post.likedByViewer }"
        :aria-pressed="post.likedByViewer"
        @click="emit('like', post)"
      >
        <ion-icon :icon="post.likedByViewer ? heart : heartOutline" aria-hidden="true" />
        {{ formatCompactNumber(post.likes) }}
        <span class="sr-only">Like</span>
      </button>
      <button type="button" class="post-card__action" @click="emit('comment', post)">
        <ion-icon :icon="chatbubbleOutline" aria-hidden="true" />
        {{ formatCompactNumber(post.comments) }}
        <span class="sr-only">Comment</span>
      </button>
      <button type="button" class="post-card__action" @click="emit('share', post)">
        <ion-icon :icon="arrowRedoOutline" aria-hidden="true" />
        {{ formatCompactNumber(post.shares) }}
        <span class="sr-only">Share</span>
      </button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  IonIcon,
  IonModal,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  actionSheetController,
  alertController,
} from '@ionic/vue';
import {
  arrowRedoOutline,
  chatbubbleOutline,
  createOutline,
  earthOutline,
  ellipsisHorizontal,
  heart,
  heartOutline,
  lockClosedOutline,
  megaphoneOutline,
  peopleCircleOutline,
  peopleOutline,
  personAddOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';
import { RouterLink } from 'vue-router';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useFriendsStore } from '@/stores/friends';
import { usePostsStore } from '@/stores/posts';
import type { FeedPost, PostVisibility } from '@/types/post';
import { locationMapPath } from '@/utils/location-map';
import { showNotice } from '@/utils/notice';
import { summarizeTags, visibleTags } from '@/utils/post-details';
import { getPrivacyOption } from '@/utils/post-privacy';
import { userProfilePath } from '@/utils/profile-links';
import { formatCompactNumber, formatTimeAgo } from '@/utils/time';
import EditPostModal from './EditPostModal.vue';
import EditPostPrivacyModal from './EditPostPrivacyModal.vue';
import TagPeopleModal from './TagPeopleModal.vue';

const MEDIA_PREVIEW_LIMIT = 4;

const PRIVACY_ICONS: Record<PostVisibility, string> = {
  PUBLIC: earthOutline,
  FRIENDS: peopleOutline,
  CUSTOM: settingsOutline,
  ONLY_ME: lockClosedOutline,
};

const props = defineProps<{ post: FeedPost; nowMs: number }>();
const emit = defineEmits<{ like: [post: FeedPost]; comment: [post: FeedPost]; share: [post: FeedPost] }>();

const friendsStore = useFriendsStore();
const postsStore = usePostsStore();
const isEditingPost = ref(false);
const isEditingPrivacy = ref(false);
const isEditingTags = ref(false);
const galleryOpen = ref(false);

/** Only the indicator is shown; the list of custom viewers never appears on the card. */
const privacy = computed(() => getPrivacyOption(props.post.visibility));
const isOwnPost = computed(() => postsStore.me?.id === props.post.author.id);
const authorPath = computed(() => profilePath(props.post.author.username));

const tags = computed(() => visibleTags(props.post.tags, friendsStore.blockedIdSet));
const taggedIds = computed(() => (props.post.tags ?? []).map((person) => person.id));
const tagSummary = computed(() => summarizeTags(tags.value));

function profilePath(username: string): string {
  return userProfilePath(username, postsStore.me?.username);
}

/** "A, B and 3 others" / "A, B, C": commas between names, "and" only before the others count. */
function tagSeparator(index: number): string {
  const { shown, othersCount } = tagSummary.value;

  if (index < shown.length - 1) {
    return ', ';
  }

  return othersCount > 0 ? ` and ${othersCount} ${othersCount === 1 ? 'other' : 'others'}` : '';
}

async function saveTags(ids: string[]): Promise<string | null> {
  const error = await postsStore.updateTags(props.post.id, ids);

  if (!error) {
    void showNotice(
      ids.length === 0 ? 'Tags removed.' : `Tagged ${ids.length} ${ids.length === 1 ? 'person' : 'people'}.`,
    );
  }

  return error;
}

async function openOptions(): Promise<void> {
  const sheet = await actionSheetController.create({
    header: 'Post options',
    cssClass: 'gora-sheet',
    buttons: [
      { text: 'Edit post', icon: createOutline, handler: () => void (isEditingPost.value = true) },
      {
        text: 'Edit privacy',
        icon: PRIVACY_ICONS[props.post.visibility],
        handler: () => void (isEditingPrivacy.value = true),
      },
      {
        text: taggedIds.value.length > 0 ? 'Edit tags' : 'Tag people',
        icon: personAddOutline,
        handler: () => void (isEditingTags.value = true),
      },
      { text: 'Delete post', icon: trashOutline, role: 'destructive', handler: () => void confirmDelete() },
      { text: 'Cancel', role: 'cancel' },
    ],
  });

  await sheet.present();
}

async function confirmDelete(): Promise<void> {
  const alert = await alertController.create({
    header: 'Delete post?',
    message: 'This post will be removed from your profile and from every feed.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Delete', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    return;
  }

  const error = await postsStore.deletePost(props.post.id);
  void showNotice(error ?? 'Post deleted.');
}

const failedMedia = ref(new Set<string>());
watch(() => props.post.media, () => { failedMedia.value = new Set(); });
const availableMedia = computed(() => props.post.media.filter((item) => item.url && !failedMedia.value.has(item.id)));
const visibleMedia = computed(() => availableMedia.value.slice(0, MEDIA_PREVIEW_LIMIT));
const hiddenMediaCount = computed(() => availableMedia.value.length - visibleMedia.value.length);
</script>

<style scoped>
.post-card__open-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  border: 0;
  padding: 0;
  cursor: zoom-in;
}
.post-card__gallery {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.post-card__gallery img {
  display: block;
  width: 100%;
  max-height: 80vh;
  object-fit: contain;
}
.post-card__more {
  pointer-events: none;
}
.post-card {
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  box-shadow: var(--gora-shadow);
}

.post-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 0;
}

.post-card__meta {
  display: flex;
  flex-direction: column;
  font-size: 0.88rem;
}

.post-card__avatar {
  display: flex;
  border-radius: 50%;
  color: inherit;
  text-decoration: none;
}

.post-card__author {
  color: inherit;
  font-weight: 700;
  text-decoration: none;
}

.post-card__author:hover {
  text-decoration: underline;
}

.post-card__menu {
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font-size: 20px;
}

.post-card__menu--solo {
  margin-left: auto;
}

.post-card__menu:hover {
  background: var(--gora-line);
}

.post-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--gora-muted);
  font-size: 0.72rem;
}

.post-card__meta .post-card__club {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-primary);
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
}

.post-card__announcement {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.14);
  color: var(--ion-color-primary);
  font-size: 0.66rem;
  font-weight: 700;
}

.post-card__body {
  margin: 10px 14px 0;
  font-size: 0.92rem;
  line-height: 1.45;
  white-space: pre-line;
}

.post-card__with {
  margin: 6px 14px 0;
  color: var(--gora-muted);
  font-size: 0.82rem;
}

.post-card__tag {
  color: var(--ion-text-color);
  font-weight: 600;
  text-decoration: none;
}

.post-card__tag:hover,
.post-card__location:hover {
  text-decoration: underline;
}

.post-card__location {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 4px 14px 0;
  color: var(--ion-color-primary);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}

.post-card__media {
  display: grid;
  gap: 2px;
  margin-top: 12px;
}

.post-card__media--1 {
  grid-template-columns: 1fr;
}

.post-card__media--2,
.post-card__media--4 {
  grid-template-columns: 1fr 1fr;
}

.post-card__media--3 {
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.post-card__media--3 .post-card__photo:first-child {
  grid-row: span 2;
}

.post-card__photo {
  position: relative;
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #0f1f2f;
}

.post-card__media--1 .post-card__photo {
  aspect-ratio: 16 / 10;
  max-height: 420px;
}

.post-card__media--2 .post-card__photo,
.post-card__media--4 .post-card__photo {
  aspect-ratio: 1;
}

.post-card__photo img,
.post-card__photo video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-card__more {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 1.3rem;
  font-weight: 700;
}

.post-card__actions {
  display: flex;
  gap: 6px;
  margin: 14px 14px 0;
  padding: 8px 0 10px;
  border-top: 1px solid var(--gora-line);
}

.post-card__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.post-card__action ion-icon {
  font-size: 18px;
}

.post-card__action--liked {
  color: #ff5a79;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
