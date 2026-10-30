<template>
  <ion-modal :is-open="isOpen" class="reel-comments-modal" @did-dismiss="emit('close')">
    <section class="reel-comments">
      <header class="reel-comments__header">
        <h2>Comments <span>{{ comments.length }}</span></h2>
        <button type="button" aria-label="Close comments" @click="emit('close')">×</button>
      </header>
      <div class="reel-comments__list">
        <p v-if="loading" class="reel-comments__empty">Loading comments…</p>
        <p v-else-if="error" class="reel-comments__empty" role="alert">{{ error }}</p>
        <p v-else-if="comments.length === 0" class="reel-comments__empty">Be the first to comment.</p>
        <article v-for="comment in comments" :key="comment.id" class="reel-comments__item">
          <UserAvatar :user="comment.author" :size="36" />
          <div><strong>{{ comment.author.displayName }}</strong><p>{{ comment.content }}</p></div>
        </article>
      </div>
      <form class="reel-comments__composer" @submit.prevent="submit">
        <input v-model="draft" maxlength="2200" placeholder="Write a comment…" :disabled="sending" />
        <button type="submit" :disabled="!draft.trim() || sending">{{ sending ? '…' : 'Send' }}</button>
      </form>
    </section>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonModal } from '@ionic/vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { addReelComment, listReelComments } from '@/services/reels-api.service';
import { useAuthStore } from '@/stores/auth';
import { useReelsStore } from '@/stores/reels';
import { createAuthorizedCall, describeContentError } from '@/stores/authorized';
import type { ApiPostComment } from '@/types/post';
import type { UserSummary } from '@/types/user';
import { toUserSummary } from '@/utils/display-name';

const props = defineProps<{ isOpen: boolean; reelId: string | null }>();
const emit = defineEmits<{ close: [] }>();
const auth = useAuthStore();
const reelsStore = useReelsStore();
const authorized = createAuthorizedCall(auth);
const comments = ref<Array<Omit<ApiPostComment, 'author'> & { author: UserSummary }>>([]);
const draft = ref('');
const loading = ref(false);
const sending = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  if (!props.reelId) return;
  loading.value = true;
  error.value = null;
  try {
    const page = await authorized((token) => listReelComments(token, props.reelId!));
    comments.value = page.comments.map((comment) => ({ ...comment, author: toUserSummary(comment.author) }));
  } catch (caught) {
    error.value = describeContentError(caught, 'Could not load comments.');
  } finally {
    loading.value = false;
  }
}

async function submit(): Promise<void> {
  const content = draft.value.trim();
  if (!content || !props.reelId || sending.value) return;
  sending.value = true;
  error.value = null;
  try {
    const result = await authorized((token) => addReelComment(token, props.reelId!, content));
    comments.value = [
      { ...result.comment, author: toUserSummary(result.comment.author) },
      ...comments.value,
    ];
    reelsStore.syncReel(result.reel);
    draft.value = '';
  } catch (caught) {
    error.value = describeContentError(caught, 'Could not post your comment.');
  } finally {
    sending.value = false;
  }
}

watch(() => [props.isOpen, props.reelId] as const, ([open]) => {
  if (open) void load();
});
</script>

<style scoped>
.reel-comments-modal { --width: min(100%, 520px); --height: min(78dvh, 620px); --border-radius: 20px; --background: #1c1d20; }
.reel-comments { display: flex; height: 100%; flex-direction: column; color: var(--ion-text-color); }
.reel-comments__header { display: flex; align-items: center; justify-content: space-between; padding: 18px; border-bottom: 1px solid var(--gora-line); }
.reel-comments__header h2 { margin: 0; font-size: 1rem; }
.reel-comments__header h2 span { color: var(--gora-muted); font-size: 0.8rem; }
.reel-comments__header button { border: 0; background: transparent; color: inherit; font-size: 28px; cursor: pointer; }
.reel-comments__list { flex: 1; overflow: auto; padding: 10px 18px; }
.reel-comments__item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; }
.reel-comments__item strong { font-size: 0.85rem; }
.reel-comments__item p { margin: 4px 0 0; overflow-wrap: anywhere; font-size: 0.9rem; }
.reel-comments__empty { padding: 24px 0; color: var(--gora-muted); text-align: center; }
.reel-comments__composer { display: flex; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--gora-line); }
.reel-comments__composer input { min-width: 0; flex: 1; padding: 11px 14px; border: 1px solid var(--gora-line); border-radius: 999px; background: var(--gora-surface); color: inherit; font: inherit; }
.reel-comments__composer button { padding: 0 14px; border: 0; border-radius: 999px; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-weight: 700; cursor: pointer; }
.reel-comments__composer button:disabled { opacity: 0.5; }
</style>
