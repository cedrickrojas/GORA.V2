<template>
  <button
    type="button"
    class="media-options"
    :class="`media-options--${tone}`"
    :aria-label="`${label} options`"
    @click.stop="openOptions"
  >
    <ion-icon :icon="ellipsisHorizontal" aria-hidden="true" />
  </button>

  <EditCaptionModal
    :is-open="isEditing"
    :title="`Edit ${kind}`"
    :caption="caption"
    :max-length="captionMaxLength"
    :sport="sport"
    :save="saveCaptionWithNotice"
    @close="closeEditor"
  />
  <AudienceModal
    :is-open="isEditingPrivacy"
    :title="`Who can see this ${kind}?`"
    :visibility="visibility"
    :custom-viewer-ids="customViewerIds"
    :save="saveAudience"
    @close="closePrivacy"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon, actionSheetController, alertController } from '@ionic/vue';
import {
  createOutline,
  earthOutline,
  ellipsisHorizontal,
  lockClosedOutline,
  peopleOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';
import type { PostVisibility } from '@/types/post';
import { showNotice } from '@/utils/notice';
import AudienceModal from './AudienceModal.vue';
import EditCaptionModal from './EditCaptionModal.vue';

const PRIVACY_ICONS: Record<PostVisibility, string> = {
  PUBLIC: earthOutline,
  FRIENDS: peopleOutline,
  CUSTOM: settingsOutline,
  ONLY_ME: lockClosedOutline,
};

/**
 * The "⋯" menu on your own story or reel: Edit caption, Edit privacy, Delete. Only render it
 * for the author's own stored content; the server enforces the same rule.
 */
const props = withDefaults(
  defineProps<{
    kind: 'story' | 'reel';
    caption: string;
    captionMaxLength: number;
    /** Reels only: the sport can be edited with the caption. */
    sport?: string;
    visibility: PostVisibility;
    customViewerIds: readonly string[];
    saveCaption: (caption: string, sport: string) => Promise<string | null>;
    saveAudience: (visibility: PostVisibility, customViewerIds: string[]) => Promise<string | null>;
    remove: () => Promise<string | null>;
    tone?: 'dark' | 'overlay';
  }>(),
  { sport: undefined, tone: 'dark' },
);
/** busy: true while a menu or editor is open (the story viewer pauses meanwhile). */
const emit = defineEmits<{ busy: [isBusy: boolean]; deleted: [] }>();

const isEditing = ref(false);
const isEditingPrivacy = ref(false);
const label = computed(() => (props.kind === 'story' ? 'Story' : 'Reel'));

async function saveCaptionWithNotice(caption: string, sport: string): Promise<string | null> {
  const error = await props.saveCaption(caption, sport);

  if (!error) {
    void showNotice(`${label.value} updated.`);
  }

  return error;
}

function closeEditor(): void {
  isEditing.value = false;
  emit('busy', false);
}

function closePrivacy(): void {
  isEditingPrivacy.value = false;
  emit('busy', false);
}

async function openOptions(): Promise<void> {
  emit('busy', true);
  let keepsBusy = false;

  const sheet = await actionSheetController.create({
    header: `${label.value} options`,
    cssClass: 'gora-sheet',
    buttons: [
      {
        text: props.kind === 'reel' ? 'Edit reel' : 'Edit caption',
        icon: createOutline,
        handler: () => {
          keepsBusy = true;
          isEditing.value = true;
        },
      },
      {
        text: 'Edit privacy',
        icon: PRIVACY_ICONS[props.visibility],
        handler: () => {
          keepsBusy = true;
          isEditingPrivacy.value = true;
        },
      },
      {
        text: `Delete ${props.kind}`,
        icon: trashOutline,
        role: 'destructive',
        handler: () => {
          keepsBusy = true;
          void confirmDelete();
        },
      },
      { text: 'Cancel', role: 'cancel' },
    ],
  });

  await sheet.present();
  await sheet.onDidDismiss();

  if (!keepsBusy) {
    emit('busy', false);
  }
}

async function confirmDelete(): Promise<void> {
  const alert = await alertController.create({
    header: `Delete ${props.kind}?`,
    message:
      props.kind === 'story'
        ? 'This story will be removed for everyone, including from My Stories.'
        : 'This reel will be removed from your Highlights, My Reels, and the Reels feed.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Delete', role: 'destructive' },
    ],
  });

  await alert.present();
  const { role } = await alert.onDidDismiss();

  if (role !== 'destructive') {
    emit('busy', false);
    return;
  }

  const error = await props.remove();
  void showNotice(error ?? `${label.value} deleted.`);
  emit('busy', false);

  if (!error) {
    emit('deleted');
  }
}
</script>

<style scoped>
.media-options {
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
}

.media-options--dark {
  background: transparent;
  color: var(--gora-muted);
}

.media-options--overlay {
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}
</style>
