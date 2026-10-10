<template>
  <form class="chat-composer" @submit.prevent="submit">
    <textarea
      ref="input"
      :value="modelValue"
      class="chat-composer__input"
      rows="1"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxLength"
      :aria-label="label"
      enterkeyhint="enter"
      @input="updateDraft"
      @focus="emit('focus')"
      @keydown="onKeydown"
    />
    <button
      type="submit"
      class="chat-composer__send"
      :disabled="disabled || sending || !modelValue.trim()"
      aria-label="Send"
      @pointerdown.prevent
    >
      <ion-icon :icon="sendIcon" aria-hidden="true" />
    </button>
  </form>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { send as sendIcon } from 'ionicons/icons';

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  label?: string;
  maxLength?: number;
  disabled?: boolean;
  sending?: boolean;
}>(), { placeholder: 'Type a message...', label: 'Message', maxLength: 1000 });
const emit = defineEmits<{
  'update:modelValue': [value: string];
  send: [];
  focus: [];
}>();
const input = ref<HTMLTextAreaElement | null>(null);

function resize(): void {
  if (!input.value) return;
  input.value.style.overflowY = 'hidden';
  input.value.style.height = 'auto';
  const height = input.value.scrollHeight;
  input.value.style.height = `${Math.min(Math.max(height, 44), 144)}px`;
  input.value.style.overflowY = height > 144 ? 'auto' : 'hidden';
}
function updateDraft(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
  resize();
}
function submit(): void {
  if (!props.disabled && !props.sending && props.modelValue.trim()) emit('send');
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  // Phone keyboards retain Enter for new lines. Desktop uses Shift+Enter.
  if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    event.preventDefault();
    submit();
  }
}
watch(() => props.modelValue, () => { void nextTick(resize); });
onMounted(resize);
</script>

<style scoped>
.chat-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
  max-width: var(--gora-column, 680px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 10px max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: var(--ion-background-color);
}
.chat-composer__input {
  min-width: 0;
  min-height: 44px;
  max-height: 144px;
  flex: 1;
  box-sizing: border-box;
  resize: none;
  overflow-y: auto;
  padding: 10px 14px;
  border: 1px solid var(--gora-line);
  border-radius: 22px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  font-size: 16px;
  line-height: 22px;
  overscroll-behavior: contain;
}
.chat-composer__input:focus { border-color: var(--ion-color-primary); outline: none; }
.chat-composer__send {
  display: flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font-size: 20px;
}
.chat-composer__send:disabled { cursor: default; opacity: 0.4; }
</style>
