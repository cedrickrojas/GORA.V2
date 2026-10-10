const TOKEN_KEY = 'gora.accessToken';

/**
 * Where the access token lives between app launches. Capacitor is not part of
 * this project yet, so this uses the WebView's localStorage; swap the body for
 * @capacitor/preferences when the native shell is added.
 */
export const tokenStorage = {
  async get(): Promise<string | null> {
    try {
      return readStorage()?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  },

  async set(token: string): Promise<void> {
    try {
      readStorage()?.setItem(TOKEN_KEY, token);
    } catch {
      /* Keep this session in memory if storage is unavailable. */
    }
  },

  async clear(): Promise<void> {
    try {
      readStorage()?.removeItem(TOKEN_KEY);
    } catch {
      /* Storage may be disabled by the browser. */
    }
  },
};

function readStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
