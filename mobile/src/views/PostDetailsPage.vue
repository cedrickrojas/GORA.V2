<template>
  <ion-page ref="pageRef" :style="{ bottom: `${keyboardInset}px` }">
    <SubPageHeader title="Post" back-href="/home" />
    <ion-content ref="contentRef">
      <main class="post-details">
        <p v-if="loading" role="status">Loading post…</p>
        <template v-else-if="post && !error">
          <PostCard :post="post" :now-ms="now" @like="likePost" @comment="focusComments" @share="sharePost" />
          <section id="comments" class="post-comments" aria-labelledby="comments-heading">
            <h2 id="comments-heading">
              Comments <span>{{ post.comments }}</span>
            </h2>
            <p class="post-comments__hint">Newest first</p>
            <button type="button" class="post-comments__more" :disabled="commentsLoading" @click="load">
              Refresh comments
            </button>
            <p v-if="commentsLoading" role="status">Loading comments…</p>
            <p v-else-if="!comments.length && !commentsError" class="post-comments__hint">Be the first to comment.</p>
            <p v-if="commentsError" role="alert">
              {{ commentsError }} <button type="button" @click="loadComments(false)">Try again</button>
            </p>
            <ol class="post-comments__list">
              <li v-for="comment in comments" :key="comment.id" class="post-comment">
                <router-link :to="`/profile/${comment.author.username}`"
                  ><UserAvatar :user="toUserSummary(comment.author)" :size="34"
                /></router-link>
                <div class="post-comment__body">
                  <router-link :to="`/profile/${comment.author.username}`">{{
                    toUserSummary(comment.author).displayName
                  }}</router-link>
                  <p>{{ comment.content }}</p>
                  <small>{{ formatTimeAgo(Date.parse(comment.createdAt), now) }}</small>
                </div>
                <button
                  v-if="canDelete(comment)"
                  type="button"
                  class="post-comment__delete"
                  :disabled="busyComment !== null"
                  aria-label="Delete comment"
                  @click="remove(comment)"
                >
                  <ion-icon :icon="trashOutline" aria-hidden="true" />
                </button>
              </li>
            </ol>
            <button
              v-if="nextCursor"
              type="button"
              class="post-comments__more"
              :disabled="commentsLoading"
              @click="loadComments(true)"
            >
              Load more comments
            </button>
          </section>
        </template>
        <p v-if="error" role="alert">{{ error }} <button type="button" class="post-comments__more" @click="load">Try again</button></p>
      </main>
    </ion-content>
    <ion-footer v-if="post && !loading && !error" class="ion-no-border">
      <p v-if="sendError" class="post-details__error" role="alert">{{ sendError }}</p>
      <ChatComposer
        ref="composerRef"
        v-model="draft"
        label="Comment"
        placeholder="Write a comment…"
        :max-length="2200"
        :sending="sending"
        @send="send"
        @focus="showComments"
      />
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonContent,
  IonFooter,
  IonIcon,
  IonPage,
  alertController,
  onIonViewWillEnter,
  onIonViewDidLeave,
} from '@ionic/vue';
import { trashOutline } from 'ionicons/icons';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import PostCard from '@/components/feed/PostCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useChatKeyboard } from '@/composables/useChatKeyboard';
import { usePostActions } from '@/composables/usePostActions';
import { addPostComment, deletePostComment, listPostComments } from '@/services/posts-api.service';
import { useAuthStore } from '@/stores/auth';
import { captureSession, createAuthorizedCall, describeContentError } from '@/stores/authorized';
import { usePostsStore, POST_UNAVAILABLE_MESSAGE } from '@/stores/posts';
import type { ApiPostComment } from '@/types/post';
import { toUserSummary } from '@/utils/display-name';
import { toFeedPost } from '@/utils/post-api';
import { formatTimeAgo } from '@/utils/time';

const route = useRoute();
const auth = useAuthStore();
const posts = usePostsStore();
const authorized = createAuthorizedCall(auth);
const { likePost, sharePost } = usePostActions();
const postId = computed(() => String(route.params.postId ?? ''));
const post = computed(() => posts.findPost(postId.value));
const pageRef = ref<InstanceType<typeof IonPage> | null>(null);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null);
const { keyboardInset } = useChatKeyboard(pageRef, () => { void showComments(); });
const comments = ref<ApiPostComment[]>([]);
const nextCursor = ref<string | null>(null);
const draft = ref('');
const loading = ref(true);
const commentsLoading = ref(false);
const sending = ref(false);
const error = ref<string | null>(null);
const commentsError = ref<string | null>(null);
const sendError = ref<string | null>(null);
const busyComment = ref<string | null>(null);
const now = ref(Date.now());
let generation = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const describe = (caught: unknown) => describeContentError(caught, POST_UNAVAILABLE_MESSAGE);

async function load(): Promise<void> {
  if (route.name !== 'post-details') return;
  const version = ++generation;
  const isCurrent = captureSession(auth);
  comments.value = [];
  nextCursor.value = null;
  commentsLoading.value = false;
  sending.value = false;
  busyComment.value = null;
  loading.value = true;
  error.value = null;
  try {
    await posts.loadPost(postId.value);
    if (version !== generation || !isCurrent()) return;
    await loadComments(false);
  } catch (caught) {
    if (version === generation && isCurrent()) error.value = describe(caught);
  } finally {
    if (version === generation && isCurrent()) {
      loading.value = false;
      if (route.hash === '#comments' && !error.value) {
        await showComments();
      }
    }
  }
}

async function loadComments(more: boolean): Promise<void> {
  if (commentsLoading.value) return;
  const version = generation;
  commentsLoading.value = true;
  commentsError.value = null;
  try {
    const page = await authorized((token) =>
      listPostComments(token, postId.value, more ? (nextCursor.value ?? undefined) : undefined),
    );
    if (version !== generation) return;
    comments.value = [
      ...new Map([...(more ? comments.value : []), ...page.comments].map((comment) => [comment.id, comment])).values(),
    ];
    nextCursor.value = page.nextCursor;
  } catch (caught) {
    if (version === generation) commentsError.value = describe(caught);
  } finally {
    if (version === generation) commentsLoading.value = false;
  }
}

async function focusComments(): Promise<void> {
  await nextTick();
  composerRef.value?.$el.querySelector('textarea')?.focus();
  await showComments();
}

async function showComments(): Promise<void> {
  await nextTick();
  const element = contentRef.value?.$el.querySelector('#comments') as HTMLElement | null;
  element?.scrollIntoView({ block: 'start' });
}

async function send(): Promise<void> {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  const original = draft.value;
  const version = generation;
  sending.value = true;
  sendError.value = null;
  try {
    const result = await authorized((token) => addPostComment(token, postId.value, content));
    if (version !== generation) return;
    posts.rememberProfilePosts([toFeedPost(result.post)]);
    comments.value = [result.comment, ...comments.value];
    if (draft.value === original) draft.value = '';
  } catch (caught) {
    if (version === generation) sendError.value = describe(caught);
  } finally {
    if (version === generation) sending.value = false;
  }
}

function canDelete(comment: ApiPostComment): boolean {
  return comment.author.id === auth.currentUser?.id || post.value?.author.id === auth.currentUser?.id;
}

async function remove(comment: ApiPostComment): Promise<void> {
  if (busyComment.value) return;
  const id = postId.value;
  const version = generation;
  const alert = await alertController.create({
    header: 'Delete comment?',
    message: 'This comment will be removed from the post.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Delete', role: 'destructive' },
    ],
  });
  await alert.present();
  if ((await alert.onDidDismiss()).role !== 'destructive' || version !== generation) return;
  busyComment.value = comment.id;
  try {
    const updated = await authorized((token) => deletePostComment(token, id, comment.id));
    if (version !== generation) return;
    posts.rememberProfilePosts([toFeedPost(updated)]);
    comments.value = comments.value.filter((item) => item.id !== comment.id);
  } catch (caught) {
    if (version === generation) sendError.value = describe(caught);
  } finally {
    if (version === generation) busyComment.value = null;
  }
}

function stop(): void {
  clearInterval(timer);
}
onIonViewWillEnter(() => {
  void load();
  stop();
  timer = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});
onIonViewDidLeave(stop);
onBeforeUnmount(stop);
watch(postId, () => {
  draft.value = '';
  if (route.name === 'post-details') void load();
});
watch(
  () => auth.sessionVersion,
  () => {
    generation++;
    comments.value = [];
    nextCursor.value = null;
    draft.value = '';
    loading.value = false;
    commentsLoading.value = false;
    sending.value = false;
    busyComment.value = null;
    error.value = null;
    sendError.value = null;
    commentsError.value = null;
  },
  { flush: 'sync' },
);
</script>

<style scoped>
.post-details {
  max-width: var(--gora-column, 680px);
  margin: 0 auto;
  padding: 16px 12px 30px;
}
.post-comments {
  padding: 20px 4px;
}
.post-comments h2 {
  margin: 0;
  font-size: 1.1rem;
}
.post-comments h2 span,
.post-comments__hint {
  color: var(--gora-muted);
}
.post-comments__hint {
  font-size: 0.8rem;
}
.post-comments__list {
  display: grid;
  gap: 16px;
  margin: 20px 0;
  padding: 0;
  list-style: none;
}
.post-comment {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.post-comment__body {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--gora-surface);
  overflow-wrap: anywhere;
}
.post-comment__body a {
  color: inherit;
  font-weight: 700;
  text-decoration: none;
  font-size: 0.84rem;
}
.post-comment__body p {
  margin: 6px 0;
  white-space: pre-wrap;
  line-height: 1.45;
}
.post-comment__body small {
  color: var(--gora-muted);
}
.post-comment__delete,
.post-comments__more {
  border: 0;
  border-radius: 12px;
  padding: 10px;
  background: var(--gora-surface);
  color: var(--gora-muted);
  cursor: pointer;
}
.post-details__error {
  max-width: var(--gora-column, 680px);
  margin: 0 auto;
  padding: 8px 12px;
  color: #ff8585;
}
</style>
