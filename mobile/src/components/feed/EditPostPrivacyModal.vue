<template>
  <ion-modal
    :is-open="post !== null"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    class="edit-privacy-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="edit-privacy-content">
      <form class="edit-privacy" @submit.prevent="save">
        <h2 class="edit-privacy__title">Who can see this post?</h2>
        <PostAudiencePicker v-model:visibility="visibility" v-model:custom-viewer-ids="customViewerIds" />
        <p v-if="error" class="edit-privacy__error" role="alert">{{ error }}</p>
        <button type="submit" class="edit-privacy__save" :disabled="isSaving">Save</button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonContent, IonModal } from '@ionic/vue';
import { usePostsStore } from '@/stores/posts';
import type { FeedPost, PostVisibility } from '@/types/post';
import { getPrivacyOption } from '@/utils/post-privacy';
import { showNotice } from '@/utils/notice';
import PostAudiencePicker from './PostAudiencePicker.vue';

const props = defineProps<{ post: FeedPost | null }>();
const emit = defineEmits<{ close: [] }>();

const postsStore = usePostsStore();
const visibility = ref<PostVisibility>('PUBLIC');
const customViewerIds = ref<string[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.post,
  (post) => {
    if (post) {
      visibility.value = post.visibility;
      customViewerIds.value = [...(post.customViewerIds ?? [])];
      error.value = null;
    }
  },
  { immediate: true },
);

async function save(): Promise<void> {
  if (!props.post) {
    return;
  }

  isSaving.value = true;

  try {
    const ids = visibility.value === 'CUSTOM' ? customViewerIds.value : [];
    error.value = await postsStore.updateVisibility(props.post.id, visibility.value, ids);

    if (!error.value) {
      void showNotice(`Now visible to: ${getPrivacyOption(visibility.value).label}.`);
      emit('close');
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.edit-privacy-modal {
  --background: var(--gora-surface);
  --border-radius: 24px;
}

.edit-privacy-content {
  --background: var(--gora-surface);
}

.edit-privacy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom));
}

.edit-privacy__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.edit-privacy__error {
  margin: 0;
  color: #ff7a7a;
  font-size: 0.82rem;
}

.edit-privacy__save {
  padding: 13px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.edit-privacy__save:disabled {
  opacity: 0.6;
}
</style>
