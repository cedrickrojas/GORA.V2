# Project audit — 10 October 2026

Reviewed the Ionic Vue client, routing, stores, REST services, NestJS modules, Prisma schema/migrations, setup documentation, and automated checks. The existing application and database were used for verification; integration and browser checks create disposable accounts and remove their records. No schema migration or deletion of existing application data was required.

## Important issues fixed

| Issue | Root cause | Fix |
| --- | --- | --- |
| Old requests could restore a logged-out account or log out a newly signed-in account. | Auth restoration and `/auth/me` assigned results without checking which session started the request. Several stores independently logged out on any 401, including responses for an older token. | Added session versions and response identity checks. Login completion, restoration, and authenticated requests cannot update a replaced session. Current-session 401s still log out normally. |
| Account caches could show previous-user data or remain stuck loading. | Discovery never cleared its results on logout; profile cleanup depended on an already-loaded own profile; sports could reuse the previous account's pending request. Other stores cleared data asynchronously and retained busy/error state. | Reset account caches synchronously on session changes. Guard delayed responses, errors, and loading cleanup; reset pending sports requests and mutation state. Consolidated eight duplicate authorization helpers. |
| Signed-in media screens showed sample content and some screens missed real reels. | Story/reel feeds mixed demo fixtures with API results, while Home, Search, Discover, sport, and club views read the demo reel collection directly. They also used the demo viewer for some actions. | Signed-in story/reel feeds use API content. Consumers read the shared real reel feed and the effective signed-in viewer. Reels now distinguish loading, API failure, an empty For You feed, and an empty Following feed. |
| Friendship changes could leave stale private stories/reels visible. | Media caches did not react to accepted friendships, removal, or block changes; an older refresh could overwrite a newer relationship state. | Invalidate media caches and reload on friendship revisions. Generation checks discard refreshes started before the relationship changed. API privacy rules remain authoritative. |
| Likes disappeared after refresh; profile-only post likes did nothing. | Post/reel likes changed memory only. Profile posts were loaded into page-local arrays and could not be found by the shared post actions. | Added idempotent authenticated PUT/DELETE like routes using existing PostLike/ReelLike tables and visibility checks. Client reactions update after server confirmation, suppress duplicate taps, and report failures. Profile posts now share a separate action cache without being injected into Home. |
| Inactive-club content remained readable through direct content endpoints. | Posts, reels, and games checked public/private membership but omitted the club's `isActive` flag. | Added a shared active-club visibility predicate across these queries. Other viewers cannot read inactive-club content; authors/hosts retain their existing access to their own records. |
| A host could accept a private-club game request after the player lost access. | Acceptance checked the requester's active account and host block state, but did not recheck current game visibility or club membership. | Recheck visibility inside the seating transaction before changing the request or adding a player. Failure returns 409 and leaves the request pending with no seat. |
| An edit could modify a game cancelled during the request. | The service checked editable status before asynchronous validation, then updated by ID alone. | Include host and editable status in the database update condition; a concurrent state transition returns 409 without applying the stale edit. |
| Profile game counts included games hidden from the viewer. | Section counts filtered the profile user's participation but omitted `visibleGamesWhere`, unlike game reads. | Apply the same game visibility predicate to section counts. |
| Repeated player-search query parameters caused server errors. | `@Query('q')` was assumed to be a string and passed to `.trim()`; repeated parameters produce an array. | Validate search queries with a DTO: optional string, maximum 80 characters, and rejection of unknown fields. Invalid queries return 400. |
| Friendship snapshots disclosed who had blocked the viewer. | `blockedIds` returned both directions of a block, although other relationship endpoints intentionally hide blockers. | Return only blocks initiated by the viewer. Search and content access still enforce blocks in either direction. |
| Requests could hang indefinitely or appear successful with malformed responses. | Fetch had no deadline; invalid JSON was converted into a successful null result. Validation-message arrays were discarded. | Added a 30-second request deadline, malformed-success handling, and readable validation messages. Valid JSON null responses and empty 204 responses remain supported. |
| Browser storage restrictions could leave login/logout half completed. | Accessing localStorage was guarded, but `getItem`, `setItem`, and `removeItem` could still throw. | Handle storage-operation failures and retain an in-memory session when persistence is unavailable. |
| Video post media was rendered as an image. | PostCard ignored the media type and retained unreachable placeholder code after URL filtering. | Render videos with controls and inline playback, preserve image handling, and remove the unused placeholder import/computation/styles. |
| The README gave startup instructions that failed on a fresh checkout. | It still described accounts/database/features as future work, instructed leaving secrets unset, omitted migrations/seeding, and understated the runtime requirement. | Updated supported features, environment setup, Prisma initialization, health response, runtime requirement, and placeholder boundaries. |
| Concurrent integration requests produced server listener warnings. | Supertest repeatedly started/stopped an unbound HTTP server when several requests began together. | Bind each integration-test app to a local ephemeral port once and close it after the suite. |

## Cleanup

- Shared authenticated request handling replaces repeated token/401 implementations in stores.
- Shared content-error handling replaces repeated safe-403 message implementations.
- Shared club visibility removes three copies of the same access predicate.
- Removed dead post-media placeholder code and unused imports. Corrected touched backend formatting so ESLint can pass.
- Preserved the enlarged responsive desktop sidebar and existing mobile navigation.

## Verification

Final results: **522 automated tests passed**. Type checks, both linters, both production builds, and the browser checks passed.

| Check | Result |
| --- | --- |
| Frontend unit tests | 24 suites, 294 tests passed |
| Backend unit tests | 10 suites, 82 tests passed |
| Backend database integration tests | 13 suites, 146 tests passed |
| TypeScript, frontend/backend ESLint | Passed |
| Frontend/backend production builds | Passed |
| Browser friendship, saved likes, search, responsive layout | Passed; no JavaScript exceptions |

Commands used:

```text
Root:   npm run typecheck
Mobile: npm run lint
Mobile: npm run test:unit -- --maxWorkers=2 --testTimeout=15000 --reporter=dot
Server: node node_modules/eslint/bin/eslint.js src test
Server: npm test -- --runInBand
Server: npm run test:e2e -- --runInBand
Root:   npm run mobile:build
Root:   npm run server:build
```

Regression coverage includes logout/login races, delayed private media responses, cache clearing, restricted storage, malformed responses, stalled requests, saved reactions and reaction failures, profile-only post actions, repeated search parameters, block privacy, inactive-club content, lost club membership, and a deterministic cancellation during game editing. Existing suites cover auth, profiles/sports, audiences, friendships, posts, stories/reels, discovery, join requests, capacity, rosters, clubs, and club chat.

Browser checks cover real Add Friend → Accept → mutual Friends post visibility without navigation, persistence after reload, real profile/search results, duplicate-tap like persistence, desktop/sidebar heights of 1000/768/600 pixels, and a 390-pixel mobile viewport. Disposable browser records are cleaned up afterward.

## Remaining implemented boundaries

These are existing demo or placeholder features, not completed production services:

- Following controls, notifications, reel comments/shares, and profile photo uploads. Direct messages and message requests use authenticated API records; post/reel likes are persisted. Saved posts support photos stored in PostgreSQL, paginated comments with deletion permissions, and native/copy-link sharing that preserves their audience. Live broadcasting now uses WebRTC; production network and capacity limits are described in [Live streaming](features/live-streaming.md).
- Some Home/Search/club game cards and recommendation surfaces still use sample games. Nearby GORA Games, real game details, My Games, requests, rosters, clubs, and official club chat use the API.
- Activity and badge screens retain demo presentation. The schema/seeded badges alone do not implement an achievement engine.
- Real profiles expose summary counts and paginated posts; the richer sample-profile sections are not fully backed by real profile list endpoints.
- Story/reel/profile collections still have existing page-size limits; a complete media browsing/pagination experience is separate work. Home post refresh replaces its loaded pages with the newest page; using Load more retrieves older feed posts again.
- Posts and profile covers now support optimized photo uploads saved in PostgreSQL, including reload persistence on Vercel. Cover uploads have preview, replacement, removal, and profile block checks. Avatar uploads remain unfinished. Stories and reels use local upload storage and audience-checked playback; Vercel production needs durable object storage for those files. See the README for storage configuration. No transcoding or cloud storage service is configured.

An existing pg deprecation warning was traced into Prisma's PostgreSQL adapter/client query interpreter during generated multi-query work. Application checks pass with the installed versions. No dependency upgrade or patch to node_modules was made. Ionic also emits existing missing-source-map warnings during frontend tests. The frontend build reports Ionic `:host-context` CSS compatibility warnings and a large framework chunk (about 1.12 MB before gzip). These warnings do not fail the checks; dependency compatibility and further bundle optimization remain separate work.

Passing these checks does not establish that every possible runtime or concurrency issue has been eliminated. Production deployment, external services, and native-device behavior were outside this local verification.

## Direct chat sender identity follow-up

The reported wrong sender name came from direct chats using shared demo conversations and the demo session user ID. The chat cache also survived account changes, so the next account could see a conversation built from the previous viewer's perspective. Direct chats now use PostgreSQL records through `DirectChatModule`; the server derives senders from the JWT and builds each conversation's partner for the current viewer. Message bubbles display their actual author, and inbox previews distinguish outgoing messages with "You:". Cached conversations, messages and requests clear on account changes; delayed responses cannot repopulate another account's chat.

Message requests use the same account-specific API flow and preserve the original sender when accepted. Verification covers two-way messaging, recipient-specific inbox names, reload persistence, spoofed sender rejection, participant-only access, block privacy, concurrent opens/acceptance, and browser delivery while a chat is open. Message notifications remain outside this change.

## Story upload follow-up

Replaced Add Story's external photo/video URL form with a device file picker, preview, remove/change, progress and cancel controls. Uploads persist in private storage and reload through scoped media URLs with the existing story audience, blocks and expiration rules. Existing external URL API creation still works. Profile and post photo uploads remain outside this change.

Validation covers multipart files, unsupported/spoofed media, size limits, rejected-audience cleanup, persistent photo/video reads, ranges, deleted/expired media, audience revocation, account switching and the existing Reel upload flow.

## Post location picker follow-up

The Use current location and Select on map buttons were placeholders. They now support one explicit device reading or interactive map selection, editable location names, confirmation and existing post persistence. Saved points outside the catalog reopen correctly. Permission failures leave manual selection available, and stale device callbacks are ignored after cancellation, another selection or an account change. Discovery keeps its existing rounding and behavior.

Validation: 60 focused frontend tests passed across location, discovery, post location and post editing; typecheck, lint and production build passed. Browser QA verified native GPS and denial, map click and pin dragging, exact API persistence, mobile layout and canceled/reopened selections. Browser map tiles were mocked locally for automated checks.

## Direct chat tools and calls follow-up

Added persistent gallery photos and recorded voice messages with preview/cancel/send, shared pins, forwarding, private pending reports, and sender-only unsend. Tombstones retain history pagination, and delayed polling cannot restore an unsent attachment. Forwarded messages are independent copies. These actions apply to direct conversations; club chats keep their existing behavior. Report review tooling remains unfinished.

One-to-one voice/video calls now use authenticated WebRTC signaling with participant checks, transactional busy-user checks, recipient-only answer, expiration, mute, camera toggles, and device cleanup. An initial audio call negotiates optional video so either participant can turn their camera on later. Incoming calls require the application to be open. Production connections across restrictive or different networks require a configured TURN relay, shared with the existing live feature.

Validation includes frontend account-switch and stale-response regression tests, backend chat privacy/ownership and call signaling checks, and two isolated browser accounts using recorded audio and real WebRTC media tracks. This verifies browser signaling and playback; it does not substitute for physical-device testing on different carrier networks.
