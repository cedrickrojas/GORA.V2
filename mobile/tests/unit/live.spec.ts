import { createPinia, setActivePinia } from 'pinia';
import { effectScope, type EffectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useLive } from '@/composables/useLive';
import { useAuthStore } from '@/stores/auth';
import { liveApi, releaseLive, type LiveStreamInfo } from '@/services/live-api.service';
import { ApiError } from '@/services/api-client';
import { gatherDescription, mediaError } from '@/utils/live-media';

vi.mock('@/services/live-api.service', () => ({
  liveApi: {
    mine: vi.fn(),
    list: vi.fn(),
    config: vi.fn(),
    start: vi.fn(),
    get: vi.fn(),
    end: vi.fn(),
    peers: vi.fn(),
    join: vi.fn(),
    poll: vi.fn(),
    leave: vi.fn(),
    signal: vi.fn(),
  },
  releaseLive: vi.fn(),
}));
const info: LiveStreamInfo = {
  id: 'live-id',
  title: 'Court action',
  status: 'LIVE',
  host: { id: 'host', username: 'host', displayName: 'Host Player', avatarUrl: null },
  startedAt: '2026-10-10T00:00:00Z',
  endedAt: null,
  viewerCount: 0,
};
class Peer extends EventTarget {
  static all: Peer[] = [];
  connectionState = 'new';
  iceGatheringState = 'complete';
  signalingState = 'stable';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack = vi.fn();
  close = vi.fn(() => {
    this.connectionState = 'closed';
    this.dispatchEvent(new Event('connectionstatechange'));
  });
  constructor() {
    super();
    Peer.all.push(this);
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: 'v=0\noffer' };
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'v=0\nanswer' };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
    if (description.type === 'offer') this.signalingState = 'have-local-offer';
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
    if (description.type === 'answer') this.signalingState = 'stable';
  }
}
const scopes: EffectScope[] = [];
function instance() {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(useLive)!;
}
function media() {
  const tracks = ['video', 'audio'].map((kind) => ({ kind, enabled: true, stop: vi.fn(), onended: null }));
  return { tracks, stream: { getTracks: () => tracks } as unknown as MediaStream };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function signIn(id = 'host') {
  const auth = useAuthStore();
  auth.accessToken = 'token-' + id;
  auth.currentUser = {
    id,
    username: id,
    email: id + '@example.test',
    firstName: id,
    lastName: 'Player',
    role: 'USER',
    profileImageUrl: null,
    bio: null,
    city: null,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  setActivePinia(createPinia());
  signIn();
  Peer.all = [];
  vi.stubGlobal('RTCPeerConnection', Peer);
  vi.mocked(liveApi.list).mockResolvedValue([]);
  vi.mocked(liveApi.mine).mockResolvedValue(null);
  vi.mocked(liveApi.config).mockResolvedValue({ iceServers: [], maxViewers: 10 });
  vi.mocked(liveApi.start).mockResolvedValue(structuredClone(info));
  vi.mocked(liveApi.get).mockResolvedValue(structuredClone(info));
  vi.mocked(liveApi.peers).mockResolvedValue([]);
  vi.mocked(liveApi.join).mockResolvedValue({ id: 'viewer-session' });
  vi.mocked(liveApi.poll).mockResolvedValue({ id: 'viewer-session', offer: 'v=0\noffer', answer: null });
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('starts only after camera permission and publishes tracks to joining viewers', async () => {
  const { stream, tracks } = media();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const live = instance();
  await live.enter();
  await live.start('Game');
  expect(liveApi.start).not.toHaveBeenCalled();
  await live.preview();
  await live.start(' Game ');
  await flushPromises();
  expect(live.broadcasting.value).toBe(true);
  expect(liveApi.start).toHaveBeenCalledWith('token-host', 'Game');
  vi.mocked(liveApi.peers).mockResolvedValue([{ id: 'viewer-session', offer: null, answer: null }]);
  await vi.advanceTimersByTimeAsync(1500);
  await flushPromises();
  expect(Peer.all[0].addTrack).toHaveBeenCalledTimes(2);
  expect(liveApi.signal).toHaveBeenCalledWith('token-host', 'live-id', 'viewer-session', 'offer', 'v=0\noffer');
  live.toggle('audio');
  expect(tracks[1].enabled).toBe(false);
  live.toggle('video');
  expect(tracks[0].enabled).toBe(false);
  live.dispose();
  expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true);
  expect(Peer.all[0].close).toHaveBeenCalled();
  expect(releaseLive).toHaveBeenCalledWith('token-host', 'live-id');
});

test('stops camera returned after leaving while permission is pending', async () => {
  const pending = deferred<MediaStream>();
  const { stream, tracks } = media();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => pending.promise) } });
  const live = instance();
  const opening = live.preview();
  live.dispose();
  pending.resolve(stream);
  await opening;
  expect(live.localStream.value).toBeNull();
  expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true);
});

test('ends a late-created stream instead of leaking a broadcast after navigation', async () => {
  const { stream } = media();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const pending = deferred<LiveStreamInfo>();
  vi.mocked(liveApi.start).mockReturnValue(pending.promise);
  const live = instance();
  await live.preview();
  const starting = live.start('Game');
  await flushPromises();
  live.dispose();
  pending.resolve(info);
  await starting;
  expect(releaseLive).toHaveBeenCalledWith('token-host', 'live-id');
  expect(live.broadcasting.value).toBe(false);
});

test('connects a viewer without requesting camera and releases only their session', async () => {
  signIn('viewer');
  const getUserMedia = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const live = instance();
  await live.enter('live-id');
  await flushPromises();
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(live.watching.value).toBe(true);
  expect(liveApi.signal).toHaveBeenCalledWith('token-viewer', 'live-id', 'viewer-session', 'answer', 'v=0\nanswer');
  const { stream } = media();
  Peer.all[0].ontrack?.({ streams: [stream] });
  Peer.all[0].connectionState = 'connected';
  Peer.all[0].onconnectionstatechange?.();
  expect(live.remoteStream.value).toBe(stream);
  expect(live.status.value).toBe('Live');
  live.dispose();
  expect(releaseLive).toHaveBeenCalledWith('token-viewer', 'live-id', 'viewer-session');
});

test('reconnect creates a new session and closes the old peer', async () => {
  signIn('viewer');
  const live = instance();
  await live.enter('live-id');
  await flushPromises();
  const first = Peer.all[0];
  vi.mocked(liveApi.join).mockResolvedValue({ id: 'replacement' });
  await live.watchLive();
  await flushPromises();
  expect(first.close).toHaveBeenCalled();
  expect(releaseLive).toHaveBeenCalledWith('token-viewer', 'live-id', 'viewer-session');
  expect(liveApi.signal).toHaveBeenLastCalledWith('token-viewer', 'live-id', 'replacement', 'answer', 'v=0\nanswer');
});

test('account switch immediately stops the camera and closes the previous account broadcast', async () => {
  const { stream, tracks } = media();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const live = instance();
  await live.preview();
  await live.start('Game');
  await flushPromises();
  useAuthStore().sessionVersion++;
  expect(live.live.value).toBeNull();
  expect(live.broadcasting.value).toBe(false);
  expect(tracks[0].stop).toHaveBeenCalled();
  expect(releaseLive).toHaveBeenCalledWith('token-host', 'live-id');
});

test('host end or permission revocation closes viewer connections and stops polling', async () => {
  signIn('viewer');
  const live = instance();
  await live.enter('live-id');
  await flushPromises();
  vi.mocked(liveApi.poll).mockRejectedValue(new ApiError(410, 'This live has ended.'));
  await vi.advanceTimersByTimeAsync(1500);
  await flushPromises();
  expect(live.watching.value).toBe(false);
  expect(live.live.value?.status).toBe('ENDED');
  const calls = vi.mocked(liveApi.poll).mock.calls.length;
  await vi.advanceTimersByTimeAsync(10000);
  expect(liveApi.poll).toHaveBeenCalledTimes(calls);
});

test('times out a viewer that never establishes a media connection', async () => {
  signIn('viewer');
  const live = instance();
  await live.enter('live-id');
  await flushPromises();
  await vi.advanceTimersByTimeAsync(30000);
  expect(live.watching.value).toBe(false);
  expect(live.error.value).toContain('network');
  expect(Peer.all[0].close).toHaveBeenCalled();
});

test('stops host devices immediately while End Live confirmation is pending', async () => {
  const { stream, tracks } = media();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const live = instance();
  await live.preview();
  await live.start('Game');
  await flushPromises();
  const pending = deferred<unknown>();
  vi.mocked(liveApi.end).mockReturnValue(pending.promise);
  const ending = live.end();
  expect(tracks[0].stop).toHaveBeenCalled();
  expect(live.localStream.value).toBeNull();
  expect(live.busy.value).toBe(true);
  pending.resolve({ ended: true });
  await ending;
  expect(live.live.value).toBeNull();
  expect(live.status.value).toBe('Your live has ended.');
});

test('permits reconnect when only the viewing session expired while the live remains active', async () => {
  signIn('viewer');
  const live = instance();
  await live.enter('live-id');
  await flushPromises();
  vi.mocked(liveApi.poll).mockRejectedValue(new ApiError(410, 'Your viewing session has ended. Reconnect to watch.'));
  await vi.advanceTimersByTimeAsync(1500);
  expect(live.watching.value).toBe(false);
  expect(live.live.value?.status).toBe('LIVE');
  vi.mocked(liveApi.poll).mockResolvedValue({ id: 'viewer-session', offer: null, answer: null });
  await live.watchLive();
  expect(live.watching.value).toBe(true);
});

test('leaves a late-created viewing session after account switch', async () => {
  signIn('viewer');
  const pending = deferred<{ id: string }>();
  vi.mocked(liveApi.join).mockReturnValue(pending.promise);
  const live = instance();
  const joining = live.enter('live-id');
  await flushPromises();
  useAuthStore().sessionVersion++;
  pending.resolve({ id: 'late-peer' });
  await joining;
  expect(releaseLive).toHaveBeenCalledWith('token-viewer', 'live-id', 'late-peer');
  expect(live.watching.value).toBe(false);
  expect(live.live.value).toBeNull();
});

test('reports denied device permission and leaves no active camera', async () => {
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
  });
  const live = instance();
  await live.preview();
  expect(live.error.value).toContain('Allow camera');
  expect(live.localStream.value).toBeNull();
  expect(live.busy.value).toBe(false);
  expect(mediaError(new DOMException('Missing', 'NotFoundError'))).toContain('No camera');
});

test('waits for ICE candidates and cancels gathering when the peer closes', async () => {
  const peer = new Peer();
  peer.iceGatheringState = 'gathering';
  const result = gatherDescription(peer as unknown as RTCPeerConnection, { type: 'offer', sdp: 'v=0\noffer' });
  await flushPromises();
  peer.iceGatheringState = 'complete';
  peer.dispatchEvent(new Event('icegatheringstatechange'));
  expect(await result).toBe('v=0\noffer');
  peer.iceGatheringState = 'gathering';
  const closing = gatherDescription(peer as unknown as RTCPeerConnection, { type: 'offer', sdp: 'v=0\nclosed' });
  const rejected = expect(closing).rejects.toThrow('Connection closed');
  await flushPromises();
  peer.close();
  await rejected;
});
