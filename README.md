# GORA

GORA is a mobile-first sports social platform with an Ionic Vue client, NestJS API, and PostgreSQL database. Accounts, profiles, sports, friendships, posts, stories, reels, games, join requests, player rosters, clubs, direct messages, message requests, and club chat have working APIs. Some screens still contain sample content; see Development notes and [the project audit](docs/PROJECT_AUDIT.md).

## Project purpose

GORA helps athletes find players, create games, and connect with each other. The mobile client and API are separate applications with shared development commands in this directory.

## Technology stack

**Frontend**

- Ionic Vue
- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router

**Backend**

- Node.js
- NestJS
- TypeScript
- REST API under `/api/v1`

**Database**

- PostgreSQL
- Prisma ORM

Redis, object storage, video processing, and push notifications remain planned. Post location selection uses Leaflet/OpenStreetMap; the game discovery preview needs no key. Go Live uses native WebRTC and the API's authenticated signaling endpoints.

## Project structure

```text
gora/
├── mobile/          Ionic Vue client
├── server/          NestJS API
├── database/        Reserved for later database assets
├── docs/            Architecture notes
├── package.json     Root scripts for local development
└── README.md
```

The mobile client keeps screens, state, routing, and API configuration separate:

```text
mobile/src/
├── assets/
├── components/
├── composables/
├── layouts/
├── router/
├── services/
├── stores/
├── types/
├── utils/
├── views/
└── theme/
```

The API keeps configuration, shared infrastructure, and feature modules separate. Database schema, migrations, and seed data are in `server/prisma/`.

## Prerequisites

- Node.js 22.12 or newer in the 22.x series, or Node.js 24.x
- npm 10 or newer

PostgreSQL is required for accounts and API features, including Go Live.

The Ionic CLI is optional. This project runs the client with Vite through `npm run mobile`.

The NestJS CLI does not need to be installed globally. `@nestjs/cli` is a local development dependency of `server/`. If you want the global CLI anyway:

```bash
npm install -g @nestjs/cli
```

## Installation

From the repository root:

```bash
npm install --prefix mobile
npm install --prefix server
```

Copy the API environment template:

```bash
copy server\.env.example server\.env
```

On macOS or Linux, use `cp server/.env.example server/.env`.

Do not commit `.env`.

Set `DATABASE_URL` to your PostgreSQL database and replace `JWT_SECRET` with a random value of at least 32 characters. The template secret is a placeholder and will fail startup validation. Generate a value with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

For a new database, run these commands from `server/` before starting the API:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

The seed supplies the sports and badges used by the application. Integration tests require a reachable database with these migrations and seeds applied and create disposable records.

## How to run the mobile application

From the repository root:

```bash
npm run mobile
```

Vite serves the Ionic app at [http://localhost:5173](http://localhost:5173). The first screen is the GORA landing page.

The client reads `VITE_API_BASE_URL` from the environment. See `mobile/.env.example`. Leave it unset or empty for same-origin `/api/v1` requests. During standalone Vite development, Vite proxies `/api` to `http://localhost:3000`. Native clients or a separately hosted API can set this variable to the API's public origin, without `/api/v1`.

## Vercel deployment

Use this directory (the `GORA` Git repository containing `mobile/`, `server/`, and `vercel.json`) as the Vercel project root. The surrounding `GORAJUV` checkout is a separate repository. Deploy both services as one project:

- `mobile`: static Vite frontend, public at `/` and all non-API paths. Its service-level rewrite supports Vue Router deep links.
- `server`: NestJS backend, public at `/api` and `/api/*`. The original request path is preserved; controllers already use `/api/v1`.
- No internal-only application service or service binding is needed: the frontend calls the public API from the browser, and the backend does not call another deployed application service. Bindings are available only in functions at runtime, so they cannot provide a browser build's API URL. Do not put an internal binding URL into `VITE_API_BASE_URL`.

Leave `VITE_API_BASE_URL` unset or empty in Vercel so production and preview builds use their own domain. Remove any existing localhost override. Each service installs and builds independently; the server build generates the ignored Prisma client before compiling NestJS. The JavaScript entrypoint `server/main.js` loads `dist/bootstrap-server.js` from Nest's compiler to preserve decorator metadata required by dependency injection. The server's `postinstall` builds this output for fresh installations and `vercel dev`. After backend edits, run `npm run server:build` and restart `vercel dev`, or use standalone `npm run server` for watch mode.

Set `DATABASE_URL` to an externally hosted PostgreSQL database and `JWT_SECRET` to a random secret of at least 32 characters in the project's Vercel environment settings. Optional server settings are listed in `server/.env.example`. Same-origin web requests need no CORS override; set `CORS_ORIGIN` to explicit allowed origins for separately hosted browser clients. Keep database credentials and JWT/TURN secrets out of all `VITE_*` variables. Apply migrations and seed the target database using the existing Prisma commands before serving application traffic; builds do not migrate or seed databases.

Test the combined routing from this directory with a Vercel CLI that supports Services:

```bash
vercel dev
```

For local testing without a cloud login, use `vercel dev -L`. Supply the server environment settings as above (locally, `server/.env`). Check `/`, a frontend deep link such as `/login`, `/api/v1/health`, and an unknown `/api/v1/...` route (which must return the API's 404 response).

Deployment limitation: story and reel uploads currently use local filesystem storage in `server/src/common/media/private-media.storage.ts` (10 MB photos, 50 MB videos). Vercel Functions do not provide durable local upload storage and impose request body size limits. Production uploads need durable object storage and direct browser uploads; changing a directory to `/tmp` will not make uploaded media persistent. This configuration does not migrate media storage. See [Vercel Services](https://vercel.com/docs/services), [bindings](https://vercel.com/docs/services/bindings), and [Functions limits](https://vercel.com/docs/functions/limitations).

## How to run the backend

From the repository root:

```bash
npm run server
```

The API listens on `PORT` from `server/.env`. The default is `3000`.

`CORS_ORIGIN` is a comma-separated list of allowed browser origins. The example allows the Vite dev server (`http://localhost:5173`). Add `http://localhost:8100` if you use `ionic serve`. No production domain is hardcoded.

## Health API

```http
GET /api/v1/health
```

Success response (`200 OK`):

```json
{
  "success": true,
  "message": "GORA API is running",
  "database": "connected",
  "timestamp": "current ISO timestamp"
}
```

## Development notes

- Friend requests and contacts use the database for signed-in accounts: search a name or username in Search, open the player profile, and choose Add Friend. The recipient accepts from Home or Friends → Requests. Acceptance makes the pair mutual friends and reveals their existing Public and Friends posts in Home and on their profiles; Only Me, Custom audiences, blocks, and private-club membership still apply. Home has All updates and Friends tabs, reloads after friendship changes, and checks for new posts and requests every 30 seconds while visible. Use the refresh button for an immediate check. Older posts load with Load more posts.
- The friendship API is `GET /api/v1/friends`, `GET /friends/players?q=...`, `POST /friends/requests/:username`, `POST /friends/requests/:id/accept`, `DELETE /friends/requests/:id` (decline or cancel), `DELETE /friends/:username` (unfriend), and `DELETE /friends/blocks/:username` (only the blocker can unblock). `GET /posts?scope=FRIENDS` returns the viewer's own posts and accepted friends' visible posts, with the usual cursor pagination. Run `npm run test:e2e -- --runInBand friends.e2e-spec posts.e2e-spec` in `server/` to verify persistence and privacy using disposable accounts.

- TypeScript strict mode is enabled in both apps.
- `@nestjs/config` stays on 4.x. That release matches NestJS 11. Config 12 is ESM-only and does not run under the default Jest setup.
- Controllers stay thin. Business logic belongs in services.
- Request validation uses a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- `server/.env` must set `DATABASE_URL` and `JWT_SECRET` (a random value of at least 32 characters; the API will not start without it). `JWT_EXPIRES_IN` defaults to `7d`. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Never put real secrets in source files or `.env.example`.
- Authentication (`/api/v1/auth/register`, `/login`, `/me`) is described in `docs/ARCHITECTURE.md`. Run the database end-to-end tests with `npm run test:e2e` in `server/`, which adds the Node flag Prisma 7 needs under Jest.
- Post privacy (Public, Friends, Custom, Only Me) and the relationship state that drives profile buttons are enforced by the API (`/api/v1/posts`, `/api/v1/users/:username/posts`, `/api/v1/users/:username/relationship`); see "Post privacy" and "Relationships" in `docs/ARCHITECTURE.md`. Posts can also carry tagged people and an optional location; tapping a post or game location opens the location view with the real GORA games nearby, described in `docs/features/sport-map-discovery.md`. The end-to-end suite creates throwaway users, checks every rule over HTTP, and deletes what it created.
- Posts are saved in PostgreSQL when you are signed in: Home loads `GET /api/v1/posts`, Create Post uses `POST /posts`, and the "⋯" menu on your own post has Edit post (`PATCH /posts/:id`: caption, sport, location; the card shows "Edited") and Delete post (`DELETE /posts/:id`, a soft delete that hides the post everywhere but keeps the row). Photo uploads are not built yet.
- Stories and reels (Highlights) are saved in PostgreSQL too. Add Story (`/create/story`) accepts a photo (JPEG/PNG/WebP/GIF, up to 10 MB) or video (MP4/WebM, up to 50 MB) directly from your device, with preview, progress, cancellation, caption, and audience controls. Upload Reel (`/create/reel`) accepts an MP4 or WebM file up to 50 MB and 10 minutes. Click a saved reel in My Reels or your Highlights to play it. Your own story or reel has a "⋯" menu with Edit caption, Edit privacy, and Delete. See "Stories and reels" in `docs/ARCHITECTURE.md`.
- Uploaded reel files are stored in `server/uploads/reels/` by default, outside the public web root. Set `REEL_UPLOAD_DIR` to a persistent directory when deploying, and back it up alongside the database. Apply migrations with `npx prisma migrate deploy` in `server/`. Playback uses expiring URLs and rechecks the reel's audience on each request; deleting a reel also removes its uploaded file. Existing external video URLs remain supported by the API.
- Uploaded story files use `server/uploads/stories/` by default; set `STORY_UPLOAD_DIR` to a persistent directory for deployment and back it up. Apply migration `20261010060000_story_media_uploads`. Media requests recheck audience, blocks, deletion, and the 24-hour expiration. Expired media remains available to the author's archive; deleting a story removes its file. Existing external media URLs remain supported by the API.
- User profiles and sports profiles (`/api/v1/profiles/me`, `/api/v1/profiles/me/sports`, `/api/v1/profiles/:username`, `/api/v1/sports`) back the Profile tab, Edit Profile (`/profile/edit`), MY SPORTS, and other users' profiles (`/profile/:username`); see "Profiles and sports" in `docs/ARCHITECTURE.md`. Profile photos are image URLs until an upload service exists.
- Club group chats (`/api/v1/chat/clubs`, `/api/v1/clubs/:clubId/chat`, `/api/v1/clubs/:clubId/chat/messages`) are the only group chats: every club gets exactly one official chat when it is created, and only ACTIVE club members can read or send. Users cannot create group chats. See the Chat notes and "Database" in `docs/ARCHITECTURE.md`.
- Direct chats and message requests use `/api/v1/chat/direct` and `/api/v1/chat/requests`. Each inbox shows the other participant; messages carry the authenticated sender's identity, and outgoing previews say "You:". Friends can open a chat directly; non-friends send one request that the recipient accepts or deletes. Messages survive refresh, older history loads in pages, and visible chat screens poll every five seconds for updates. Hold a direct message, right-click it, or use its smile button to add, change, or remove one of six saved reactions. Apply migration `20261010130000_direct_message_reactions` before deploying this version. Direct and club chat composers expand for multiple lines and follow the visible viewport above the keyboard; desktop Enter sends and Shift+Enter inserts a line. Account changes clear cached messages immediately. Blocks and inactive accounts prevent access.
- Clubs (`/api/v1/clubs`, `/api/v1/clubs/:clubId`, `/join`, `/members/requests`, `/members/:userId/approve|reject|remove`, `/invites`) back Create Club, the club page, Manage Club, and My Clubs. Every club has a required maximum number of members; the owner is the first ACTIVE member, and joins and approvals stop at capacity ("Club is currently full."), checked in the service and again by a database trigger. `CLUB_MAX_MEMBERS_LIMIT` in `server/.env` sets the platform maximum (default 1000).
- Games (`/api/v1/games`, `/games/mine`, `/games/:id`, `/games/:id/cancel`) back Create Game (`/create/game`), Edit Game, Game Details for games created in GORA, and My Games (hosted games, plus games you play in from `/games/playing`). The host comes from the JWT, new games are OPEN with 0 players, and cancelling never deletes. Dates and times are the venue's local time; `GAME_TIMEZONE` in `server/.env` decides what "today" is (default `Asia/Manila`). See "Games" in `docs/ARCHITECTURE.md`.
- Create Post and Edit Post support Use current location (browser permission) and Select on map (tap/drag a pin, zoom, name the place, then confirm). The confirmed coordinates are saved with the post. Street tiles use Leaflet/OpenStreetMap with no API key; VITE_LOCATION_TILE_URL can select a compatible OSM tile server. Use localhost or HTTPS for device location.
- Game discovery (`/api/v1/games/discover`) backs Discover's "Nearby GORA Games" map and list, the location view, and Game Details' View on Map: real games filtered by sport id, date, status, and distance (Haversine on the server). The device location is optional, asked for only on "Use my location", and never stored. `VITE_MAP_PROVIDER` / `VITE_MAP_API_KEY` in `mobile/.env` are for a future map provider; leave them empty to use the built-in preview. See `docs/features/sport-map-discovery.md`.
- Join requests (`/api/v1/games/:gameId/join-requests`, `/me`, `/me/cancel`, `/:requestId/accept`, `/:requestId/reject`) back Request to Join, Request Pending / Cancel Request, and the host's Join Requests list on Game Details for GORA games. Accepting a request seats the player in the same transaction. See "Join requests" in `docs/ARCHITECTURE.md`.
- Players (`/api/v1/games/:gameId/players`, `/me`, `/me/leave`, `/:userId/remove`) back the Player Roster (players, then Open slots), Leave Game, and the host's Manage Players / Remove Player on Game Details. The count is ACTIVE players only, a game can never hold more players than `requiredPlayers`, and leaving or removal never deletes history. See "Players" in `docs/ARCHITECTURE.md`.
- Post and reel likes are saved through `PUT /api/v1/posts/:id/like` and `PUT /api/v1/reels/:id/like`; `DELETE` on the same routes removes a like. These operations are idempotent and apply the content's privacy rules. Signed-in story and reel feeds use API data; sample media is reserved for signed-out previews.
- Go Live (`Create → Go Live`) opens a camera/microphone preview, then broadcasts to signed-in members through WebRTC. Live broadcasts appear on Home and under Reels → LIVE. Hosts can mute the mic, disable the camera, and end the broadcast; leaving the page stops devices and ends the live. Each host can run one live with up to 10 viewers. [Live setup and limits](docs/features/live-streaming.md) covers HTTPS, TURN, and network requirements.
- General Home/Search game cards still use sample data; Discover's Nearby GORA Games, game details, My Games, join requests, and player management use the API. Following controls, notifications, activity/badge presentation, comments/shares, and uploads outside stories/reels still have demo or placeholder behavior. Profile media currently accepts external URLs. See [the audit](docs/PROJECT_AUDIT.md) for remaining limitations.
- Useful checks:

```bash
npm run typecheck
npm run mobile:build
npm run server:build
```
