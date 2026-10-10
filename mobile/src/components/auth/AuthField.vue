<template>
  <div class="auth-field">
    <label class="auth-field__label" :for="id">{{ label }}</label>
    <div
      class="auth-field__control"
      :class="{ 'auth-field__control--error': error }"
    >
      <input
        :id="id"
        class="auth-field__input"
        :type="inputType"
        :value="modelValue"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : 'false'"
        :aria-describedby="error ? `${id}-error` : undefined"
        autocapitalize="off"
        spellcheck="false"
        @input="
          emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="auth-field__reveal"
        :aria-label="
          revealed
            ? `Hide ${label.toLowerCase()}`
            : `Show ${label.toLowerCase()}`
        "
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <ion-icon
          :icon="revealed ? eyeOffOutline : eyeOutline"
          aria-hidden="true"
        />
      </button>
    </div>
    <span
      v-if="error"
      :id="`${id}-error`"
      class="auth-field__error"
      role="alert"
      >{{ error }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';

const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    modelValue: string;
    type?: 'text' | 'email' | 'password';
    autocomplete?: string;
    inputmode?: 'text' | 'email';
    maxlength?: number;
    error?: string;
    disabled?: boolean;
  }>(),
  {
    type: 'text',
    autocomplete: 'off',
    inputmode: 'text',
    maxlength: undefined,
    error: undefined,
    disabled: false,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const revealed = ref(false);

const inputType = computed(() =>
  props.type === 'password' && revealed.value ? 'text' : props.type,
);
</script>

<style scoped>
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-field__label {
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-field__control {
  display: flex;
  align-items: center;
  border: 1px solid var(--gora-line-strong);
  border-radius: var(--gora-radius-control);
  background: var(--ion-background-color);
  transition:
    border-color var(--gora-motion),
    box-shadow var(--gora-motion);
}

.auth-field__control:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 2px var(--gora-accent-soft);
}

.auth-field__control--error {
  border-color: #ef5b5b;
}

.auth-field__input {
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.95rem;
}

.auth-field__reveal {
  display: grid;
  place-items: center;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--gora-muted);
  cursor: pointer;
  font-size: 1.2rem;
}

.auth-field__error {
  color: #ef5b5b;
  font-size: 0.75rem;
}
</style>
