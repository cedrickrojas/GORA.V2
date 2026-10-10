# Live broadcasting

Create → Go Live (`/create/live`) asks for camera and microphone only after Open camera & microphone. A title and working devices are required before Start Live. Broadcasts are public to signed-in members, except blocked users. Home shows Live Now; Reels → LIVE opens the directory (`/live`). A viewer opens `/live/:liveId` and receives real video/audio without granting camera permission. Playback starts muted; tap to enable sound or use the native video controls.

The host can mute the microphone, disable video, or End Live. Leaving the page, logging out, switching accounts, or closing the window releases devices and peer connections. End Live stops devices immediately while confirming the server operation. Viewer reconnect creates a new connection and closes the old session. Navigating away from a viewer only removes that viewer. Backgrounding the app can suspend browser timers and media; keep the host page open while broadcasting.

## API and data

Authenticated REST signaling uses `/api/v1/live`: list, `mine`, `config`, start, `/:id`, host-only `/:id/peers`, and viewer `/:id/viewers` join/poll/leave/offer/answer. The host identity always comes from the JWT. SDP is bounded to 64 KiB and accessible only to its host and specific viewer; it is never included in discovery. Blocking removes existing peer sessions during the next poll. An active host heartbeat expires after 45 seconds and a viewer heartbeat after 30 seconds. Live API operations clear expired sessions and their SDP. A closed browser whose cleanup request is lost therefore cannot remain discoverable as live indefinitely.

`LiveStream` stores broadcast identity/status/timestamps. `LiveViewer` stores each connection's heartbeat, offer, answer, and departure. A partial unique index enforces one LIVE stream per host. Joining takes a database row lock to enforce the ten-viewer capacity during concurrent joins. Ending closes every viewer and clears SDP. Signaling lives in PostgreSQL, so API restart does not lose active negotiations; server timeouts still apply.

Run `npx prisma generate` and `npx prisma migrate deploy` from `server/` for migration `20261010080000_live_signaling`.

## Deployment

- Camera/microphone access requires HTTPS or localhost. Accessing Vite through a plain HTTP LAN IP does not provide a secure camera context. Remote devices also need a reachable API URL in `mobile/.env` and the matching API CORS origin.
- Media flows directly from the host to each viewer. This implementation supports small broadcasts of up to **10 viewers**; host upload bandwidth and device capacity determine practical quality. It does not provide a recording, replay, live comments, or an SFU/CDN for large audiences. Discovery returns the latest 50 live streams.
- `LIVE_STUN_URLS` is a comma-separated list, defaulting to `stun:stun.l.google.com:19302`. Set an empty value for LAN-only development without external ICE servers.
- Direct peer connections can fail behind restrictive NAT/firewalls. For reliable internet use, deploy a TURN relay such as coturn with shared-secret authentication, then configure **both** `LIVE_TURN_URLS` and `LIVE_TURN_SECRET` on the API server. Never put the shared secret in Vite variables. The API issues per-user credentials valid for 24 hours, using the TURN REST HMAC convention; the browser receives credentials rather than the shared secret. Production TURN needs its own capacity, firewall/TLS setup, and abuse controls. A relay is not installed or provisioned by this change.
- Local browser verification uses simulated camera/microphone and two isolated authenticated browser contexts. Actual audio/video tracks, decoded video, reconnect, End Live, Home discovery, and cleanup on Ionic route leave are verified. Cross-network TURN traversal needs a deployed relay and a separate device/network test.

References: [WebRTC peer connections and TURN](https://webrtc.org/getting-started/peer-connections), [MDN signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling).
