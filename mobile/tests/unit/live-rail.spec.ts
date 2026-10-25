import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import LiveRail from '@/components/live/LiveRail.vue';
import { liveApi, type LiveStreamInfo } from '@/services/live-api.service';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/services/live-api.service', () => ({ liveApi: { list: vi.fn() } }));
const stream: LiveStreamInfo = {
  id: 'stream',
  title: 'Court action',
  status: 'LIVE',
  host: { id: 'host', username: 'host', displayName: 'Host Player', avatarUrl: null },
  startedAt: null,
  endedAt: null,
  viewerCount: 0,
};
const wrappers: ReturnType<typeof mount>[] = [];
function rail(props = {}) {
  const wrapper = mount(LiveRail, {
    props,
    global: { stubs: { UserAvatar: true, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.accessToken = 'viewer-token';
  auth.currentUser = {
    id: 'viewer',
    username: 'viewer',
    firstName: 'Viewer',
    lastName: 'Player',
    email: 'viewer@example.test',
    profileImageUrl: null,
    role: 'USER',
    bio: null,
    city: null,
  };
  vi.mocked(liveApi.list).mockResolvedValue([stream]);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});

test('loads live discovery when nested under Home without depending on Ionic route hooks', async () => {
  const wrapper = rail();
  await flushPromises();
  expect(wrapper.text()).toContain('Host Player');
  expect(wrapper.find('a[href="/live/stream"]').exists()).toBe(true);
  expect(liveApi.list).toHaveBeenCalledWith('viewer-token');
});

test('pauses discovery while the cached Home page is inactive and refreshes on return', async () => {
  const wrapper = rail({ active: false });
  await flushPromises();
  expect(liveApi.list).not.toHaveBeenCalled();
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(liveApi.list).toHaveBeenCalledTimes(1);
  await wrapper.setProps({ active: false });
  await vi.advanceTimersByTimeAsync(20000);
  expect(liveApi.list).toHaveBeenCalledTimes(1);
  await wrapper.setProps({ active: true });
  await flushPromises();
  expect(liveApi.list).toHaveBeenCalledTimes(2);
});

test('shows an empty directory with a working Go Live route', async () => {
  vi.mocked(liveApi.list).mockResolvedValue([]);
  const wrapper = rail({ showEmpty: true });
  await flushPromises();
  expect(wrapper.text()).toContain('No live broadcasts');
  expect(wrapper.find('a[href="/create/live"]').exists()).toBe(true);
});

test('removes ended streams on refresh and never reuses another account response', async () => {
  const wrapper = rail();
  await flushPromises();
  vi.mocked(liveApi.list).mockResolvedValue([]);
  await vi.advanceTimersByTimeAsync(10000);
  await flushPromises();
  expect(wrapper.find('a[href="/live/stream"]').exists()).toBe(false);
  let resolve!: (value: LiveStreamInfo[]) => void;
  vi.mocked(liveApi.list).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await vi.advanceTimersByTimeAsync(10000);
  useAuthStore().sessionVersion++;
  await flushPromises();
  resolve([stream]);
  await flushPromises();
  expect(wrapper.find('a[href="/live/stream"]').exists()).toBe(false);
});
