import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ReelSlide from '@/components/reels/ReelSlide.vue';
import type { Reel } from '@/types/reel';

vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }));
vi.mock('@/stores/reels', () => ({ useReelsStore: () => ({ myReels: [] }) }));
vi.mock('@/components/common/UserAvatar.vue', () => ({ default: { template: '<span />' } }));
vi.mock('@/components/media/ReelOptionsButton.vue', () => ({ default: { template: '<span />' } }));

const reel: Reel = {
  id: 'reel', author: { id: 'player', username: 'player', displayName: 'Player', avatarUrl: null },
  sport: 'Basketball', caption: 'Game highlight', locationName: '', videoUrl: '/reel.mp4',
  durationSeconds: 10, views: 1, likes: 2, comments: 0, shares: 0, likedByViewer: false,
  createdAt: '2026-11-01T00:00:00Z',
};
let wrapper: VueWrapper | undefined;
let visibility: IntersectionObserverCallback;
let paused: boolean;
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
const observe = (visible: boolean) => visibility(
  [{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }] as IntersectionObserverEntry[],
  {} as IntersectionObserver,
);

beforeEach(() => {
  vi.useFakeTimers();
  paused = true;
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    paused = true;
    this.dispatchEvent(new Event('pause'));
  });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { visibility = callback; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function open(liked = false) {
  wrapper = mount(ReelSlide, { props: { reel: { ...reel, likedByViewer: liked } } });
  observe(true);
  await flushPromises();
  return wrapper;
}
describe('Reel playback and reactions', () => {
  test('autoplays the visible reel with sound and pauses it offscreen', async () => {
    const page = await open();
    expect(play).toHaveBeenCalledOnce();
    expect((page.get('video').element as HTMLVideoElement).muted).toBe(false);
    observe(false);
    expect(pause).toHaveBeenCalledOnce();
    observe(true);
    await flushPromises();
    expect(play).toHaveBeenCalledTimes(2);
    await page.setProps({ enabled: false });
    expect(pause).toHaveBeenCalledTimes(2);
  });
  test('falls back to muted autoplay if the browser requires an audio gesture', async () => {
    play.mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'));
    const page = await open();
    expect(play).toHaveBeenCalledTimes(2);
    expect((page.get('video').element as HTMLVideoElement).muted).toBe(true);
    await page.get('[aria-label="Unmute reel"]').trigger('click');
    expect((page.get('video').element as HTMLVideoElement).muted).toBe(false);
  });
  test('the first video tap enables blocked audio and keeps playing', async () => {
    play.mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'));
    const page = await open();
    await page.get('video').trigger('click');
    vi.advanceTimersByTime(301);
    expect((page.get('video').element as HTMLVideoElement).muted).toBe(false);
    expect(pause).not.toHaveBeenCalled();
  });
  test('double tapping likes once without pausing or restarting playback', async () => {
    const page = await open();
    await page.get('video').trigger('click', { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(100);
    await page.get('video').trigger('click', { clientX: 102, clientY: 102 });
    vi.advanceTimersByTime(800);
    expect(page.emitted('like')).toHaveLength(1);
    expect(pause).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
  });
  test('double tapping an already liked reel does not unlike it', async () => {
    const page = await open(true);
    await page.get('video').trigger('click');
    await page.get('video').trigger('click');
    vi.advanceTimersByTime(800);
    expect(page.emitted('like')).toBeUndefined();
    expect(pause).not.toHaveBeenCalled();
  });
  test('the heart button and its response do not affect playback', async () => {
    const page = await open();
    await page.get('[aria-label="Like"]').trigger('click');
    await page.setProps({ reel: { ...reel, likedByViewer: true, likes: 3 } });
    expect(page.emitted('like')).toHaveLength(1);
    expect(pause).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
    expect(page.get('video').attributes('src')).toBe('/reel.mp4');
  });
  test('a single tap pauses after the double tap interval', async () => {
    const page = await open();
    await page.get('video').trigger('click');
    vi.advanceTimersByTime(301);
    expect(pause).toHaveBeenCalledOnce();
  });
  test('leaving cancels pending taps and stops playback', async () => {
    const page = await open();
    await page.get('video').trigger('click');
    page.unmount();
    wrapper = undefined;
    vi.advanceTimersByTime(400);
    expect(pause).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });
});
