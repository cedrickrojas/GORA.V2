import { ApiError } from '@/services/api-client';
import { SESSION_EXPIRED_MESSAGE, describeApiError, isUnauthorized } from '@/utils/api-errors';
import type { useAuthStore } from './auth';

type AuthStore = ReturnType<typeof useAuthStore>;

export class SessionChangedError extends Error {
  constructor() {
    super('The account changed while this request was running.');
    this.name = 'SessionChangedError';
  }
}

/** A request may only update the account that started it, even if a token is reused. */
export function captureSession(auth: AuthStore): () => boolean {
  const token = auth.accessToken;
  const userId = auth.currentUser?.id;
  const version = auth.sessionVersion;
  return () => token === auth.accessToken && userId === auth.currentUser?.id && version === auth.sessionVersion;
}

/** A current request's 401 ends its session; old responses never affect a new account. */
export function createAuthorizedCall(auth: AuthStore) {
  return async function authorized<T>(call: (token: string) => Promise<T>): Promise<T> {
    const token = auth.accessToken;
    const isCurrent = captureSession(auth);

    if (!token) {
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
    }

    try {
      const result = await call(token);
      if (!isCurrent()) throw new SessionChangedError();
      return result;
    } catch (caught) {
      if (!isCurrent()) throw new SessionChangedError();
      if (isUnauthorized(caught)) {
        await auth.logout();
      }

      throw caught;
    }
  };
}

/** The server writes its 403 messages for people ("Only the author can edit this reel."). */
export function describeContentError(caught: unknown, notFoundMessage?: string): string {
  if (caught instanceof ApiError && caught.status === 403 && caught.message) {
    return caught.message;
  }

  return describeApiError(caught, notFoundMessage);
}
