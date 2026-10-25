<template>
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    class="tag-people-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="tag-people-content">
      <form class="tag-people" @submit.prevent="submit">
        <h2 class="tag-people__title">👤 Tag people</h2>
        <p class="tag-people__hint">Tagged people appear as “with …” on the post. Tagging does not change who can see it.</p>
        <PeoplePicker v-model="taggedUserIds" title="Who were you with?" :max="POST_TAGS_MAX" />
        <p v-if="error" class="tag-people__error" role="alert">{{ error }}</p>
        <button type="submit" class="tag-people__save" :disabled="isSaving">Done</button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonContent, IonModal } from '@ionic/vue';
import { POST_TAGS_MAX } from '@/utils/post-details';
import PeoplePicker from './PeoplePicker.vue';

const props = defineProps<{
  isOpen: boolean;
  initialIds: readonly string[];
  /** Returns an error message to show, or null when the tags were saved. */
  save: (taggedUserIds: string[]) => Promise<string | null>;
}>();
const emit = defineEmits<{ close: [] }>();

const taggedUserIds = ref<string[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      taggedUserIds.value = [...props.initialIds];
      error.value = null;
    }
  },
  { immediate: true },
);

async function submit(): Promise<void> {
  isSaving.value = true;

  try {
    error.value = await props.save([...taggedUserIds.value]);

    if (!error.value) {
      emit('close');
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.tag-people-modal {
  --background: var(--gora-surface);
  --border-radius: 24px;
}

.tag-people-content {
  --background: var(--gora-surface);
}

.tag-people {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom));
}

.tag-people__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.tag-people__hint {
  margin: 0;
  color: var(--gora-muted);
  font-size: 0.78rem;
}

.tag-people__error {
  margin: 0;
  color: #ff7a7a;
  font-size: 0.82rem;
}

.tag-people__save {
  padding: 13px;
  border: 0;
  border-radius: 999px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.tag-people__save:disabled {
  opacity: 0.6;
}
</style>
