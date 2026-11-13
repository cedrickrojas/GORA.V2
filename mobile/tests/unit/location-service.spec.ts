import { afterEach, expect, test, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { checkPermission, getCurrentLocation, isLocationAvailable } from '@/services/location.service';

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: { checkPermissions: vi.fn(), requestPermissions: vi.fn(), getCurrentPosition: vi.fn() },
}));

const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
function provider(getCurrentPosition: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
}
afterEach(() => {
  if (original) Object.defineProperty(navigator, 'geolocation', original);
  else Reflect.deleteProperty(navigator, 'geolocation');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

test('native location works without browser geolocation and requests permission only for a reading', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  Reflect.deleteProperty(navigator, 'geolocation');
  vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
  vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
  vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
    coords: { latitude: 14.5512344, longitude: 121.0509874 },
  } as Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>);
  expect(isLocationAvailable()).toBe(true);
  expect(await checkPermission()).toBe('prompt');
  expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
  expect(await getCurrentLocation(10000, { precise: true })).toEqual({
    ok: true, point: { latitude: 14.551234, longitude: 121.050987 },
  });
  expect(Geolocation.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] });
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
});

test('native approximate permission is sufficient without another prompt', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'granted' });
  vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
    coords: { latitude: 14.5512344, longitude: 121.0509874 },
  } as Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>);
  expect(await checkPermission()).toBe('granted');
  expect(await getCurrentLocation()).toEqual({ ok: true, point: { latitude: 14.551, longitude: 121.051 } });
  expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
});

test('a denied native request never attempts to read coordinates', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
  vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
  expect(await getCurrentLocation()).toEqual({ ok: false, reason: 'DENIED' });
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
});

test.each([
  ['OS-PLUG-GLOC-0003', 'DENIED'],
  ['OS-PLUG-GLOC-0008', 'DENIED'],
  ['OS-PLUG-GLOC-0010', 'TIMEOUT'],
  ['OS-PLUG-GLOC-0007', 'UNAVAILABLE'],
])('maps native error %s to %s', async (code, reason) => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.mocked(Geolocation.checkPermissions).mockRejectedValue({ code });
  expect(await getCurrentLocation()).toEqual({ ok: false, reason });
});

test('native permission prompts cannot start a GPS reading after the deadline', async () => {
  vi.useFakeTimers();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  let allow!: (status: { location: 'granted'; coarseLocation: 'granted' }) => void;
  vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
  vi.mocked(Geolocation.requestPermissions).mockReturnValue(new Promise(resolve => { allow = resolve; }));
  const result = getCurrentLocation(100);
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toEqual({ ok: false, reason: 'TIMEOUT' });
  allow({ location: 'granted', coarseLocation: 'granted' });
  await vi.advanceTimersByTimeAsync(0);
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
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
