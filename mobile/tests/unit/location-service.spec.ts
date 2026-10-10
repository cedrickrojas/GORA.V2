import { afterEach, expect, test, vi } from 'vitest';
import { getCurrentLocation } from '@/services/location.service';

const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
function provider(getCurrentPosition: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
}
afterEach(() => {
  if (original) Object.defineProperty(navigator, 'geolocation', original);
  else Reflect.deleteProperty(navigator, 'geolocation');
  vi.useRealTimers();
});

test('keeps discovery rounding while supporting precise post coordinates', async () => {
  const read = vi.fn((success) => success({ coords: { latitude: 14.5512344, longitude: 121.0509874 } }));
  provider(read);
  expect(await getCurrentLocation()).toEqual({ ok: true, point: { latitude: 14.551, longitude: 121.051 } });
  expect(await getCurrentLocation(10000, { precise: true })).toEqual({
    ok: true,
    point: { latitude: 14.551234, longitude: 121.050987 },
  });
  expect(read.mock.calls[1][2]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
});

test('times out even when a device never calls either callback', async () => {
  vi.useFakeTimers();
  provider(vi.fn());
  const result = getCurrentLocation(100);
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toEqual({ ok: false, reason: 'TIMEOUT' });
});

test('rejects invalid device coordinates and catches a throwing provider', async () => {
  provider(vi.fn((success) => success({ coords: { latitude: NaN, longitude: 121 } })));
  expect(await getCurrentLocation()).toEqual({ ok: false, reason: 'UNAVAILABLE' });
  provider(
    vi.fn(() => {
      throw new Error('Unavailable');
    }),
  );
  expect(await getCurrentLocation()).toEqual({ ok: false, reason: 'UNAVAILABLE' });
});
