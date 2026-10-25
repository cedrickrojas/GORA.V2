import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { ApiError } from '@/services/api-client';
import { liveApi, releaseLive, type LiveStreamInfo } from '@/services/live-api.service';
import { useAuthStore } from '@/stores/auth';
import { createAuthorizedCall } from '@/stores/authorized';
import { gatherDescription, mediaError, stopMedia } from '@/utils/live-media';

export function useLive() {
  const auth = useAuthStore();
  const authorized = createAuthorizedCall(auth);
  const live = ref<LiveStreamInfo | null>(null);
  const localStream = shallowRef<MediaStream | null>(null);
  const remoteStream = shallowRef<MediaStream | null>(null);
  const busy = ref(false);
  const error = ref('');
  const status = ref('');
  const micOn = ref(true);
  const cameraOn = ref(true);
  const viewerCount = ref(0);
  const broadcasting = ref(false);
  const watching = ref(false);
  const isOwner = computed(() => !!live.value && live.value.host.id === auth.currentUser?.id);
  let generation = 0;
  let activeToken = '';
  let viewerId = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let connectionTimer: ReturnType<typeof setTimeout> | undefined;
  const peers = new Map<string, RTCPeerConnection>();
  let config: RTCConfiguration = {};
  let lastHeartbeat = 0;

  function dispose() {
    generation++;
    clearTimeout(timer);
    clearTimeout(connectionTimer);
    peers.forEach((peer) => peer.close());
    peers.clear();
    stopMedia(localStream.value);
    stopMedia(remoteStream.value);
    localStream.value = null;
    remoteStream.value = null;
    if (live.value && activeToken) {
      if (broadcasting.value) releaseLive(activeToken, live.value.id);
      else if (viewerId) releaseLive(activeToken, live.value.id, viewerId);
    }
    broadcasting.value = false;
    watching.value = false;
    viewerId = '';
    activeToken = '';
    busy.value = false;
  }

  async function enter(id?: string) {
    dispose();
    live.value = null;
    error.value = '';
    status.value = '';
    const version = generation;
    busy.value = true;
    try {
      if (id) {
        const info = await authorized((token) => liveApi.get(token, id));
        if (version !== generation) return;
        live.value = info;
        if (info.status !== 'LIVE') status.value = 'This live has ended.';
        else if (isOwner.value) status.value = 'This live is broadcasting from another window. You can end it here.';
        else {
          busy.value = false;
          await watchLive();
        }
      } else {
        const own = await authorized(liveApi.mine);
        if (version !== generation) return;
        live.value = own;
        if (live.value) status.value = 'You already have a live in another window. End it before starting another.';
      }
    } catch (caught) {
      if (version === generation) error.value = mediaError(caught);
    } finally {
      if (version === generation) busy.value = false;
    }
  }

  async function preview() {
    if (busy.value || broadcasting.value) return;
    const version = generation;
    busy.value = true;
    error.value = '';
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
        throw new Error('Use a supported browser on HTTPS or localhost to access your camera and microphone.');
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      if (version !== generation) {
        stopMedia(media);
        return;
      }
      stopMedia(localStream.value);
      localStream.value = media;
      micOn.value = true;
      cameraOn.value = true;
      media.getTracks().forEach((track) => {
        track.onended = () => {
          if (version !== generation) return;
          dispose();
          status.value = 'Broadcast stopped.';
          error.value = 'Camera or microphone disconnected. Open your camera again to restart.';
        };
      });
    } catch (caught) {
      if (version === generation) error.value = mediaError(caught);
    } finally {
      if (version === generation) busy.value = false;
    }
  }

  function schedule(version: number, task: () => Promise<void>) {
    if (version !== generation) return;
    timer = setTimeout(() => {
      if (version === generation) void task();
    }, 1500);
  }

  async function start(title: string) {
    if (busy.value || broadcasting.value || !localStream.value || !title.trim()) return;
    const version = generation;
    const token = auth.accessToken!;
    busy.value = true;
    error.value = '';
    try {
      const settings = await authorized((value) => liveApi.config(value));
      if (version !== generation) return;
      config = { iceServers: settings.iceServers };
      const info = await authorized(async (value) => {
        const result = await liveApi.start(value, title.trim());
        if (version !== generation) releaseLive(value, result.id);
        return result;
      });
      if (version !== generation) return;
      live.value = info;
      activeToken = token;
      broadcasting.value = true;
      lastHeartbeat = Date.now();
      status.value = 'You are live';
      void hostTick(version);
    } catch (caught) {
      if (version === generation) error.value = mediaError(caught);
    } finally {
      if (version === generation) busy.value = false;
    }
  }

  async function hostOffer(id: string, peer: RTCPeerConnection, version: number) {
    try {
      localStream.value!.getTracks().forEach((track) => peer.addTrack(track, localStream.value!));
      const sdp = await gatherDescription(peer, await peer.createOffer());
      if (version !== generation || peers.get(id) !== peer) return;
      await authorized((token) => liveApi.signal(token, live.value!.id, id, 'offer', sdp));
    } catch (caught) {
      if (version === generation && peers.get(id) === peer) {
        error.value = mediaError(caught);
        peer.close();
        // Keep the failed session until the viewer reconnects, avoiding repeated negotiation.
      }
    }
  }

  async function hostTick(version: number) {
    try {
      const rows = await authorized((token) => liveApi.peers(token, live.value!.id));
      if (version !== generation) return;
      error.value = '';
      lastHeartbeat = Date.now();
      viewerCount.value = rows.length;
      const active = new Set(rows.map((row) => row.id));
      peers.forEach((peer, id) => {
        if (!active.has(id)) {
          peer.close();
          peers.delete(id);
        }
      });
      for (const row of rows) {
        let peer = peers.get(row.id);
        if (!peer) {
          peer = new RTCPeerConnection(config);
          peers.set(row.id, peer);
          void hostOffer(row.id, peer, version);
        } else if (row.answer && peer.signalingState === 'have-local-offer') {
          await peer.setRemoteDescription({ type: 'answer', sdp: row.answer });
          if (version !== generation) return;
        }
      }
    } catch (caught) {
      if (version !== generation) return;
      error.value = mediaError(caught);
      if (
        (caught instanceof ApiError && [401, 403, 404, 410].includes(caught.status)) ||
        Date.now() - lastHeartbeat >= 45_000
      ) {
        dispose();
        status.value = 'This live has ended.';
        return;
      }
    }
    schedule(version, () => hostTick(version));
  }

  async function watchLive() {
    if (busy.value || !live.value || isOwner.value || live.value.status !== 'LIVE') return;
    const info = live.value;
    dispose();
    live.value = info;
    const version = generation;
    const token = auth.accessToken!;
    busy.value = true;
    error.value = '';
    status.value = 'Connecting to live...';
    try {
      if (typeof RTCPeerConnection === 'undefined')
        throw new Error('This browser does not support live video. Try an updated browser.');
      const settings = await authorized((value) => liveApi.config(value));
      if (version !== generation) return;
      config = { iceServers: settings.iceServers };
      const joined = await authorized(async (value) => {
        const result = await liveApi.join(value, info.id);
        if (version !== generation) releaseLive(value, info.id, result.id);
        return result;
      });
      if (version !== generation) return;
      viewerId = joined.id;
      activeToken = token;
      watching.value = true;
      const peer = new RTCPeerConnection(config);
      peers.set(viewerId, peer);
      peer.ontrack = (event) => {
        if (version !== generation) return;
        remoteStream.value = event.streams[0] ?? remoteStream.value ?? new MediaStream();
        if (!event.streams[0]) remoteStream.value.addTrack(event.track);
      };
      peer.onconnectionstatechange = () => {
        if (version !== generation) return;
        if (peer.connectionState === 'connected') {
          clearTimeout(connectionTimer);
          status.value = 'Live';
          error.value = '';
        }
        if (peer.connectionState === 'failed') connectionFailed();
        if (peer.connectionState === 'disconnected') {
          status.value = 'Connection interrupted. Reconnecting...';
          clearTimeout(connectionTimer);
          connectionTimer = setTimeout(connectionFailed, 30_000);
        }
      };
      connectionTimer = setTimeout(connectionFailed, 30_000);
      void viewerTick(version, peer);
    } catch (caught) {
      if (version === generation) {
        dispose();
        error.value = mediaError(caught);
      }
    } finally {
      if (version === generation) busy.value = false;
    }
  }

  function connectionFailed() {
    dispose();
    status.value = 'Could not connect';
    error.value = 'The live connection was interrupted or this network cannot connect. Try reconnecting.';
  }

  async function viewerTick(version: number, peer: RTCPeerConnection) {
    try {
      const row = await authorized((token) => liveApi.poll(token, live.value!.id, viewerId));
      if (version !== generation) return;
      if (row.offer && !peer.remoteDescription) {
        await peer.setRemoteDescription({ type: 'offer', sdp: row.offer });
        if (version !== generation) return;
        const sdp = await gatherDescription(peer, await peer.createAnswer());
        if (version !== generation) return;
        await authorized((token) => liveApi.signal(token, live.value!.id, viewerId, 'answer', sdp));
      }
    } catch (caught) {
      if (version !== generation) return;
      error.value = mediaError(caught);
      if (caught instanceof ApiError && [401, 403, 404, 410].includes(caught.status)) {
        dispose();
        status.value = 'This live is no longer available.';
        if (caught.status === 410 && caught.message === 'This live has ended.' && live.value)
          live.value.status = 'ENDED';
        return;
      }
    }
    schedule(version, () => viewerTick(version, peer));
  }

  async function end() {
    if (!live.value || !isOwner.value || busy.value) return;
    const id = live.value.id;
    // Release devices immediately, even when the API is slow or offline.
    dispose();
    const version = generation;
    busy.value = true;
    status.value = 'Ending live...';
    try {
      await authorized((token) => liveApi.end(token, id));
      if (version !== generation) return;
      dispose();
      live.value = null;
      status.value = 'Your live has ended.';
      error.value = '';
    } catch (caught) {
      if (version === generation) {
        busy.value = false;
        error.value = mediaError(caught);
      }
    }
  }

  function toggle(kind: 'audio' | 'video') {
    const enabled = kind === 'audio' ? !micOn.value : !cameraOn.value;
    localStream.value
      ?.getTracks()
      .filter((track) => track.kind === kind)
      .forEach((track) => {
        track.enabled = enabled;
      });
    if (kind === 'audio') micOn.value = enabled;
    else cameraOn.value = enabled;
  }
  onScopeDispose(dispose);
  watch(
    () => auth.sessionVersion,
    () => {
      dispose();
      live.value = null;
      error.value = '';
      status.value = '';
    },
    { flush: 'sync' },
  );
  return {
    live,
    localStream,
    remoteStream,
    busy,
    error,
    status,
    micOn,
    cameraOn,
    viewerCount,
    broadcasting,
    watching,
    isOwner,
    enter,
    preview,
    start,
    watchLive,
    end,
    toggle,
    dispose,
  };
}
