import { defineStore } from 'pinia';
import { ref } from 'vue';

export type DisplayMode = 'dark' | 'light';
export type AppLanguage = 'en' | 'fil';

const STORAGE_KEY = 'gora.app-preferences';

interface AppPreferences {
  displayMode: DisplayMode;
  language: AppLanguage;
}

const DEFAULT_PREFERENCES: AppPreferences = { displayMode: 'dark', language: 'en' };

function readPreferences(): AppPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(saved) as Partial<AppPreferences>;
    return {
      displayMode: parsed.displayMode === 'light' ? 'light' : 'dark',
      language: parsed.language === 'fil' ? 'fil' : 'en',
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function applyPreferences(preferences: AppPreferences): void {
  document.documentElement.classList.toggle('gora-theme-light', preferences.displayMode === 'light');
  document.documentElement.lang = preferences.language;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    preferences.displayMode === 'light' ? '#f4f6f8' : '#101113',
  );
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', preferences.displayMode);
}

export function initializeAppPreferences(): void {
  applyPreferences(readPreferences());
}

export const useAppPreferencesStore = defineStore('app-preferences', () => {
  const saved = readPreferences();
  const displayMode = ref<DisplayMode>(saved.displayMode);
  const language = ref<AppLanguage>(saved.language);

  function persist(): void {
    const preferences = { displayMode: displayMode.value, language: language.value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Apply the current choice for this session even if browser storage is unavailable.
    }
    applyPreferences(preferences);
  }

  function setDisplayMode(value: DisplayMode): void {
    displayMode.value = value;
    persist();
  }

  function setLanguage(value: AppLanguage): void {
    language.value = value;
    persist();
  }

  return { displayMode, language, setDisplayMode, setLanguage };
});
