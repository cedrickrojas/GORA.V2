<template>
  <ion-page>
    <SubPageHeader :title="shareSourceId || shareGameId ? 'Share as post' : 'Create Post'" back-href="/home">
      <template #end>
        <button type="button" class="create-post__publish" :disabled="!canPublish || isPublishing" @click="publish">
          {{ sharedSource || sharedGame ? 'Share' : 'Post' }}
        </button>
      </template>
    </SubPageHeader>

    <ion-content>
      <form class="create-post" @submit.prevent="publish">
        <fieldset class="create-post__fields" :disabled="isPublishing">
          <div v-if="author" class="create-post__author">
            <UserAvatar :user="author" :size="42" />
            <span class="create-post__author-meta">
              <strong>{{ author.displayName }}</strong>
              <span class="create-post__privacy">{{ privacy.emoji }} {{ privacy.label }}</span>
            </span>
          </div>

          <article v-if="sharedSource" class="create-post__shared-source" aria-label="Post you are sharing">
            <span>Shared post preview</span>
            <strong>{{ sharedSource.author.displayName }}</strong>
            <p>{{ sharedSource.body || 'Photo or video post' }}</p>
            <img
              v-if="sharedSource.media.find((item) => item.type === 'image' && item.url)?.url"
              :src="sharedSource.media.find((item) => item.type === 'image' && item.url)?.url ?? undefined"
              :alt="`Media from ${sharedSource.author.displayName}'s post`"
            />
            <router-link :to="`/posts/${encodeURIComponent(sharedSource.id)}`">View original post</router-link>
          </article>
          <article v-else-if="sharedGame" class="create-post__shared-source" aria-label="Game you are sharing">
            <span>GORA game</span>
            <strong>{{ sharedGame.title }}</strong>
            <p>{{ sharedGame.sport }} · {{ sharedGame.locationName }} · {{ sharedGame.when }}</p>
            <router-link :to="`/games/${encodeURIComponent(sharedGame.id)}`">View game</router-link>
          </article>

          <label class="create-post__label" for="create-post-caption">{{ sharedSource || sharedGame ? 'Your caption (optional)' : 'Caption' }}</label>
          <textarea
            id="create-post-caption"
            v-model="caption"
            class="create-post__caption"
            rows="4"
            :maxlength="POST_CAPTION_MAX_LENGTH"
            :placeholder="sharedSource ? 'Add something about this post…' : sharedGame ? 'Add something about this game…' : 'How did the game go?'"
          />
          <span class="create-post__counter">{{ caption.length }}/{{ POST_CAPTION_MAX_LENGTH }}</span>

          <span class="create-post__label">Photos</span>
          <div class="create-post__photos">
            <div v-for="(photo, index) in photos" :key="photo.url" class="create-post__photo">
              <img :src="photo.url" :alt="`Selected photo ${index + 1}`" />
              <button
                type="button"
                class="create-post__remove"
                :aria-label="`Remove photo ${index + 1}`"
                @click="removePhoto(index)"
              >
                <ion-icon :icon="close" aria-hidden="true" />
              </button>
            </div>
            <label v-if="photos.length < POST_PHOTO_LIMIT" class="create-post__add">
              <ion-icon :icon="imagesOutline" aria-hidden="true" />
              <span>Add photos</span>
              <input type="file" accept="image/*" multiple class="create-post__file" @change="addPhotos" />
            </label>
          </div>
          <span class="create-post__counter"> {{ photos.length }}/{{ POST_PHOTO_LIMIT }} photos </span>
          <p v-if="photoError" class="create-post__error" role="alert">{{ photoError }}</p>

          <div class="create-post__extras">
            <button type="button" class="create-post__extra" @click="isTagging = true">
              <span aria-hidden="true">👤</span> Tag People
            </button>
            <button type="button" class="create-post__extra" @click="isPickingLocation = true">
              <span aria-hidden="true">📍</span> Add Location
            </button>
          </div>
          <div v-if="taggedPeople.length > 0 || location" class="create-post__chips">
            <span v-if="taggedPeople.length > 0" class="create-post__chip">
              with {{ taggedPeople.map((person) => person.displayName).join(', ') }}
              <button type="button" aria-label="Remove tags" @click="taggedUserIds = []">
                <ion-icon :icon="close" aria-hidden="true" />
              </button>
            </span>
            <span v-if="location" class="create-post__chip">
              📍 {{ location.name }}
              <button type="button" aria-label="Remove location" @click="location = null">
                <ion-icon :icon="close" aria-hidden="true" />
              </button>
            </span>
          </div>

          <label class="create-post__label" for="create-post-sport">Sport</label>
          <select id="create-post-sport" v-model="sport" class="create-post__select">
            <option v-for="option in sportOptions" :key="option" :value="option">{{ option }}</option>
          </select>

          <span class="create-post__label">Privacy</span>
          <PostAudiencePicker v-model:visibility="visibility" v-model:custom-viewer-ids="customViewerIds" />
          <p v-if="audienceError && visibility === 'CUSTOM'" class="create-post__hint">{{ audienceError }}</p>
          <p v-if="postsStore.publishError" class="create-post__error" role="alert">{{ postsStore.publishError }}</p>

          <button type="submit" class="create-post__submit" :disabled="!canPublish || isPublishing">
            {{ isPublishing ? 'Posting…' : sharedSource || sharedGame ? 'Share Post' : 'Publish' }}
          </button>
        </fieldset>
      </form>

      <TagPeopleModal :is-open="isTagging" :initial-ids="taggedUserIds" :save="setTags" @close="isTagging = false" />
      <LocationPickerModal
        :is-open="isPickingLocation"
        :current="location"
        @confirm="location = $event"
        @close="isPickingLocation = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonIcon, IonPage } from '@ionic/vue';
import { close, imagesOutline } from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import LocationPickerModal from '@/components/feed/LocationPickerModal.vue';
import PostAudiencePicker from '@/components/feed/PostAudiencePicker.vue';
import TagPeopleModal from '@/components/feed/TagPeopleModal.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useFriendsStore } from '@/stores/friends';
import { useGamesStore } from '@/stores/games';
import { usePostsStore } from '@/stores/posts';
import { useSessionStore } from '@/stores/session';
import { useSportsStore } from '@/stores/sports';
import type { FeedPost, PostDraft, PostLocation, PostVisibility } from '@/types/post';
import type { UserSummary } from '@/types/user';
import { POST_CAPTION_MAX_LENGTH, POST_PHOTO_LIMIT, canPublishPost } from '@/utils/feed';
import { showNotice } from '@/utils/notice';
import { validatePostTags } from '@/utils/post-details';
import { getPrivacyOption, validatePostAudience } from '@/utils/post-privacy';
import { POST_PHOTO_SOURCE_MAX_BYTES } from '@/utils/post-photos';
import { isServerId } from '@/utils/post-api';
import { formatGameDay, formatGameTimeRange } from '@/utils/game-form';

interface SelectedPhoto {
  url: string;
  file: File;
}

const router = useRouter();
const route = useRoute();
const session = useSessionStore();
const catalog = useCatalogStore();
const sportsStore = useSportsStore();
const friendsStore = useFriendsStore();
const gamesStore = useGamesStore();
const postsStore = usePostsStore();
/** Posts are written by the signed-in account, so they show on its Profile. */
const author = computed(() => postsStore.me);

const caption = ref('');
const sport = ref('');
const visibility = ref<PostVisibility>('PUBLIC');
const customViewerIds = ref<string[]>([]);
const taggedUserIds = ref<string[]>([]);
const location = ref<PostLocation | null>(null);
const photos = ref<SelectedPhoto[]>([]);
const photoError = ref<string | null>(null);
const isPublishing = ref(false);
const isTagging = ref(false);
const isPickingLocation = ref(false);
const sharedSource = ref<FeedPost | null>(null);
const shareSourceId = computed(() => (typeof route.query.sharePost === 'string' ? route.query.sharePost : ''));
const shareGameId = computed(() => (typeof route.query.shareGame === 'string' ? route.query.shareGame : ''));
const sharedGame = ref<{ id: string; title: string; sport: string; locationName: string; when: string } | null>(null);

/** Active sports from the API; the demo catalog only if that list could not load. */
const sportOptions = computed(() =>
  sportsStore.activeSports.length > 0
    ? sportsStore.activeSports.map((option) => option.name)
    : catalog.sports.map((option) => option.name),
);

const taggedPeople = computed<UserSummary[]>(() => {
  const people = new Map([...friendsStore.friends, ...catalog.players].map((person) => [person.id, person]));

  return taggedUserIds.value.flatMap((id) => people.get(id) ?? []);
});

async function setTags(ids: string[]): Promise<string | null> {
  const error = validatePostTags(ids, author.value?.id ?? null);

  if (!error) {
    taggedUserIds.value = ids;
  }

  return error;
}

watch(
  sportOptions,
  (options) => {
    if (sharedGame.value && options.includes(sharedGame.value.sport)) {
      sport.value = sharedGame.value.sport;
    } else if (!options.includes(sport.value) && options.length > 0) {
      sport.value = options[0];
    }
  },
  { immediate: true },
);

const draft = computed<PostDraft>(() => ({
  body: caption.value,
  ...(sharedSource.value ? { sharedPostId: sharedSource.value.id } : {}),
  sport: sport.value,
  visibility: visibility.value,
  // Kept while switching options, but only a CUSTOM post sends them.
  customViewerIds: visibility.value === 'CUSTOM' ? customViewerIds.value : [],
  taggedUserIds: taggedUserIds.value,
  location: location.value,
  photoUrls: photos.value.map((photo) => photo.url),
}));

async function loadSharedSource(id: string): Promise<void> {
  sharedSource.value = null;
  if (!id) return;
  if (!isServerId(id)) {
    void showNotice('This post can no longer be shared.');
    await router.replace('/create/post');
    return;
  }
  try {
    const source = await postsStore.loadPost(id);
    if (shareSourceId.value !== id) return;
    sharedSource.value = source;
    if (sportOptions.value.includes(source.sport)) sport.value = source.sport;
  } catch {
    if (shareSourceId.value !== id) return;
    void showNotice('This post is no longer available to share.');
    await router.replace('/create/post');
  }
}

watch(shareSourceId, (id) => void loadSharedSource(id), { immediate: true });

async function loadSharedGame(id: string): Promise<void> {
  sharedGame.value = null;
  if (!id) return;

  const title = typeof route.query.gameTitle === 'string' ? route.query.gameTitle : '';
  const gameSport = typeof route.query.gameSport === 'string' ? route.query.gameSport : '';
  const locationName = typeof route.query.gameLocation === 'string' ? route.query.gameLocation : '';
  const when = typeof route.query.gameWhen === 'string' ? route.query.gameWhen : '';

  if (title && gameSport && locationName && when) {
    sharedGame.value = { id, title, sport: gameSport, locationName, when };
  } else if (isServerId(id)) {
    const result = await gamesStore.fetchGame(id);
    const game = result.ok ? gamesStore.gameById(id) : null;
    if (!game || shareGameId.value !== id) {
      void showNotice('This game is no longer available to share.');
      await router.replace('/create/post');
      return;
    }
    sharedGame.value = {
      id,
      title: game.title,
      sport: game.sport.name,
      locationName: game.locationName,
      when: `${formatGameDay(game.gameDate)} · ${formatGameTimeRange(game.startTime, game.endTime)}`,
    };
  } else {
    void showNotice('This game is no longer available to share.');
    await router.replace('/create/post');
    return;
  }

  if (sportOptions.value.includes(sharedGame.value.sport)) sport.value = sharedGame.value.sport;
  if (!caption.value.trim()) {
    const url = new URL(`/games/${encodeURIComponent(id)}`, window.location.origin).href;
    caption.value = `Check out this ${sharedGame.value.sport} game: ${sharedGame.value.title}\n${sharedGame.value.locationName} · ${sharedGame.value.when}\n${url}`;
  }
}

watch(shareGameId, (id) => void loadSharedGame(id), { immediate: true });

const privacy = computed(() => getPrivacyOption(visibility.value));
const audienceError = computed(() =>
  validatePostAudience(draft.value.visibility, draft.value.customViewerIds, author.value?.id ?? null),
);
const canPublish = computed(() => author.value !== null && canPublishPost(draft.value, author.value.id));

function addPhotos(event: Event): void {
  const input = event.target as HTMLInputElement;
  const room = POST_PHOTO_LIMIT - photos.value.length;
  const selected = Array.from(input.files ?? []);
  const valid = selected.filter((file) => file.type.startsWith('image/') && file.size <= POST_PHOTO_SOURCE_MAX_BYTES);
  photoError.value =
    valid.length !== selected.length
      ? 'Choose images smaller than 20 MB.'
      : selected.length > room
        ? `You can add up to ${POST_PHOTO_LIMIT} photos.`
        : null;
  const files = valid.slice(0, room);

  photos.value = [...photos.value, ...files.map((file) => ({ url: URL.createObjectURL(file), file }))];
  input.value = '';
}

function removePhoto(index: number): void {
  const [removed] = photos.value.splice(index, 1);

  if (removed) {
    URL.revokeObjectURL(removed.url);
  }
}

function resetForm(): void {
  caption.value = '';
  visibility.value = 'PUBLIC';
  customViewerIds.value = [];
  taggedUserIds.value = [];
  location.value = null;
  photos.value.forEach((photo) => URL.revokeObjectURL(photo.url));
  photos.value = [];
  photoError.value = null;
}

async function publish(): Promise<void> {
  if (!canPublish.value || !author.value || isPublishing.value) {
    return;
  }

  isPublishing.value = true;

  try {
    const post = await postsStore.publish(
      author.value,
      draft.value,
      photos.value.map((photo) => photo.file),
    );

    if (post) {
      if (sharedSource.value) void postsStore.loadPost(sharedSource.value.id);
      resetForm();
      void showNotice(sharedSource.value || sharedGame.value ? 'Shared as a post on your feed.' : 'Posted to your feed.');
      await router.replace('/home');
    }
  } finally {
    isPublishing.value = false;
  }
}

onMounted(() => {
  void session.load();
  void catalog.load();
  void sportsStore.fetchSports();
  void friendsStore.load();
  void postsStore.load();
});

onBeforeUnmount(() => {
  photos.value.forEach((photo) => URL.revokeObjectURL(photo.url));
});
</script>

<style scoped>
.create-post__fields {
  display: contents;
}
.create-post {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 40px;
}

.create-post__author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.create-post__author-meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.create-post__shared-source {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--gora-line);
  border-radius: 14px;
  background: var(--gora-surface);
}

.create-post__shared-source > span {
  color: var(--gora-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.create-post__shared-source p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--gora-muted);
  font-size: 0.84rem;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.create-post__shared-source img {
  max-height: 220px;
  width: 100%;
  border-radius: 8px;
  object-fit: cover;
}

.create-post__shared-source a {
  color: var(--ion-color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}

.create-post__privacy {
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.create-post__hint {
  margin: 0;
  color: #ffb45c;
  font-size: 0.75rem;
}

.create-post__note {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.8rem;
}

.create-post__error {
  margin: 8px 0 0;
  color: #ff7a7a;
  font-size: 0.82rem;
}

.create-post__label {
  margin-top: 10px;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.create-post__caption,
.create-post__select {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.92rem;
}

.create-post__caption {
  resize: vertical;
}

.create-post__counter {
  align-self: flex-end;
  color: #7d8a93;
  font-size: 0.7rem;
}

.create-post__photos {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.create-post__photo,
.create-post__add {
  position: relative;
  display: flex;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12px;
}

.create-post__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.create-post__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
}

.create-post__add {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed var(--gora-line-strong);
  color: var(--ion-color-primary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.create-post__add ion-icon {
  font-size: 26px;
}

.create-post__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.create-post__extras {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.create-post__extra {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 999px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
}

.create-post__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.create-post__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 12px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 600;
}

.create-post__chip button {
  display: flex;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.create-post__publish {
  margin-right: 8px;
  padding: 6px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
}

.create-post__submit {
  margin-top: 18px;
  padding: 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.create-post__publish:disabled,
.create-post__submit:disabled {
  background: #1b2a37;
  color: #7d8a93;
  cursor: default;
}
</style>
