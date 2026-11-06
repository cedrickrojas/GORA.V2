<template>
  <div class="club-photo-picker">
    <span :id="`${kind}-photo-label`" class="club-photo-picker__label">{{
      title
    }}</span>
    <div
      v-if="model"
      class="club-photo-picker__preview"
      :class="{ 'club-photo-picker__preview--cover': kind === 'cover' }"
    >
      <img :src="preview" :alt="`${title} preview`" />
    </div>
    <div class="club-photo-picker__actions">
      <button type="button" :disabled="preparing" @click="input?.click()">
        {{
          preparing
            ? "Preparing photo..."
            : model
              ? `Change ${title.toLowerCase()}`
              : `Upload ${title.toLowerCase()}`
        }}
      </button>
      <button
        v-if="model"
        type="button"
        :disabled="preparing"
        @click="model = ''"
      >
        Remove
      </button>
    </div>
    <input
      ref="input"
      class="club-photo-picker__input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :aria-label="`Choose club ${kind} photo`"
      :disabled="preparing"
      @change="choose"
    />
    <p v-if="error" class="club-photo-picker__error" role="alert">
      {{ error }}
    </p>
    <p v-else class="club-photo-picker__hint">
      JPEG, PNG or WebP, up to 20 MB. Photos are resized before saving.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { preparePostPhoto } from "@/utils/post-photos";
import { getApiBaseUrl } from "@/services/api-config";

const model = defineModel<string>({ required: true });
defineProps<{ kind: "profile" | "cover"; title: string }>();
const emit = defineEmits<{ preparing: [busy: boolean] }>();
const input = ref<HTMLInputElement | null>(null);
const preparing = ref(false);
const error = ref<string | null>(null);
let disposed = false;
const preview = computed(() =>
  model.value.startsWith("/")
    ? new URL(model.value, getApiBaseUrl() || window.location.origin).href
    : model.value,
);
onBeforeUnmount(() => {
  disposed = true;
  emit("preparing", false);
});

async function choose(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file || preparing.value) return;
  error.value = null;
  preparing.value = true;
  emit("preparing", true);
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Choose a JPEG, PNG or WebP photo.");
    const photo = await preparePostPhoto(file);
    if (!disposed) model.value = photo;
  } catch (caught) {
    if (!disposed)
      error.value =
        caught instanceof Error
          ? caught.message
          : "Could not prepare this photo. Please try again.";
  } finally {
    if (!disposed) {
      preparing.value = false;
      emit("preparing", false);
    }
  }
}
</script>

<style scoped>
.club-photo-picker {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.club-photo-picker__label {
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.club-photo-picker__preview {
  width: 100px;
  height: 100px;
  overflow: hidden;
  border: 1px solid var(--gora-line);
  border-radius: 10px;
  background: var(--gora-surface);
}
.club-photo-picker__preview--cover {
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 1;
}
.club-photo-picker__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.club-photo-picker__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.club-photo-picker button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--gora-line);
  border-radius: 8px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
}
.club-photo-picker button:first-child {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}
.club-photo-picker button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.club-photo-picker__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}
.club-photo-picker__hint,
.club-photo-picker__error {
  margin: 0;
  font-size: 0.73rem;
  line-height: 1.5;
  color: var(--gora-muted);
}
.club-photo-picker__error {
  color: var(--ion-color-danger);
}
</style>
