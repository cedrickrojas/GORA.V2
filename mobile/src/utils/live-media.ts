export function mediaError(error: unknown): string {
  const name = typeof error === 'object' && error && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Allow camera and microphone access in your browser settings, then try again.';
  if (name === 'NotFoundError') return 'No camera or microphone was found. Connect them and try again.';
  if (name === 'NotReadableError') return 'Your camera or microphone is busy. Close other apps using it and try again.';
  return error instanceof Error ? error.message : 'Could not open your camera. Please try again.';
}

export function stopMedia(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Send complete SDP, including ICE candidates, through the authenticated signaling API. */
export async function gatherDescription(
  peer: RTCPeerConnection,
  description: RTCSessionDescriptionInit,
): Promise<string> {
  await peer.setLocalDescription(description);
  if (peer.iceGatheringState !== 'complete') {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', changed);
        peer.removeEventListener('connectionstatechange', changed);
        if (peer.connectionState === 'closed') reject(new Error('Connection closed.'));
        else resolve();
      };
      const changed = () => {
        if (peer.iceGatheringState === 'complete' || peer.connectionState === 'closed') done();
      };
      const timer = setTimeout(done, 8000);
      peer.addEventListener('icegatheringstatechange', changed);
      peer.addEventListener('connectionstatechange', changed);
      changed();
    });
  }
  if (peer.connectionState === 'closed' || !peer.localDescription?.sdp) throw new Error('Connection closed.');
  return peer.localDescription.sdp;
}
