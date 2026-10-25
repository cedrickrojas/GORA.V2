import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { directCallApi as api, type DirectCall } from '@/services/direct-call-api.service';
import { liveApi } from '@/services/live-api.service';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from './auth';
import { captureSession, describeContentError } from './authorized';
import { mediaError, stopMedia } from '@/utils/live-media';
import { showNotice } from '@/utils/notice';

export const useDirectCallStore = defineStore('direct-call', () => {
  const auth = useAuthStore();
  const call = shallowRef<DirectCall | null>(null);
  const localStream = shallowRef<MediaStream | null>(null);
  const remoteStream = shallowRef<MediaStream | null>(null);
  const connected = ref(false);
  const busy = ref(false);
  const muted = ref(false);
  const cameraOn = ref(false);
  const error = ref<string | null>(null);
  const incoming = computed(
    () => !!call.value && call.value.callee.id === auth.currentUser?.id && call.value.status === 'RINGING',
  );
  const partner = computed(() =>
    call.value?.caller.id === auth.currentUser?.id ? call.value?.callee : call.value?.caller,
  );
  let peer: RTCPeerConnection | null = null;
  let token = '';
  let generation = 0;
  let polling = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let localCandidates: RTCIceCandidateInit[] = [];
  const seen = new Set<string>();
  const dismissed = new Set<string>();
  let candidateChain: Promise<unknown> = Promise.resolve();

  function cleanup(notify = false) {
    const previous = call.value;
    if (previous) {
      dismissed.add(previous.id);
      if (dismissed.size > 50) dismissed.delete(dismissed.values().next().value!);
    }
    const previousToken = token;
    generation++;
    peer?.close();
    peer = null;
    stopMedia(localStream.value);
    stopMedia(remoteStream.value);
    localStream.value = null;
    remoteStream.value = null;
    call.value = null;
    connected.value = false;
    muted.value = false;
    cameraOn.value = false;
    busy.value = false;
    localCandidates = [];
    candidateChain = Promise.resolve();
    seen.clear();
    token = '';
    if (notify && previous && previousToken) void api.end(previousToken, previous.id).catch(() => undefined);
  }
  async function end() {
    cleanup(true);
  }
  function fail(caught: unknown) {
    error.value = caught instanceof ApiError ? describeContentError(caught) : mediaError(caught);
    void showNotice(error.value);
    cleanup(true);
  }
  function flushCandidates() {
    const active = call.value;
    const access = token;
    const version = generation;
    if (!active || !access) return;
    for (const candidate of localCandidates.splice(0)) {
      candidateChain = candidateChain
        .catch(() => undefined)
        .then(async () => {
          if (version !== generation) return;
          try {
            await api.candidate(access, active.id, candidate);
          } catch (caught) {
            if (
              version === generation &&
              caught instanceof ApiError &&
              [401, 403, 404].includes(caught.status)
            )
              fail(caught);
          }
        });
    }
  }
  function watchDevice(track: MediaStreamTrack, version: number) {
    track.addEventListener(
      'ended',
      () => {
        if (version !== generation) return;
        if (track.kind === 'audio') {
          fail(new Error('Your microphone disconnected. Check the device and call again.'));
        } else {
          localStream.value?.removeTrack(track);
          localStream.value = new MediaStream(localStream.value?.getTracks() ?? []);
          cameraOn.value = false;
          void showNotice('Your camera stopped. Check the device to turn it on again.');
        }
      },
      { once: true },
    );
  }
  async function makePeer(stream: MediaStream, isCurrent: () => boolean, version: number) {
    const config = await liveApi.config(token);
    if (!isCurrent() || version !== generation) {
      stopMedia(stream);
      throw new Error('The account or call changed.');
    }
    const pc = new RTCPeerConnection({ iceServers: config.iceServers });
    peer = pc;
    localStream.value = stream;
    stream.getTracks().forEach((track) => watchDevice(track, version));
    remoteStream.value = new MediaStream();
    muted.value = false;
    cameraOn.value = stream.getVideoTracks().length > 0;
    pc.onicecandidate = (event) => {
      if (event.candidate && version === generation) {
        localCandidates.push(event.candidate.toJSON());
        flushCandidates();
      }
    };
    pc.ontrack = (event) => {
      if (version === generation) {
        remoteStream.value?.addTrack(event.track);
        remoteStream.value = new MediaStream(remoteStream.value?.getTracks() ?? []);
        const refreshTracks = () => {
          if (version === generation)
            remoteStream.value = new MediaStream(remoteStream.value?.getTracks() ?? []);
        };
        event.track.onmute = refreshTracks;
        event.track.onunmute = refreshTracks;
      }
    };
    pc.onconnectionstatechange = () => {
      if (version !== generation) return;
      connected.value = pc.connectionState === 'connected';
      if (pc.connectionState === 'failed')
        fail(new Error('The call could not connect. Try again on another network.'));
    };
    return pc;
  }
  async function start(conversationId: string, mode: 'AUDIO' | 'VIDEO') {
    if (call.value || busy.value) {
      void showNotice('Finish your current call first.');
      return;
    }
    if (
      !auth.accessToken ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === 'undefined'
    ) {
      void showNotice('Calls need a supported browser with microphone access.');
      return;
    }
    const isCurrent = captureSession(auth);
    const version = generation;
    token = auth.accessToken;
    const access = token;
    busy.value = true;
    error.value = null;
    let media: MediaStream | null = null;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'VIDEO',
      });
      if (!isCurrent() || version !== generation) {
        stopMedia(media);
        return;
      }
      const pc = await makePeer(media, isCurrent, version);
      media.getTracks().forEach((track) => pc.addTrack(track, media!));
      if (!media.getVideoTracks().length)
        pc.addTransceiver('video', { direction: 'sendrecv', streams: [media] });
      await pc.setLocalDescription(await pc.createOffer());
      const result = await api.start(access, conversationId, mode, pc.localDescription!.sdp);
      if (!isCurrent() || version !== generation) {
        void api.end(access, result.id).catch(() => undefined);
        return;
      }
      call.value = result;
      flushCandidates();
    } catch (caught) {
      stopMedia(media);
      if (isCurrent() && version === generation) fail(caught);
    } finally {
      if (isCurrent() && version === generation) busy.value = false;
    }
  }
  async function answer(video: boolean) {
    const active = call.value;
    if (!active || !incoming.value || busy.value) return;
    const isCurrent = captureSession(auth);
    const version = generation;
    const access = token;
    busy.value = true;
    error.value = null;
    let media: MediaStream | null = null;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      if (!isCurrent() || version !== generation) {
        stopMedia(media);
        return;
      }
      const pc = await makePeer(media, isCurrent, version);
      await pc.setRemoteDescription({ type: 'offer', sdp: active.offer });
      pc.getTransceivers().forEach((transceiver) => {
        transceiver.direction = 'sendrecv';
      });
      media.getTracks().forEach((track) => pc.addTrack(track, media!));
      await pc.setLocalDescription(await pc.createAnswer());
      const result = await api.answer(access, active.id, pc.localDescription!.sdp);
      if (!isCurrent() || version !== generation) return;
      call.value = result;
      flushCandidates();
      await applyRemote(result);
    } catch (caught) {
      stopMedia(media);
      if (isCurrent() && version === generation) fail(caught);
    } finally {
      if (isCurrent() && version === generation) busy.value = false;
    }
  }
  async function applyRemote(active: DirectCall) {
    const pc = peer;
    if (!pc || pc.connectionState === 'closed') return;
    if (active.caller.id === auth.currentUser?.id && active.answer && !pc.currentRemoteDescription)
      await pc.setRemoteDescription({ type: 'answer', sdp: active.answer });
    if (!pc.remoteDescription) return;
    const candidates =
      active.caller.id === auth.currentUser?.id ? active.calleeCandidates : active.callerCandidates;
    for (const candidate of candidates) {
      const key = JSON.stringify(candidate);
      if (seen.has(key)) continue;
      await pc.addIceCandidate(candidate);
      seen.add(key);
    }
  }
  async function poll() {
    if (!auth.accessToken || polling || busy.value) return;
    polling = true;
    const isCurrent = captureSession(auth);
    const version = generation;
    const active = call.value;
    try {
      if (!active) {
        if (document.visibilityState !== 'visible') return;
        const result = await api.incoming(auth.accessToken);
        if (
          isCurrent() &&
          version === generation &&
          !call.value &&
          !busy.value &&
          result.call &&
          !dismissed.has(result.call.id)
        ) {
          token = auth.accessToken!;
          error.value = null;
          call.value = result.call;
        }
      } else {
        const result = await api.get(token, active.id);
        if (!isCurrent() || version !== generation) return;
        if (!['RINGING', 'ACTIVE'].includes(result.status)) {
          void showNotice(
            result.status === 'DECLINED'
              ? 'Call declined.'
              : result.status === 'MISSED'
                ? 'No answer.'
                : 'Call ended.',
          );
          cleanup();
          return;
        }
        call.value = result;
        await applyRemote(result);
      }
    } catch (caught) {
      if (isCurrent() && version === generation && active) fail(caught);
    } finally {
      polling = false;
    }
  }
  function toggleMute() {
    muted.value = !muted.value;
    localStream.value?.getAudioTracks().forEach((track) => {
      track.enabled = !muted.value;
    });
  }
  async function toggleCamera() {
    const pc = peer;
    if (!pc || busy.value) return;
    const isCurrent = captureSession(auth);
    const version = generation;
    const sender = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video')?.sender;
    if (!sender) return;
    if (cameraOn.value) {
      try {
        await sender.replaceTrack(null);
      } catch {
        return;
      }
      if (!isCurrent() || version !== generation) return;
      localStream.value?.getVideoTracks().forEach((t) => {
        t.stop();
        localStream.value?.removeTrack(t);
      });
      localStream.value = new MediaStream(localStream.value?.getTracks() ?? []);
      cameraOn.value = false;
      return;
    }
    busy.value = true;
    let camera: MediaStream | null = null;
    try {
      camera = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!isCurrent() || version !== generation) {
        stopMedia(camera);
        return;
      }
      const track = camera.getVideoTracks()[0];
      await sender.replaceTrack(track);
      if (!isCurrent() || version !== generation) {
        stopMedia(camera);
        return;
      }
      localStream.value?.addTrack(track);
      watchDevice(track, version);
      localStream.value = new MediaStream(localStream.value?.getTracks() ?? []);
      cameraOn.value = true;
    } catch (caught) {
      stopMedia(camera);
      if (isCurrent() && version === generation) void showNotice(mediaError(caught));
    } finally {
      if (isCurrent() && version === generation) busy.value = false;
    }
  }
  function startPolling() {
    clearInterval(timer);
    void poll();
    timer = setInterval(() => {
      void poll();
    }, 2500);
  }
  function stopPolling() {
    clearInterval(timer);
    timer = undefined;
    cleanup(true);
  }
  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      cleanup(true);
      dismissed.clear();
    },
    {
      flush: 'sync',
    },
  );
  return {
    call,
    localStream,
    remoteStream,
    connected,
    busy,
    muted,
    cameraOn,
    error,
    incoming,
    partner,
    start,
    answer,
    end,
    toggleMute,
    toggleCamera,
    startPolling,
    stopPolling,
  };
});
