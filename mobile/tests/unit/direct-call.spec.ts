import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useDirectCallStore } from '@/stores/direct-call';
import { directCallApi } from '@/services/direct-call-api.service';
import { showNotice } from '@/utils/notice';

vi.mock('@/services/direct-call-api.service', () => ({
  directCallApi: {
    start: vi.fn(),
    end: vi.fn(() => Promise.resolve({ ended: true })),
    incoming: vi.fn(() => Promise.resolve({ call: null })),
    get: vi.fn(),
    answer: vi.fn(),
    candidate: vi.fn(),
  },
}));
vi.mock('@/services/live-api.service', () => ({
  liveApi: { config: vi.fn(() => Promise.resolve({ iceServers: [] })) },
}));
vi.mock('@/utils/notice', () => ({ showNotice: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
describe('direct call session and media cleanup', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
    const auth = useAuthStore();
    auth.accessToken = 'alice-token';
    auth.currentUser = {
      id: 'alice',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'QA',
      email: 'alice@example.test',
      role: 'USER',
      profileImageUrl: null,
      bio: null,
      city: null,
    };
    vi.stubGlobal('RTCPeerConnection', class {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  test('releases a microphone acquired after the account changed without calling anyone', async () => {
    const pending = deferred<MediaStream>();
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => pending.promise) } });
    const calls = useDirectCallStore();
    const start = calls.start('conversation', 'AUDIO');
    useAuthStore().accessToken = 'bob-token';
    pending.resolve(stream);
    await start;
    expect(stop).toHaveBeenCalledOnce();
    expect(directCallApi.start).not.toHaveBeenCalled();
    expect(calls.call).toBeNull();
    expect(calls.localStream).toBeNull();
    expect(calls.busy).toBe(false);
  });
  test('reports microphone denial and resets the pending call without sending signaling', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.reject(new DOMException('Denied', 'NotAllowedError'))),
      },
    });
    const calls = useDirectCallStore();
    await calls.start('conversation', 'AUDIO');
    expect(showNotice).toHaveBeenCalledWith(expect.stringContaining('Allow camera and microphone'));
    expect(directCallApi.start).not.toHaveBeenCalled();
    expect(calls.call).toBeNull();
    expect(calls.busy).toBe(false);
  });
  test('hangs up an existing call and releases both local and remote tracks on account changes', () => {
    const calls = useDirectCallStore();
    const localStop = vi.fn(),
      remoteStop = vi.fn();
    calls.localStream = { getTracks: () => [{ stop: localStop }] } as unknown as MediaStream;
    calls.remoteStream = { getTracks: () => [{ stop: remoteStop }] } as unknown as MediaStream;
    calls.call = {
      id: 'call-id',
      conversationId: 'conversation',
      caller: { id: 'alice', username: 'alice', displayName: 'Alice', avatarUrl: null },
      callee: { id: 'bob', username: 'bob', displayName: 'Bob', avatarUrl: null },
      mode: 'AUDIO',
      status: 'ACTIVE',
      offer: '',
      answer: null,
      callerCandidates: [],
      calleeCandidates: [],
      createdAt: '2026-10-10',
      answeredAt: null,
    };
    useAuthStore().accessToken = null;
    expect(localStop).toHaveBeenCalledOnce();
    expect(remoteStop).toHaveBeenCalledOnce();
    expect(calls.call).toBeNull();
    expect(calls.connected).toBe(false);
  });
  test('keeps audio when the camera disconnects and ends the call when the microphone disconnects', async () => {
    class Track extends EventTarget {
      enabled = true;
      stop = vi.fn();
      constructor(public kind: string) {
        super();
      }
    }
    class Stream {
      constructor(private tracks: Track[] = []) {}
      getTracks() {
        return [...this.tracks];
      }
      getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
      }
      getVideoTracks() {
        return this.tracks.filter((t) => t.kind === 'video');
      }
      removeTrack(track: Track) {
        this.tracks = this.tracks.filter((t) => t !== track);
      }
    }
    class Peer {
      localDescription: RTCSessionDescriptionInit | null = null;
      addTrack() {}
      createOffer() {
        return Promise.resolve({ type: 'offer', sdp: 'v=0\r\n' });
      }
      setLocalDescription(description: RTCSessionDescriptionInit) {
        this.localDescription = description;
        return Promise.resolve();
      }
      close() {}
    }
    const audio = new Track('audio'),
      video = new Track('video');
    vi.stubGlobal('MediaStream', Stream);
    vi.stubGlobal('RTCPeerConnection', Peer);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(new Stream([audio, video]))) },
    });
    vi.mocked(directCallApi.start).mockResolvedValue({
      id: 'call-id',
      conversationId: 'conversation',
      mode: 'VIDEO',
      status: 'RINGING',
      caller: { id: 'alice', username: 'alice', displayName: 'Alice', avatarUrl: null },
      callee: { id: 'bob', username: 'bob', displayName: 'Bob', avatarUrl: null },
      offer: 'v=0\r\n',
      answer: null,
      callerCandidates: [],
      calleeCandidates: [],
      createdAt: '2026-10-10',
      answeredAt: null,
    });
    const calls = useDirectCallStore();
    await calls.start('conversation', 'VIDEO');
    expect(calls.cameraOn).toBe(true);
    video.dispatchEvent(new Event('ended'));
    expect(calls.cameraOn).toBe(false);
    expect(calls.call?.id).toBe('call-id');
    expect(calls.localStream?.getAudioTracks()).toHaveLength(1);
    audio.dispatchEvent(new Event('ended'));
    expect(calls.call).toBeNull();
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(directCallApi.end).toHaveBeenCalledWith('alice-token', 'call-id');
  });
  test('does not show a declined call again while its server update is still in flight', async () => {
    vi.useFakeTimers();
    vi.mocked(directCallApi.incoming).mockResolvedValue({
      call: {
        id: 'incoming-call',
        conversationId: 'conversation',
        mode: 'AUDIO',
        status: 'RINGING',
        caller: { id: 'bob', username: 'bob', displayName: 'Bob', avatarUrl: null },
        callee: { id: 'alice', username: 'alice', displayName: 'Alice', avatarUrl: null },
        offer: 'v=0\r\n',
        answer: null,
        callerCandidates: [],
        calleeCandidates: [],
        createdAt: '2026-10-10',
        answeredAt: null,
      },
    });
    const pending = deferred<{ ended: boolean }>();
    vi.mocked(directCallApi.end).mockReturnValueOnce(pending.promise);
    const calls = useDirectCallStore();
    try {
      calls.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      expect(calls.incoming).toBe(true);
      await calls.end();
      await vi.advanceTimersByTimeAsync(2500);
      expect(calls.call).toBeNull();
      expect(directCallApi.incoming).toHaveBeenCalledTimes(2);
    } finally {
      pending.resolve({ ended: true });
      calls.stopPolling();
    }
  });
});
