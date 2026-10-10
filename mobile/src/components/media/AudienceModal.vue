<template>
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    class="media-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="media-modal__content">
      <form class="media-modal__form" @submit.prevent="submit">
        <h2 class="media-modal__title">{{ title }}</h2>
        <PostAudiencePicker v-model:visibility="draftVisibility" v-model:custom-viewer-ids="draftViewerIds" />
        <p v-if="error" class="media-modal__error" role="alert">{{ error }}</p>
        <button type="submit" class="media-modal__save" :disabled="isSaving">Save</button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonContent, IonModal } from '@ionic/vue';
import PostAudiencePicker from '@/components/feed/PostAudiencePicker.vue';
import type { PostVisibility } from '@/types/post';
import { getPrivacyOption } from '@/utils/post-privacy';
import { showNotice } from '@/utils/notice';

const props = defineProps<{
  isOpen: boolean;
  title: string;
  visibility: PostVisibility;
  customViewerIds: readonly string[];
  save: (visibility: PostVisibility, customViewerIds: string[]) => Promise<string | null>;
}>();
const emit = defineEmits<{ close: [] }>();

const draftVisibility = ref<PostVisibility>('PUBLIC');
const draftViewerIds = ref<string[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      draftVisibility.value = props.visibility;
      draftViewerIds.value = [...props.customViewerIds];
      error.value = null;
    }
  },
  { immediate: true },
);

async function submit(): Promise<void> {
  isSaving.value = true;

  try {
    const ids = draftVisibility.value === 'CUSTOM' ? draftViewerIds.value : [];
    error.value = await props.save(draftVisibility.value, ids);

    if (!error.value) {
      void showNotice(`Now visible to: ${getPrivacyOption(draftVisibility.value).label}.`);
      emit('close');
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped src="./media-modal.css"></style>
