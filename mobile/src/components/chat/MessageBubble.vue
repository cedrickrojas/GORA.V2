<template>
  <div class="message-bubble" :class="{ 'message-bubble--mine': mine }">
    <div
      ref="bubble"
      class="message-bubble__content"
      :class="{ 'message-bubble__content--reactable': canReact }"
      :role="canReact ? 'button' : undefined"
      :tabindex="canReact ? 0 : undefined"
      :aria-label="canReact ? `${senderName}: ${body}. React to message` : undefined"
      :aria-haspopup="canReact ? 'dialog' : undefined"
      :aria-expanded="canReact ? pickerOpen : undefined"
      @pointerdown="startHold"
      @pointermove="moveHold"
      @pointerup="cancelHold"
      @pointercancel="cancelHold"
      @pointerleave="cancelHold"
      @contextmenu="contextReact"
      @keydown.enter="keyboardOpen"
      @keydown.space="keyboardOpen"
    >
      <strong>{{ senderName }}</strong>
      <small v-if="pinned">📌 Pinned</small>
      <small v-if="forwarded">↪ Forwarded</small>
      <button
        v-if="attachment?.kind === 'image'"
        type="button"
        class="message-bubble__photo"
        aria-label="Open chat photo"
        @click="photoOpen = true"
      >
        <img :src="attachment.url" alt="Chat photo" loading="lazy" />
      </button>
      <audio
        v-else-if="attachment?.kind === 'audio'"
        :src="attachment.url"
        controls
        preload="metadata"
        aria-label="Voice message"
      />
      <p v-else :class="{ 'message-bubble__unsent': unsent }">
        <template v-for="(part, index) in bodyParts" :key="index">
          <a v-if="part.url" :href="part.url" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>
      <time :datetime="sentAt">{{ formatTimeAgo(Date.parse(sentAt), now) }}</time>
    </div>
    <button
      v-if="canReact"
      type="button"
      class="message-bubble__add"
      aria-label="React to message"
      :disabled="busy"
      @click="openPicker"
    >
      <ion-icon :icon="happyOutline" aria-hidden="true" />
    </button>
    <div v-if="reactions.length" class="message-bubble__reactions" aria-label="Message reactions" aria-live="polite">
      <button
        v-for="reaction in reactions"
        :key="reaction.emoji"
        type="button"
        :class="{ 'message-bubble__reaction--mine': reaction.reacted }"
        :aria-pressed="reaction.reacted"
        :aria-label="`${reactionLabel(reaction.emoji)}: ${reaction.count}${reaction.reacted ? ', including you' : ''}`"
        :disabled="!canReact || busy"
        @click="openPicker"
      >
        {{ reaction.emoji }} <span>{{ reaction.count }}</span>
      </button>
    </div>
    <Teleport to="body">
      <div v-if="pickerOpen" class="reaction-overlay" @pointerdown.self="closePicker()" @keydown="pickerKeydown">
        <section
          ref="picker"
          class="reaction-picker"
          :style="pickerPosition"
          role="dialog"
          aria-modal="true"
          aria-label="React to message"
          @contextmenu.prevent
        >
          <div class="reaction-picker__options">
            <button
              v-for="reaction in MESSAGE_REACTIONS"
              :key="reaction.emoji"
              type="button"
              :aria-label="reaction.label"
              :aria-pressed="ownReaction === reaction.emoji"
              @click="choose(reaction.emoji)"
            >
              {{ reaction.emoji }}
            </button>
          </div>
          <button v-if="ownReaction" type="button" class="reaction-picker__remove" @click="choose(null)">
            Remove reaction
          </button>
          <div v-if="canManage" class="message-actions">
            <button v-if="mine" type="button" @click="action('unsend')">Unsend for everyone</button>
            <button type="button" @click="action('forward')">Forward</button>
            <button type="button" @click="action('pin')">{{ pinned ? 'Unpin' : 'Pin' }}</button>
            <button v-if="!mine" type="button" @click="action('report')">Report</button>
          </div>
          <button type="button" class="reaction-picker__close" @click="closePicker()">Cancel</button>
        </section>
      </div>
    </Teleport>
    <ion-modal :is-open="photoOpen" @did-dismiss="photoOpen = false"
      ><ion-header
        ><ion-toolbar
          ><ion-title>Chat photo</ion-title
          ><ion-buttons slot="end"><ion-button @click="photoOpen = false">Close</ion-button></ion-buttons></ion-toolbar
        ></ion-header
      ><ion-content
        ><img
          v-if="attachment"
          :src="attachment.url"
          alt="Chat photo"
          class="message-bubble__full-photo" /></ion-content
    ></ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  onIonViewDidLeave,
} from '@ionic/vue';
import { happyOutline } from 'ionicons/icons';
import { MESSAGE_REACTIONS, type MessageReaction, type MessageReactionEmoji } from '@/types/chat';
import { formatTimeAgo } from '@/utils/time';

const props = withDefaults(
  defineProps<{
    senderName: string;
    body: string;
    sentAt: string;
    now: number;
    mine: boolean;
    reactions?: MessageReaction[];
    canReact?: boolean;
    busy?: boolean;
    canManage?: boolean;
    unsent?: boolean;
    forwarded?: boolean;
    pinned?: boolean;
    attachment?: { kind: 'image' | 'audio'; url: string } | null;
  }>(),
  { reactions: () => [] },
);
const emit = defineEmits<{
  react: [emoji: MessageReactionEmoji | null];
  action: [action: 'unsend' | 'forward' | 'pin' | 'report'];
}>();
const photoOpen = ref(false);
const bubble = ref<HTMLElement | null>(null);
const picker = ref<HTMLElement | null>(null);
const pickerOpen = ref(false);
const pickerPosition = ref({ top: '16px', left: '16px' });
const ownReaction = computed(() => props.reactions.find((reaction) => reaction.reacted)?.emoji);
const bodyParts = computed(() =>
  props.body.split(/(https?:\/\/[^\s]+)/g).filter(Boolean).map((text) => ({
    text,
    url: /^https?:\/\//i.test(text) ? text : null,
  })),
);
let hold: ReturnType<typeof setTimeout> | undefined;
let startX = 0;
let startY = 0;
let viewport: VisualViewport | null = null;

const reactionLabel = (emoji: MessageReactionEmoji) =>
  MESSAGE_REACTIONS.find((reaction) => reaction.emoji === emoji)?.label ?? emoji;
function cancelHold(): void {
  clearTimeout(hold);
  hold = undefined;
}
function startHold(event: PointerEvent): void {
  cancelHold();
  if ((event.target as HTMLElement).closest?.('audio, button, input')) return;
  if (!props.canReact || props.busy || event.button !== 0 || event.isPrimary === false) return;
  startX = event.clientX;
  startY = event.clientY;
  hold = setTimeout(() => {
    void openPicker();
  }, 450);
}
function moveHold(event: PointerEvent): void {
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancelHold();
}
function positionPicker(): void {
  const rect = bubble.value?.getBoundingClientRect();
  const panel = picker.value;
  if (!rect || !panel) return;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const bounds = panel.getBoundingClientRect();
  const x = Math.max(
    left + 12,
    Math.min(rect.left + rect.width / 2 - bounds.width / 2, left + width - bounds.width - 12),
  );
  const preferredY = rect.top - bounds.height - 10;
  const y = Math.max(
    top + 12,
    Math.min(preferredY >= top + 12 ? preferredY : rect.bottom + 10, top + height - bounds.height - 12),
  );
  pickerPosition.value = { left: `${Math.round(x)}px`, top: `${Math.round(y)}px` };
}
async function openPicker(): Promise<void> {
  cancelHold();
  if (!props.canReact || props.busy || pickerOpen.value) return;
  pickerOpen.value = true;
  viewport = window.visualViewport;
  viewport?.addEventListener('resize', positionPicker);
  viewport?.addEventListener('scroll', positionPicker);
  window.addEventListener('resize', positionPicker);
  await nextTick();
  positionPicker();
  const first =
    picker.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
    picker.value?.querySelector<HTMLButtonElement>('button');
  first?.focus({ preventScroll: true });
}
function closePicker(restoreFocus = true): void {
  pickerOpen.value = false;
  viewport?.removeEventListener('resize', positionPicker);
  viewport?.removeEventListener('scroll', positionPicker);
  window.removeEventListener('resize', positionPicker);
  if (restoreFocus) bubble.value?.focus({ preventScroll: true });
}
function contextReact(event: MouseEvent): void {
  if (props.canReact) {
    event.preventDefault();
    void openPicker();
  }
}
function choose(emoji: MessageReactionEmoji | null): void {
  emit('react', emoji === ownReaction.value ? null : emoji);
  closePicker();
}
function action(value: 'unsend' | 'forward' | 'pin' | 'report') {
  closePicker();
  emit('action', value);
}
function keyboardOpen(event: KeyboardEvent) {
  if (event.target === event.currentTarget) {
    event.preventDefault();
    void openPicker();
  }
}
function pickerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePicker();
  }
  if (event.key !== 'Tab') return;
  const buttons = Array.from(picker.value?.querySelectorAll<HTMLButtonElement>('button') ?? []);
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  event.preventDefault();
  buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
}
watch(
  () => props.canReact,
  (allowed) => {
    if (!allowed) closePicker(false);
  },
);
onBeforeUnmount(() => {
  cancelHold();
  closePicker(false);
});
onIonViewDidLeave(() => {
  cancelHold();
  closePicker(false);
});
</script>

<style scoped>
.message-bubble {
  position: relative;
  min-width: 0;
}
.message-bubble__photo {
  display: block;
  max-width: min(280px, 65vw);
  padding: 0;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  background: transparent;
  cursor: zoom-in;
}
.message-bubble__photo img {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
}
.message-bubble__full-photo {
  display: block;
  width: 100%;
  max-height: 85vh;
  object-fit: contain;
}
.message-bubble__content audio {
  display: block;
  width: min(280px, 65vw);
  margin: 8px 0;
}
.message-bubble__content small {
  display: block;
  margin-bottom: 6px;
  opacity: 0.75;
}
.message-bubble__unsent {
  font-style: italic;
  opacity: 0.65;
}
.message-actions {
  border-top: 1px solid var(--gora-line);
  margin-top: 8px;
  padding-top: 8px;
  display: grid;
  gap: 4px;
}
.message-actions button {
  border: 0;
  border-radius: 8px;
  padding: 9px;
  background: transparent;
  color: var(--ion-text-color);
  text-align: left;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
.message-actions button:hover {
  background: var(--gora-accent-soft);
}
.message-bubble__content {
  padding: 10px 13px;
  border-radius: 18px 18px 18px 4px;
  background: var(--gora-surface);
}
.message-bubble--mine .message-bubble__content {
  border-radius: 18px 18px 4px 18px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
.message-bubble__content--reactable {
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  cursor: pointer;
}
.message-bubble__content strong {
  display: block;
  margin-bottom: 4px;
  font-size: 0.72rem;
}
.message-bubble__content p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.message-bubble__content a {
  color: var(--ion-color-primary);
  text-decoration: underline;
  overflow-wrap: anywhere;
}
.message-bubble__content time {
  display: block;
  margin-top: 4px;
  font-size: 0.66rem;
  opacity: 0.7;
}
.message-bubble__add {
  position: absolute;
  top: 50%;
  right: -36px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--gora-surface);
  color: var(--gora-muted);
  cursor: pointer;
  font-size: 20px;
  opacity: 0;
  transform: translateY(-50%);
}
.message-bubble--mine .message-bubble__add {
  right: auto;
  left: -36px;
}
.message-bubble:hover .message-bubble__add,
.message-bubble:focus-within .message-bubble__add {
  opacity: 1;
}
.message-bubble__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: -3px;
  padding: 0 6px;
  position: relative;
}
.message-bubble--mine .message-bubble__reactions {
  justify-content: flex-end;
}
.message-bubble__reactions button {
  display: flex;
  align-items: center;
  gap: 3px;
  min-height: 28px;
  padding: 2px 7px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 16px;
  background: var(--gora-surface-raised);
  color: var(--ion-text-color);
  cursor: pointer;
  font-size: 15px;
}
.message-bubble__reactions span {
  font-size: 0.7rem;
}
.message-bubble__reactions .message-bubble__reaction--mine {
  border-color: var(--ion-color-primary);
  background: var(--gora-accent-soft);
}
.reaction-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgb(0 0 0 / 25%);
  touch-action: none;
}
.reaction-picker {
  position: fixed;
  width: min(320px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 22px;
  background: var(--gora-surface-raised);
  box-shadow: 0 12px 40px rgb(0 0 0 / 40%);
}
.reaction-picker__options {
  display: flex;
  justify-content: space-between;
  gap: 2px;
}
.reaction-picker__options button {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 28px;
}
.reaction-picker__options button:hover,
.reaction-picker__options button[aria-pressed='true'] {
  border-color: var(--ion-color-primary);
  background: var(--gora-accent-soft);
}
.reaction-picker__remove,
.reaction-picker__close {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}
.reaction-picker__remove {
  color: var(--ion-color-primary);
}
@media (hover: none) {
  .message-bubble__add {
    opacity: 1;
  }
}
</style>
