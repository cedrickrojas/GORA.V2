import { getApiBaseUrl } from './api-config';

export const API_PREFIX = '/api/v1';
export const NETWORK_ERROR_MESSAGE = "Can't reach GORA right now. Check your connection and try again.";
const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    let decoded = true;
    const payload: unknown = await response.json().catch(() => {
      decoded = false;
      return null;
    });
    if (controller.signal.aborted) throw new ApiError(0, NETWORK_ERROR_MESSAGE);

    if (!response.ok) {
      throw new ApiError(response.status, readMessage(payload) ?? FALLBACK_ERROR_MESSAGE);
    }
    if (!decoded && response.status !== 204) {
      throw new ApiError(502, FALLBACK_ERROR_MESSAGE);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  } finally {
    clearTimeout(timeout);
  }
}

function readMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('message' in payload)) {
    return null;
  }

  const { message } = payload as { message: unknown };
  if (typeof message === 'string' && message.length > 0) return message;
  if (Array.isArray(message) && message.length > 0 && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }
  return null;
}
