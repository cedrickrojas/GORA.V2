import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError, apiRequest, NETWORK_ERROR_MESSAGE, REQUEST_TIMEOUT_MS } from '@/services/api-client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('API response handling', () => {
  test('keeps a valid JSON null response for an absent join request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('null'))),
    );
    expect(await apiRequest('/games/example/join-requests/me')).toBeNull();
  });

  test('rejects HTML or malformed JSON instead of returning a false success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('<html>Proxy error</html>'))),
    );
    await expect(apiRequest('/posts')).rejects.toMatchObject({ status: 502 });
  });

  test('preserves actionable server validation errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              message: ['Caption is required.', 'Choose a valid audience.'],
            }),
            { status: 400 },
          ),
        ),
      ),
    );
    await expect(apiRequest('/posts')).rejects.toThrow('Caption is required. Choose a valid audience.');
  });

  test('aborts a stalled request and releases its timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      ),
    );
    const pending = apiRequest('/posts');
    const rejected = expect(pending).rejects.toEqual(new ApiError(0, NETWORK_ERROR_MESSAGE));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
