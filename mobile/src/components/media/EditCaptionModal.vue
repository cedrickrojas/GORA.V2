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

        <label class="media-modal__label" for="edit-caption-text">Caption</label>
        <textarea
          id="edit-caption-text"
          v-model="draftCaption"
          class="media-modal__input"
          rows="4"
          :maxlength="maxLength"
          placeholder="Write a caption (optional)"
        />
        <span class="media-modal__counter">{{ draftCaption.length }}/{{ maxLength }}</span>

        <template v-if="sport !== undefined">
          <label class="media-modal__label" for="edit-caption-sport">Sport</label>
          <select id="edit-caption-sport" v-model="draftSport" class="media-modal__input">
            <option value="">No sport</option>
            <option v-for="option in sportsStore.activeSports" :key="option.id" :value="option.name">
              {{ option.name }}
            </option>
          </select>
        </template>

        <p v-if="error" class="media-modal__error" role="alert">{{ error }}</p>
        <button type="submit" class="media-modal__save" :disabled="isSaving">Save</button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonContent, IonModal } from '@ionic/vue';
import { useSportsStore } from '@/stores/sports';
import { NO_SPORT_LABEL } from '@/utils/post-api';

const props = defineProps<{
  isOpen: boolean;
  title: string;
  caption: string;
  maxLength: number;
  /** When set, the sport can be changed too ('' = no sport). */
  sport?: string;
  save: (caption: string, sport: string) => Promise<string | null>;
}>();
const emit = defineEmits<{ close: [] }>();

const sportsStore = useSportsStore();
const draftCaption = ref('');
const draftSport = ref('');
const error = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      draftCaption.value = props.caption;
      draftSport.value = props.sport === NO_SPORT_LABEL ? '' : (props.sport ?? '');
      error.value = null;

      if (props.sport !== undefined) {
        void sportsStore.fetchSports();
      }
    }
  },
  { immediate: true },
);

async function submit(): Promise<void> {
  isSaving.value = true;

  try {
    error.value = await props.save(draftCaption.value, draftSport.value);

    if (!error.value) {
      emit('close');
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped src="./media-modal.css"></style>
