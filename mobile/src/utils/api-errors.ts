import { ApiError, NETWORK_ERROR_MESSAGE } from '@/services/api-client';

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * A message that is safe to show. Validation (400), not found (404), and conflict (409)
 * messages are written for people by the API; anything else gets a generic message so
 * internals never reach the screen.
 */
export function describeApiError(error: unknown, notFoundMessage?: string): string {
  if (!(error instanceof ApiError)) {
    return FALLBACK_MESSAGE;
  }

  if (error.status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (error.status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (error.status === 403) {
    return "You don't have permission to do that.";
  }

  if (error.status === 404 && notFoundMessage) {
    return notFoundMessage;
  }

  if (error.status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  return error.message || FALLBACK_MESSAGE;
}
