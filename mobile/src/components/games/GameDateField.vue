<template>
  <div class="game-date-field">
    <input
      :id="id"
      :value="modelValue"
      type="date"
      :min="min"
      :max="max"
      class="game-date-field__input"
      readonly
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click.prevent="open = true"
      @keydown.enter.prevent="open = true"
      @keydown.space.prevent="open = true"
    />
    <button type="button" class="game-date-field__open" aria-label="Choose game date" aria-haspopup="dialog" @click="open = true">
      <ion-icon :icon="calendarOutline" aria-hidden="true" />
    </button>
    <ion-modal :is-open="open" class="game-date-modal" @did-dismiss="open = false">
      <div class="game-date-field__calendar">
        <h2>Choose game date</h2>
        <ion-datetime
          presentation="date"
          :value="modelValue || min"
          :min="min"
          :max="max"
          :show-default-buttons="true"
          done-text="Use date"
          cancel-text="Cancel"
          @ion-change="chooseDate"
          @ion-cancel="open = false"
        />
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonDatetime, IonIcon, IonModal } from '@ionic/vue';
import { calendarOutline } from 'ionicons/icons';

defineProps<{ id: string; modelValue: string; min: string; max: string }>();
const emit = defineEmits<{ 'update:modelValue': [date: string] }>();
const open = ref(false);

function chooseDate(event: CustomEvent<{ value?: string | string[] | null }>): void {
  const value = event.detail.value;
  if (typeof value !== 'string') return;
  emit('update:modelValue', value.slice(0, 10));
  open.value = false;
}
</script>

<style scoped>
.game-date-field {
  position: relative;
  display: flex;
  min-width: 0;
}
.game-date-field__input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 11px 52px 11px 12px;
  border: 1px solid var(--gora-line-strong);
  border-radius: 12px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  font: inherit;
  color-scheme: dark;
  cursor: pointer;
}
.game-date-field__input::-webkit-calendar-picker-indicator { display: none; }
.game-date-field__open {
  position: absolute;
  inset: 0 0 0 auto;
  display: grid;
  width: 48px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--ion-color-primary);
  font-size: 22px;
  cursor: pointer;
}
.game-date-field__calendar {
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 16px;
}
.game-date-field__calendar h2 { margin: 0 0 12px; font-size: 1.1rem; }
.game-date-field__calendar ion-datetime {
  --background: var(--gora-surface);
  --background-rgb: 28, 29, 33;
  --wheel-highlight-background: var(--gora-surface-raised);
  --wheel-fade-background-rgb: 28, 29, 33;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  color: var(--ion-text-color);
}
.game-date-modal {
  --width: min(390px, calc(100% - 24px));
  --height: auto;
  --max-height: calc(100% - 24px);
}
</style>
