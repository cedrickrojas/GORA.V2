import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError } from '@/services/api-client';
import { fetchAuthenticatedUser, loginAccount, registerAccount } from '@/services/auth.service';
import { tokenStorage } from '@/services/token-storage';
import type { AuthResponse, CurrentAuthUser, LoginInput, RegisterInput } from '@/types/auth';
import { normalizeLoginInput, normalizeRegisterInput } from '@/utils/auth';

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<CurrentAuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const isInitialized = ref(false);
  const sessionVersion = ref(0);
  let restoring: Promise<void> | null = null;

  const isAuthenticated = computed(() => accessToken.value !== null && currentUser.value !== null);

  /** Restores a saved session once per app launch. Safe to call from every navigation. */
  function initialize(): Promise<void> {
    restoring ??= restoreSession().finally(() => {
      isInitialized.value = true;
    });
    return restoring;
  }

  async function restoreSession(): Promise<void> {
    const version = sessionVersion.value;
    const saved = await tokenStorage.get();

    if (!saved || version !== sessionVersion.value) {
      return;
    }

    accessToken.value = saved;

    try {
      await loadCurrentUser();
    } catch {
      // API unreachable: treat this launch as signed out but keep the saved token for the next one.
      if (version === sessionVersion.value) {
        accessToken.value = null;
        currentUser.value = null;
      }
    }
  }

  /** Refreshes currentUser from GET /auth/me; drops the session if the token is no longer accepted. */
  async function loadCurrentUser(): Promise<void> {
    const token = accessToken.value;
    const version = sessionVersion.value;
    if (!token) {
      currentUser.value = null;
      return;
    }

    try {
      const user = await fetchAuthenticatedUser(token);
      if (version === sessionVersion.value && token === accessToken.value) currentUser.value = user;
    } catch (error) {
      if (version !== sessionVersion.value || token !== accessToken.value) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearSession();
        return;
      }

      throw error;
    }
  }

  async function login(input: LoginInput): Promise<void> {
    const version = ++sessionVersion.value;
    await startSession(await loginAccount(normalizeLoginInput(input)), version);
  }

  async function register(input: RegisterInput): Promise<void> {
    const version = ++sessionVersion.value;
    await startSession(await registerAccount(normalizeRegisterInput(input)), version);
  }

  /** Client-side logout: forgets the token. The JWT itself stays valid until it expires. */
  async function logout(): Promise<void> {
    await clearSession();
  }

  async function startSession(response: AuthResponse, version: number): Promise<void> {
    if (version !== sessionVersion.value) return;
    accessToken.value = response.accessToken;
    currentUser.value = { ...response.user, profileImageUrl: null, bio: null, city: null };
    await tokenStorage.set(response.accessToken);
    await loadCurrentUser().catch(() => undefined);
  }

  async function clearSession(): Promise<void> {
    sessionVersion.value++;
    accessToken.value = null;
    currentUser.value = null;
    await tokenStorage.clear();
  }

  return {
    currentUser,
    accessToken,
    isAuthenticated,
    isInitialized,
    sessionVersion,
    initialize,
    loadCurrentUser,
    login,
    register,
    logout,
  };
});
