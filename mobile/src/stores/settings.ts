import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';
import { getMySettings, updateMySettings } from '@/services/settings-api.service';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '@/types/user-settings';
import { captureSession, createAuthorizedCall } from './authorized';
import { useAuthStore } from './auth';

export const useSettingsStore = defineStore('settings', () => {
  const auth = useAuthStore();
  const values = reactive<UserSettings>({ ...DEFAULT_USER_SETTINGS });
  const isLoading = ref(false);
  const isSaving = ref(false);
  let loadedUserId: string | null = null;

  watch(
    [() => auth.sessionVersion, () => auth.currentUser?.id],
    () => {
      loadedUserId = null;
      Object.assign(values, DEFAULT_USER_SETTINGS);
    },
    { flush: 'sync' },
  );

  async function load(force = false): Promise<void> {
    const userId = auth.currentUser?.id;
    if (!userId || (!force && loadedUserId === userId) || isLoading.value) return;
    const isCurrent = captureSession(auth);
    isLoading.value = true;
    try {
      const result = await createAuthorizedCall(auth)((token) => getMySettings(token));
      if (!isCurrent()) return;
      Object.assign(values, result);
      loadedUserId = userId;
    } finally {
      if (isCurrent()) isLoading.value = false;
    }
  }

  async function update(changes: Partial<UserSettings>): Promise<void> {
    const isCurrent = captureSession(auth);
    isSaving.value = true;
    try {
      const result = await createAuthorizedCall(auth)((token) => updateMySettings(token, changes));
      if (isCurrent()) {
        Object.assign(values, result);
        loadedUserId = auth.currentUser?.id ?? null;
      }
    } finally {
      if (isCurrent()) isSaving.value = false;
    }
  }

  return { values, isLoading, isSaving, load, update };
});
