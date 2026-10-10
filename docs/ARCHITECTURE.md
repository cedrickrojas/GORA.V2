# GORA architecture

This document describes the foundation that is in place now and the systems planned for later phases. Planned systems are not implemented.

## Current shape

GORA is split into two applications:

- `mobile/` is the Ionic Vue client.
- `server/` is the NestJS REST API.

They communicate over HTTP. The client does not import server code, and the server does not render the mobile UI.

```text
Ionic Vue client
        |
        |  HTTPS JSON
        v
NestJS  /api/v1/*
        |
        |
        v
Prisma  ->  PostgreSQL
```

## Frontend

The client is an Ionic Vue application built with Vue 3, TypeScript, Vite, Pinia, and Vue Router.

| Area | Responsibility |
| --- | --- |
| `views/` | Screens |
| `components/` | Reusable interface pieces |
| `layouts/` | Screen shells, such as the tab bar |
| `router/` | Routes |
| `stores/` | Pinia state |
| `composables/` | Reusable view logic |
| `services/` | API access and environment configuration |
| `theme/` | Ionic theme tokens |
| `types/` | Shared client types |
| `utils/` | Small pure helpers |

The API base URL comes from `VITE_API_BASE_URL`. Production URLs are not hardcoded.

### Authentication (client)

- `stores/auth.ts` holds `currentUser`, `accessToken`, and `isAuthenticated`, with `login()`, `register()`, `logout()`, `loadCurrentUser()`, and `initialize()` (restores a saved session once per launch and drops it if `/auth/me` answers 401 or 403).
- `services/api-client.ts` wraps `fetch` and turns error responses into `ApiError(status, message)`. `services/auth.service.ts` calls the three auth endpoints. The client never talks to PostgreSQL.
- `services/token-storage.ts` keeps the token under `gora.accessToken`. Capacitor is not installed yet, so it uses the WebView's `localStorage`; switch the body to `@capacitor/preferences` when the native shell is added.
- `/login` and `/register` are outside the tab layout and marked `guestOnly`. The tab layout is `requiresAuth`, so every tab and sub-page is protected. The guard in `router/index.ts` uses `resolveAuthNavigation` (`utils/auth.ts`): logged-out users go to `/login?redirect=<page>`, and logged-in users on login or register go to `/home`. The redirect only accepts same-app paths.
- Log Out is in Settings. It clears the token, the user, and the stored session, then opens `/login`.
- Signed-in feeds, direct chats and message requests use the authenticated account; the mock `session` user (Louis) is reserved for signed-out previews. Clubs stored on the server (UUID ids) use the signed-in account through the clubs API (`services/club-api.service.ts`) and the club chat API; the four demo clubs keep their demo members (Louis and the others), but a signed-in account starts outside all of them (`asNonMember` in `utils/clubs.ts`: no membership, follow, invite, or manage rights). Only demo clubs it joins count as its clubs, in My Clubs, Profile, Discover, and Chat → Clubs. Joining, leaving, and demo club chat act as the signed-in account (`session.me`), and the demo state resets when the account changes.

### Navigation (locked design)

- The bottom navigation has exactly 7 items, in order: Home, Search, Discover, Create (+), Reels, Chat, and Profile. Their routes are `/home`, `/search`, `/discover`, `/create`, `/reels`, `/chat`, and `/profile`. The Create button opens an action sheet with Create Post, Create Game, Upload Reel, Add Story, and Go Live; `/create` lists the same actions as a page.
- The web view adapts to the screen, modelled on Facebook (`theme/responsive.css`). Under 768px is the phone layout. From 768px, pages sit in a centered 680px column. From 1024px, `DesktopTopNav` shows the same 7 tabs as icons in a top bar (avatar, GORA, and a search pill on the left; filter and bell on the right) and the bottom tab bar is hidden. From 1240px, Home and Discover add a left sidebar (Profile sections and your clubs, `DesktopShortcuts`) and a right sidebar (friend requests and contacts, `DesktopContacts`). Reels becomes a centered 9:16 player.
- The header on every main tab except Reels has the profile avatar top-left, GORA branding, and a filter icon beside the notification bell top-right (the bell shows the unread count and opens `/notifications`).
- The avatar opens a dropdown: Profile, My Games, My Reels, My Stories, Friends, Badges, Activity, Settings (`utils/navigation.ts`). It is a shortcut; the Profile tab is the main entry.
- The filter icon opens a Tinder-style panel: a maximum-distance slider that snaps to 1, 5, 10, 25, 50, 100 km or Any, and a sport dropdown. The choice lives in the `filters` Pinia store and is shared by Home, Search, and Discover. A dot on the icon shows when a filter is on.
- Home is a social sports newsfeed: stories, a "Share a game moment…" composer that opens Create Post, then one feed that mixes four item types (`types/feed.ts`): `POST` (caption, photos, Like, Comment, Share), `GAME` (the host's note, such as "Looking for players tonight!", above a game card with PLAYERS, View Game, and Request to Join), `REEL` (a preview that opens Reels), and `ACTIVITY` (games completed or joined, badges unlocked). `utils/feed.ts` merges them newest first. The sport filter applies to every type, the distance filter to games; cancelled and completed games stay off Home. There is no ranking algorithm yet.
- Create Post (`/create/post`, from Create (+) or the Home composer): write a caption, pick photos (up to 10; video later), optionally 👤 Tag People and 📍 Add Location, choose a sport and a privacy setting, then publish. Tag People (`TagPeopleModal`, the same searchable `PeoplePicker` as Custom privacy) lists friends first, never yourself or blocked users. Add Location (`LocationPickerModal`) searches GORA places, reads device coordinates on Use current location, or opens an interactive street map on Select on map. The author can name the place and must Confirm location before it is attached. The selections show as removable chips. The card then reads "with John Reyes, Maria Santos" (more than three names become "and N others") and "📍 Riverside Volleyball Court". The privacy selector (`PostAudiencePicker`) offers 🌎 Public, 👥 Friends, ⚙️ Custom, and 🔒 Only Me. Custom opens the searchable people list with nobody preselected, and at least one person must be chosen. The post goes into the shared `posts` store, so it appears on Home, on Profile, and in Search at once. Photos are local previews until the upload service stores them externally and returns URLs.
- Tapping a post or game location opens the location view (`/map/:lat/:lng?name=&game=`, `LocationMapPage`, not a tab). It centers on the place and lists the real GORA games within 2 km from `GET /games/discover` (`discovery.discoverAround`), grouped by venue so several sports share one marker (🏀 🏐). The marker preview (`DiscoveredGameCard`) shows sport, status, title, "Today • 6:00 PM", place, distance, "Players: 8/12", host, View Game, and Request to Join; coming from a game marks it "Selected game" and always shows it. Markers are GORA games only, never venues on their own. The map is drawn by the built-in preview (`PlaceholderMapCanvas`) until a map provider adapter is added; see [game discovery](features/sport-map-discovery.md).
- Discover's All tab has "Nearby GORA Games" (`NearbyGamesSection`): Sport (All Sports + the active sports) and Distance (1–100 km, Any) are the header filter, the Date chips are All, Today, Tomorrow, This Week, and Custom Date, and [Map] [List] show the same results from the `discovery` store. "Use my location" asks for the device location once (never stored, only sent as the search center); on denial it says "Location access is unavailable. You can still browse GORA games by sport and date." and browsing keeps working. Empty, loading (skeletons), and error (with Try again) states are built in.
- Post privacy on the client (`utils/post-privacy.ts`): every post card shows a small indicator (globe, people, gear, or lock) and never the list of chosen viewers. The author's "⋯" menu opens Edit privacy (`EditPostPrivacyModal`) or Edit tags, and the change applies at once. Feeds read `postsStore.visiblePosts`, which mirrors the server rules for the mock data; the real gate is the API, which never sends a post the viewer may not see.
- Other users' profiles (`/profile/:username`, not a tab; the old `/users/:username` links redirect there): reached by tapping an author on a post, a player row (Search, sport page, Friends), a Discover player, a friend-request or message-request name, or the avatar in a chat. Your own username redirects to `/profile`, and an unknown, deactivated, or blocking user shows "This profile isn't available". The page is read-only (no Edit Profile, no Settings) and loads from `GET /profiles/:username`: avatar, name, username, city, bio, Friends / Followers / Following, their sports, and "On GORA" counts of what the viewer may see (Posts, Games, Reels, Clubs, Badges). Date of birth and email are never shown. The buttons come from the relationship state the server returns (the same `relationship.ts` rules on both sides), never hard-coded: no relationship → Add Friend + Message; request sent → Request Sent + Message; request received → Accept + Delete; friends → Friends + Message; blocked by you → Unblock only, with the profile content hidden. Friend actions on real accounts show a later-phase notice until the Friends endpoints exist. The mock demo users (maria, john, ...) are not in the database, so for them the page falls back to the demo data and its mock friend actions.
- Message from a profile: a friend opens the direct conversation (or starts an empty one). A non-friend gets a message request with a first message, one per pair of users; tapping Message again says the request was already sent, and if they already sent you one, you are sent to Chat to accept it. Your sent requests are listed under Sent in Message Requests. Blocked users and your own profile have no Message button. Signed-in conversations and requests are saved through the direct chat API; the local store caches only the current account data.
- The Profile tab (`/profile`) loads your real account from `GET /profiles/me`. The header has the cover photo, the avatar with its story ring, your display name, @username, city (with a location icon), bio, and an Edit Profile button. Below it are Friends / Followers / Following counts (each opens its page), then the sections as plain text links: My Games, My Reels, My Stories, and Friends in a row, with Followers, Following, Badges, Activity, My Clubs, and Settings under "More" (each with a one-line summary such as "You haven't joined any clubs yet."). Then MY SPORTS with + Add Sport, MY CLUBS (every club you are an ACTIVE member of as "24/50 Members · Role", and See all clubs), HIGHLIGHTS (the 3 newest, See all opens My Reels), and MY FEED with a "Share a game moment…" composer that opens Create Post, followed only by posts you wrote (`postsStore.myPosts`). Create Post publishes as the signed-in account (`postsStore.me`), so a new post shows on Home and on your Profile; other people's posts never appear in My Feed. Posts are still kept in the app until Create Post is connected to `POST /posts`. A skeleton shows while loading, and a failed load offers Try again.
- Display names come from one helper on each side (`users/display-name.ts`, `utils/display-name.ts`): first and last name, falling back to the username.
- Edit Profile (`/profile/edit`, also in Settings): photo link, first and last name, bio (160 characters, with a counter), city, date of birth (only you see it), and cover photo link, with Save Changes and Cancel. Errors show under each field after the first Save, only changed fields are sent, and a toast confirms the save. Images are URLs only: "Upload photo" calls `services/upload.service.ts`, which says uploads are coming soon until external storage exists.
- MY SPORTS: + Add Sport opens `SportEditorModal`: pick a sport from tiles (icon, name, and a check on the selected one; only active sports you don't have yet), then one of Beginner / Intermediate / Advanced / Professional, then an optional position up to 40 characters, and Save Sport. Basketball, Volleyball, and Football suggest positions as chips. Each card reads like "Basketball — Advanced · Point Guard" with Edit (level and position only; the sport cannot change) and Remove ("Remove Volleyball from your sports?" with Cancel / Remove). Empty states: "No sports added yet." with + Add Sport, and "No sports are currently available." in the picker. Skeletons show while loading, and errors offer Try again.
- `components/sports/SportIcon.vue` shows `Sport.iconUrl` when the server has one and otherwise the built-in icon for the sport's name (`utils/sports.ts`). The icon is presentation only; a sport is identified by its id.
- `/profile/followers` and `/profile/following` show the real counts; the lists arrive with the Follow system.
- The `profile` Pinia store holds `currentProfile`, `viewedProfile`, `loading`, `saving`, and `error`, with `fetchMyProfile`, `fetchProfile`, and `updateProfile`. It calls `services/profile-api.service.ts` with the JWT.
- The `sports` Pinia store (`stores/sports.ts`, via `services/sports-api.service.ts`) holds the sport list (`sports`, `activeSports`, `sportsStatus`, `sportsError`) and your sports (`mySports`, `mySportsStatus`, `mySportsError`, `addable`, `busyId`), with `fetchSports`, `fetchMySports`, `addSport`, `updateSport`, and `removeSport`. The list is cached after the first success and concurrent calls share one request. It takes your sports from `GET /profiles/me` when the profile loads and writes every change back to `currentProfile.sports`. A duplicate (409) refreshes your sports, and a retired sport (404) reloads the list. Profile, Create Club, Manage Club, the header filter, and the Create Post sport picker read it; the filter and Create Post fall back to the demo catalog names only if the list cannot load. A 401 logs the user out and the tab layout sends them to `/login?redirect=…`; other errors become friendly messages (`utils/api-errors.ts`).
- Reels is laid out like TikTok: no app header, the video fills the screen, and the Following / For You text tabs sit centered over the top with a LIVE button top-right opening `/live`. Reels has two tabs, Following and For You (the default). Following shows reels from accounts the viewer follows, newest first. For You is ordered by views as a placeholder; the recommendation service will rank it on the server. Each reel has a Follow / Following button.
- Following and friendship are separate. Following is one-way and needs no approval; it shapes what the viewer sees. Friendship is mutual, needs a request and Accept, and drives Friends and Chat. Following someone never creates a friend request, and unfriending does not unfollow.
- Friends (`/profile/friends`) has Friends and Requests. Requests lists Received requests (Accept, Decline) and Sent requests (Cancel). The friend-request notification opens `/profile/friends?tab=requests`, and the Friends tile on Profile shows the pending count.
- Chat (`/chat`) has three tabs, in this order: Friends (conversations with accepted friends, newest first, with unread counts), Clubs (the official chat of every club the viewer is an ACTIVE member of: club image, name, "Sender: last message", time, and unread count), and Requests (the Message Requests list: first messages from non-friends, with Accept and Delete, then the requests you sent). `/chat?section=requests` opens the Requests tab. Accepting a request opens the conversation at `/chat/:conversationId`.
- Tapping Message on a profile always opens a chat screen. Friends get the direct conversation. Anyone else gets `/chat/request/:userId`, the same screen (`ChatThreadPage`) with a note that the first message goes to their Message Requests. Sending it creates the one message request for the pair; after that the composer reads "Waiting for X to accept…" until they accept. Sent requests in Chat → Requests open that screen. The Chat tab badge counts unread direct messages, pending requests, and unread club messages.
- Group chats exist only as club chats. Users can message friends, send message requests to non-friends, and take part in club chats; they cannot create a group chat, turn a direct chat into a group, or add people. There is no "Create Group" button anywhere. A club chat opens at `/chat/clubs/:clubId` (`ClubChatPage`) from Chat → Clubs or from the [Chat] button on a club page, which is disabled for anyone who is not an ACTIVE member. The screen is styled apart from direct chats: the header shows the club image, name, and "Members: N", an "Official Club Chat" banner sits under it, and messages are grouped by sender with names. Pending, removed, banned, and non-members see "Members only" with the server's reason, and no composer. Clubs stored on the server (UUID ids) use the club chat API through `stores/club-chat.ts` and `services/club-chat-api.service.ts`; the demo clubs keep demo chats that follow the same membership rules (`utils/club-chat.ts`).
- Search is a browse-first page: sport tiles until you type or pick a category, then results for Players, Sports, Games, Locations, Posts, Reels, and Clubs. Distance and sport come from the header filter. Tapping a sport tile (in Search or Discover) opens that sport's section at `/search/:sport`: a "Search in Basketball" box that narrows every section, the sport's games with date chips (All by default, meaning every upcoming game; Today, Tomorrow, and This Week are optional) and a Map/List toggle, then players, clubs, reels, locations, and every post about the sport the viewer may see, newest first, as full post cards. The date chips only affect games. The sport page's Map view hands off to Discover's map of real games for that sport and date (`/discover?sport=&date=&view=map`); see [Sport-Based Live Activity Map](features/sport-map-discovery.md).
- Discover has three feed filters: All, Friends, and Clubs (`DISCOVER_TABS`). All shows Popular Players, Trending Sports, Popular Games, Trending Reels, Nearby Activities, Featured Athletes, Popular Clubs, and Public Posts. Friends is one newest-first feed from accepted friends plus followed accounts. Clubs shows the clubs the viewer belongs to or follows, then their posts, games, and reels. Everything is narrowed by the header filter. Nearby means the chosen distance, or 10 km when it is Any. The placeholder ordering lives in `utils/discover.ts` and `utils/feed.ts`; the recommendation algorithm is not built.
- Clubs have no bottom tab. They are reached from Profile → My Clubs (`/profile/clubs`), Settings → Create Club (`/profile/clubs/new`, the only place to start a club), Search → Clubs, the sport page, Discover, and the club label on club games, posts, and reels. A club page (`/clubs/:clubId`) shows the cover, avatar, name, handle, sport, location, capacity ("24 / 50 Members · 26 slots available", or FULL), the membership type, the join button (Join Club, Request to Join, Accept Invite, Club Full, or Invite Only), Follow, Chat (ACTIVE members only), the about block (description, rules, schedule, home court, tags, contact), and Posts / Games / Reels / Members tabs. Private clubs hide their content from non-members. A club game still names its host: "Hosted by Louis" with the club underneath.
- Create Club (Settings → Create Club, `/profile/clubs/new`, `CreateClubPage` with `components/clubs/ClubFormFields.vue`) collects identity (name, @username, photo and cover URLs, short description, about), sports (a primary sport from `GET /sports` plus up to 5 additional ones), location (country, city, barangay, home court, location name, optional coordinates typed by the user), membership (maximum members from presets 10–1000 or a custom number, Open / Approval Required / Invite Only, Public / Private), rules, tags, an informational activity schedule, and contact links. `utils/club-form.ts` shows the same errors inline that the server returns ("Maximum members must be at least 1."). Success shows "CLUB CREATED!", "You are the Owner.", "Members: 1 / 50", and Go to Club / Open Club Chat.
- Manage Club (`/clubs/:clubId/manage`, owner and admins) has Settings (owner only; the same form, sending only changed fields, and refusing a maximum below the current active members), Requests (approve, disabled while the club is full, or reject), Invites (invite by @username), and Members (remove, following `canManageMember`). Demo clubs cannot be managed.
- Game cards on Home, Search, Discover, and the sport page show `PLAYERS current/required` from occupying participants, plus View Game and Request to Join. Game Details (`/games/:gameId`) shows the host (playing or not), remaining slots, and one roster row per required player.
- "Join Game" only sends a join request (`REQUESTED`). The viewer becomes a `PARTICIPANT` after the host accepts, and only participants of a completed game earn activity credit.
- Create Game (Create (+) → Create Game, `/create/game`, `CreateGamePage`) has Sport (from `GET /sports`), Title, Description, Required Players, Date, Start, End (native date and time pickers, the venue's local time), Location, optional latitude/longitude, and an optional Club (server clubs the account is an ACTIVE member of). `utils/game-form.ts` shows the server's rules inline. Success shows "GAME CREATED!" and a `GamePreviewCard` (sport, title, description, 📅 date, ⏰ time range, 📍 location, PLAYERS 0/12, Hosted by @user, View Game). The host edits at `/games/:gameId/edit` (the same page; only changed fields are sent).
- Game Details for a GORA game (UUID id) loads `GET /games/:id` through the games store (`ServerGameDetails`): status badge, sport, title, description, date, time range, location (a map link only when coordinates exist), host, club, PLAYERS current/required, and a Player Roster from `GET /games/:id/players`: the seated players in join order (avatar, name, @username, a "You" badge, each linking to `/profile/:username`), then one Open slot per free seat generated in the UI (`buildRosterSlots`; no fake users are stored). The host gets Edit Game, Cancel Game (with a confirmation), Manage Players (shown once someone is seated; it adds Remove Player with a confirmation to each row), and a JOIN REQUESTS section (`HostJoinRequests`): "Pending Requests: N" from the server, each pending request with avatar, name, message, and Accept / Reject, then the answered ones. Others get their state from `GET …/join-requests/me` and `GET …/players/me` (`utils/join-requests.ts`): an ACTIVE player sees "You're playing in this game." and Leave Game (with a confirmation); Request to Join opens `JoinRequestModal` (optional message, Cancel / Send Request); a pending request shows a disabled Request Pending plus Cancel Request; a declined one shows "Request declined"; someone who left or was removed sees why and may ask again; a FULL or ACTIVE game shows a disabled button. Requests live in the join requests store (`stores/join-requests.ts`) and the roster in the game players store (`stores/game-players.ts`); both block repeated taps and reload the game count and roster after every accept, reject, leave, remove, or conflict. Other ids are still the demo feed's games.
- My Games (`/profile/games`) has Hosting (`GET /games/mine`, upcoming, soonest first), Playing (`GET /games/playing`, upcoming games where you are an ACTIVE player; games you left or were removed from are not listed), and Past & cancelled (both lists, without duplicates).

Profile, Edit Profile, MY SPORTS, other users' profiles, the header avatar, Create Game, Game Details for GORA games (including join requests), My Games, and posts call the API. Posts: when signed in, the posts store (`stores/posts.ts`, `services/posts-api.service.ts`) loads `GET /posts` and the account's own `GET /users/:username/posts`, Create Post saves with `POST /posts`, and the author's "⋯" menu on a post (Edit post, Edit privacy, Tag people / Edit tags, Delete post) calls `PATCH /posts/:id`, `PATCH …/visibility`, `PUT …/tags`, and `DELETE /posts/:id`. Edit post (`EditPostModal`) changes the caption, sport, and location; the card then shows "· Edited". Delete post asks "Delete post?" first. Real posts are listed first and never filtered again on the client; the demo posts stay beside them and are only changed locally. Photos cannot be saved yet (no upload storage), so Create Post hides the photo picker while signed in, and Tag People / Custom privacy list only real accounts, which appear once the Friends system is connected. Stories and reels: when signed in, `stores/stories.ts` (`GET /stories`, `GET /stories/mine`) and `stores/reels.ts` (`GET /reels` plus your own `GET /users/:username/reels`) load real items through `services/stories-api.service.ts` and `services/reels-api.service.ts`. Add Story (`/create/story`: local photo/video file, preview, upload progress, caption, privacy) and Upload Reel (`/create/reel`: local video file, preview, upload progress, caption, sport, privacy) open from Create (+) and from the Your Story add button. Your own stored stories and reels get a "⋯" menu (`components/media/MediaOptionsButton.vue`: Edit caption / Edit reel, Edit privacy, Delete with a confirm) in the story viewer (playback pauses while it is open), My Stories, Profile → Highlights, My Reels, and the Reels tab. Highlights and My Reels show only the signed-in account's reels (the demo highlights appear only without a session); the Reels tab lists real reels first, then the demo reels. Everything else still reads `services/mock/`, including the game cards on Home, Search, Discover, and the sport page, and the other Profile sub-pages (Friends, Badges, Activity).

### Stories and achievements (demo data)

The demo stories, activity statistics, and badges are UI only. Data comes from `services/mock/` through `story.service.ts`, `profile.service.ts`, and `user.service.ts`. Replacing those service bodies with API calls is the only change needed when the backend exists. Components and stores do not import mock files.

Stories:

- A story has `user`, `media`, `createdAt`, and `expiresAt`, where `expiresAt = createdAt + 24 hours`.
- The service returns every story, including expired ones. `partitionStories` splits them into `active` and `expired` at display time. Nothing is deleted, so a Story Archive can later be built from the expired set.
- The ring around each avatar shrinks as the newest story ages, so every ring doubles as a countdown.

Activity and badges:

- Activity stats and badge progress arrive precomputed. Vue formats and displays them and never decides whether a badge is earned from raw activity.
- A badge shows as unlocked when `unlocked` is true or `progress >= target`.
- `AchievementProgress.vue` takes `current`, `target`, and `label`, and calculates the percentage itself.

Planned backend flow, not implemented:

```text
User completes game
  -> backend records completion
  -> activity statistics updated
  -> achievement rules evaluated
  -> badge unlocked
  -> notification created
  -> frontend displays badge
```

## Backend

The API is a NestJS application. Every route is mounted under `/api/v1`.

| Area | Responsibility |
| --- | --- |
| `config/` | Environment loading and validation |
| `common/` | Shared filters and constants |
| `bootstrap/` | Application setup used by the server and tests |
| `health/` | `GET /api/v1/health` |
| `auth/` | Register, login, `GET /auth/me`, `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser()` |
| `users/` | `UsersService`: the only code that reads or writes `User` for auth, always with an explicit safe `select` |
| `social/` | Relationship state between two users (`relationship.ts`, `RelationshipService`) and `GET /users/:username/relationship` |
| `posts/` | Create a post, read one, list a user's posts, and change privacy; every read goes through `visiblePostsWhere` |
| `profiles/` | Your profile (`/profiles/me`, plus the `/profiles/me/sports` aliases) and other users' profiles (`/profiles/:username`) |
| `sports/` | The read-only sports catalog (`GET /sports`, `GET /sports/:id`) and your own sports (`/users/me/sports`, `UserSportsService`) |
| `games/` | Create, read, list, edit, and cancel games (`GamesService`); join requests (`JoinRequestsService`); every read goes through `visibleGamesWhere` |
| `prisma/` | `PrismaService` (global) and the database connection |
| `generated/prisma/` | Generated Prisma Client (not committed) |

Rules for feature work:

- A feature gets its own module.
- Controllers accept the request and return the response.
- Services own the business logic.
- DTOs validate input through the global validation pipe.
- Prisma will be the only database access path. Controllers will not query the database.
- Secrets and environment-specific URLs stay in environment variables.

Errors are returned as JSON with `success: false`, a message, a timestamp, and the request path. Unexpected failures are logged on the server and are not returned with a stack trace.

### Authentication

The call chain is `AuthController` → `AuthService` → `UsersService` → `PrismaService`.

- Passwords are hashed with Argon2id (`argon2`). Plaintext passwords and `passwordHash` never leave `AuthService`; responses are built from `SAFE_USER_SELECT` / `CURRENT_USER_SELECT` in `users/user.types.ts`.
- `POST /api/v1/auth/register` trims text fields and lowercases the username and email before validation. Usernames are 3–30 characters of `a-z`, `0-9`, `.`, and `_`, and cannot be one of the reserved words in `users/reserved-usernames.ts` (such as `edit`, `followers`, `settings`), because they would clash with `/profile/*` routes. Passwords are 8–128 characters. `confirmPassword` is optional on the API, must match when sent, and is never stored. A duplicate username or email returns `409`.
- `POST /api/v1/auth/login` returns `401 Invalid credentials.` for an unknown email or a wrong password (an unknown email still runs one Argon2 verify, so timing does not reveal which). Only after the password is correct does an inactive account get `401 This account is inactive.`
- Both return `{ user: { id, username, email, firstName, lastName, role }, accessToken }`.
- `GET /api/v1/auth/me` requires `Authorization: Bearer <token>` and returns `id, username, email, firstName, lastName, profileImageUrl, bio, city, role`.
- JWTs are HS256 with payload `{ sub, username, role }` only, signed with `JWT_SECRET` (at least 32 characters; the server refuses to start without it) and expiring after `JWT_EXPIRES_IN` (default `7d`). `JwtStrategy` reloads the user on every request and rejects missing or inactive accounts, so deactivating a user cuts off existing tokens.
- Logout is client-side: the app forgets the token. Tokens are not stored in the database and cannot be revoked before they expire; a denylist or refresh tokens would need Redis or a table in a later phase.
- Protect a new route with `@UseGuards(JwtAuthGuard)` and read the user with `@CurrentUser()`.

### Post privacy

Privacy is enforced by the database query, not by the client. `posts/post-visibility.ts` exports `visiblePostsWhere(viewerId)`, the only definition of which posts a viewer may see, and every post read uses it:

- The author always sees their own posts.
- Anyone else sees `PUBLIC` posts; `FRIENDS` posts only with an `ACCEPTED` friendship with the author; `CUSTOM` posts only when listed in `PostCustomViewer` (being a friend is not enough); and never `ONLY_ME` posts.
- A `BLOCKED` friendship in either direction hides all of the author's posts, as do deactivated authors and posts in private clubs the viewer is not an ACTIVE member of.

Endpoints (all require a Bearer token):

- `POST /posts` with `caption` (required, trimmed, up to 2200 characters), `visibility`, optional `sportId`, and `customViewerIds` (UUIDs, 1–100, required for `CUSTOM`, rejected otherwise). Custom viewers must be active users, not the author, and not blocked with the author. The body cannot set the author. Optional `taggedUserIds` (up to 20 unique UUIDs; same rules as custom viewers) and `location` (`{ name, latitude, longitude }`, all three required, name up to 120 characters, coordinates in range) are stored with the post.
- Responses include `location` (or null) and `tags`. Tags leave out deactivated users and anyone with a block with the viewer. Tagging never changes who can see a post; its visibility still decides.
- `PUT /posts/:postId/tags` with `{ userIds }` replaces the tag list (`[]` removes every tag). Author-only, with the same `403`/`404` answers as the visibility endpoint.
- `GET /posts/:postId` returns `404 Post not found.` both when the post does not exist and when the viewer may not see it, so hidden posts cannot be discovered.
- `GET /users/:username/posts?limit=&cursor=` lists the posts of that user that the viewer may see, newest first, with cursor pagination. It returns `404 User not found.` for unknown or inactive users and when that user blocked the viewer.
- `PATCH /posts/:postId/visibility` is author-only (`403` for other viewers who can see the post, `404` for those who cannot). It replaces the custom viewer set in one transaction; switching to `CUSTOM` without new ids keeps the saved list. The change applies to the very next read.
- The list of custom viewers is returned only to the author; nobody else ever receives it.
- `GET /posts?limit=&cursor=` is the Home feed: every post the viewer may see, newest first (no ranking), with the same cursor pagination.
- Responses also carry `sport { id, name }` (or null), `likeCount`, `commentCount`, `shareCount`, `likedByViewer`, and `editedAt`.
- `PATCH /posts/:postId` (Edit Post) accepts only `caption` (trimmed, 1–2200; it cannot be emptied), `sportId` (`null` removes it), and `location` (`null` removes it). Only sent fields change, and `editedAt` is set when something actually changed. Author-only with the same `403`/`404` answers; privacy and tags keep their own routes.
- `DELETE /posts/:postId` (Delete Post) is author-only and a soft delete (`20260930230000_post_edit_and_soft_delete`): it sets `Post.deletedAt` and answers `{ id, deleted: true }`. `visiblePostsWhere` excludes deleted posts for everyone, the author included, so every read, count, edit, and second delete then answers 404. The row, its likes, comments, tags, and media stay in the database.

### Stories and reels (edit, privacy, delete)

Stories (`server/src/stories/`) and reels (`server/src/reels/`, which are also Profile → Highlights and My Reels) use the same four audiences as posts: `PUBLIC`, `FRIENDS`, `CUSTOM`, `ONLY_ME`. `Story.visibility` reuses the `PostVisibility` enum; `ReelVisibility` gained `CUSTOM` and `ONLY_ME` (`20260930233000_reel_visibility_custom_only_me`). Custom viewers live in `StoryCustomViewer` and `ReelCustomViewer` (unique per item + user, never the author, trigger-enforced), and both tables have `deletedAt` (`20260930233100_story_reel_privacy_and_delete`). The audience rules (at least one person for CUSTOM, active users, not the author, no block either way) are shared with posts through `AudienceService` (`server/src/social/audience.service.ts`).

- `visibleStoriesWhere(viewerId, now)` and `visibleReelsWhere(viewerId)` are the only visibility rules, built like `visiblePostsWhere`: the author sees their own (stories: including expired); others see PUBLIC, FRIENDS as an accepted friend, CUSTOM when listed, never ONLY_ME; a block either way or a deactivated author hides everything; a private club hides reels from non-members; others never see an expired story. Deleted items are hidden from everyone. Hidden and missing both answer 404; a visible item that is not yours answers 403 on edit, privacy, and delete.
- Stories: `POST /stories` (`mediaType` IMAGE/VIDEO, `mediaUrl` http(s) up to 2048, optional `caption` up to 500, `visibility`, `customViewerIds`; the server sets `expiresAt = createdAt + 24h`), `GET /stories` (active stories you may see), `GET /stories/mine` (yours, active and expired, not deleted), `GET /stories/:id`, `PATCH /stories/:id` (`caption`; blank or null removes it), `PATCH /stories/:id/visibility`, `DELETE /stories/:id` (soft).
- Reels: `POST /reels` (`videoUrl`, optional `thumbnailUrl`, `caption` up to 2200, `sportId` (active sport, else 400), `durationSeconds` 1–600, `visibility`, `customViewerIds`), `GET /reels` (feed, newest first, cursor), `GET /reels/:id`, `GET /users/:username/reels` (Highlights / My Reels; unknown, inactive, or blocking users answer 404), `PATCH /reels/:id` (`caption`, `sportId`; null removes either), `PATCH /reels/:id/visibility`, `DELETE /reels/:id` (soft).
- The body can never set the author, counts, `expiresAt`, or `deletedAt` (400). The custom viewer list is returned to the author only. Stories support both uploaded files and existing external media URLs; CHECK constraints enforce media references and caption limits.
- `POST /reels/upload` accepts authenticated multipart data: `video` (MP4/WebM, at most 50 MB), `visibility`, optional `caption`, `sportId`, `durationSeconds` (1–600), and `customViewerIds` (JSON array). The form checks browser playback and duration before sending. The API validates metadata, size, MIME/container headers and audience; it does not transcode or deeply inspect codecs. Files use generated UUID names in `REEL_UPLOAD_DIR` (default `uploads/reels` relative to the API working directory). The database stores an internal `upload:<uuid>.<extension>` reference, allowed by migration `20261010050000_reel_video_uploads`. Failed creation removes the file; soft deletion removes the uploaded file while retaining the database row.
- API reel responses replace uploaded references with scoped HMAC playback URLs valid for 12 hours. `GET /reels/:id/video?token=...` verifies the signature, expiry and active viewer, then applies `visibleReelsWhere` before serving bytes. It supports HTTP range requests for seeking and sends `Cache-Control: private, no-store`. Treat these URLs as bearer capabilities: avoid sharing them. Audience changes, blocks, deactivation, and deletion prevent subsequent requests. The frontend resolves relative playback URLs against its configured API host. Deployment must preserve and back up the upload directory; existing external URLs continue working.

### Direct messages and message requests

`server/src/chat/` handles authenticated direct chats using the existing Conversation, ConversationParticipant, Message, and MessageRequest tables. `stores/chat.ts` uses API data when signed in and demo data only for signed-out previews. Every account change clears conversation, message, request, recipient and pagination caches. Stale responses are ignored. Active chat screens poll every five seconds while the document is visible; this uses HTTP polling, not WebSockets or push notifications.

- `GET /chat/direct` returns the viewer's inbox. `POST /chat/direct/:userId` opens the unique direct conversation for two friends, or an existing accepted chat. `GET /chat/direct/:id` returns its summary. The `partner` is always the other participant relative to the authenticated viewer; `lastMessageSenderId` independently identifies the preview's author.
- `GET /chat/direct/:id/messages` returns a page oldest to newest, with `limit` (default 50, maximum 100), optional `before`, and `nextCursor`. Reading the newest page marks messages through the request's start time as read, so a message arriving during the read remains unread. `POST` on the same path accepts only `{ body }` (trimmed, 1–1000 characters); `senderId` comes exclusively from the JWT. Messages include their sender's public identity. `PUT /chat/direct/:id/read` marks the thread read. Non-participants, blocked pairs and inactive accounts cannot access the chat.
- `GET /chat/requests` returns separate `received` and `sent` lists; received entries identify the sender, sent entries identify the recipient. `POST /chat/requests/:userId` sends one first message per pair. `POST /chat/requests/:id/accept` is receiver-only and atomically creates or reuses the conversation, keeping the original sender for the initial message. `DELETE /chat/requests/:id` rejects a pending received request. `GET /chat/recipients/:userId` restores the request screen's identity after reload. Rejected requests cannot be repeatedly resent; becoming friends allows a direct chat.

### Relationships

`social/relationship.ts` turns the `Friendship` row between two users into the viewer's state: `SELF`, `NO_RELATIONSHIP` (also after a rejected request), `REQUEST_SENT`, `REQUEST_RECEIVED`, `FRIENDS`, `BLOCKED` (the viewer blocked them), or `BLOCKED_BY_THEM`. It also gives the message access (`DIRECT` for friends, `REQUEST` for non-friends, `NONE` for self and blocks) and whether a friend request may be sent (only from `NO_RELATIONSHIP`). `GET /users/:username/relationship` returns `{ user, state, messageAccess, canSendFriendRequest }` and answers `404` instead of revealing `BLOCKED_BY_THEM`. It is read-only; sending, accepting, rejecting, and blocking are the full Friends system of a later prompt. Profile privacy settings are separate and not built.

### Profiles and sports

The call chain is `ProfilesController` → `ProfilesService` → `PrismaService`. Every route requires a Bearer token. Writes only ever target the signed-in user ("me"); no route accepts another user's id, so nobody can edit someone else's profile. Responses are built from `PROFILE_USER_SELECT` and never include `passwordHash`, `email`, `role`, or `isActive`.

- `GET /profiles/me` returns `{ id, username, firstName, lastName, displayName, profileImageUrl, coverImageUrl, bio, city, dateOfBirth, sports, stats, sections, createdAt, isOwnProfile: true }`.
- `PATCH /profiles/me` accepts `firstName`, `lastName` (1–50 characters, cannot be blank), `bio` (up to 160), `city` (up to 100), `dateOfBirth` (a past date), `profileImageUrl`, and `coverImageUrl` (absolute `http(s)` URLs up to 2048 characters). Empty `bio`, `city`, `dateOfBirth`, or image values clear the field. `username` and `email` are rejected with a clear message, and any other field (`id`, `passwordHash`, `role`, `isActive`, timestamps) is rejected by the validation pipe. It returns the updated profile.
- `GET /profiles/:username` returns your own profile for your username. For others it returns `{ ..., relationship: { state, messageAccess, canSendFriendRequest }, isOwnProfile: false }` without `dateOfBirth`. Unknown, deactivated, and blocking users answer `404 User not found.` (a block is never revealed). If you blocked them, only their identity comes back; bio, city, sports, stats, and sections are empty or null.

### Sports

One central `Sport` table (`id`, unique `name`, `description`, `iconUrl`, `isActive`, timestamps) is shared by `UserSport`, `Game.sportId` (required), and the optional `Post.sportId`, `Reel.sportId`, `Club.sportId`, and `ClubSport`. The 10 sports (Basketball, Volleyball, Football, Tennis, Badminton, Running, Table Tennis, Swimming, Cycling, Other) come from the seed, which upserts by name and never changes `isActive`. Users can only read sports: there is no route to create, edit, activate, deactivate, or delete one (that is for a future admin module). A retired sport keeps its rows for history but is no longer listed or addable.

The sports module (`server/src/sports/`) has `SportsController` / `SportsService` for the catalog and `UserSportsController` / `UserSportsService` for a user's own sports. `UserSportsService` is exported and also backs the profile's sport list and the `/profiles/me/sports` aliases, so the rules live in one place. Every route requires a Bearer token; the owner always comes from the JWT, and a `userId` (or any unknown field) in a body is rejected with `400`.

- `GET /sports` lists active sports alphabetically with Other last: `{ id, name, description, iconUrl, isActive }`, never timestamps.
- `GET /sports/:id` returns one sport, including a retired one (`isActive: false`) so old games and posts can still name it. An unknown or non-UUID id answers `404 Sport not found.`.
- `GET /users/me/sports` lists your sports in the order you added them with `{ sportId, name, iconUrl, skillLevel, position, createdAt, updatedAt }`. Retired sports are left out.
- `POST /users/me/sports` with `{ sportId, skillLevel, position? }`: `sportId` must be a UUID ("Choose a valid sport."), `skillLevel` is `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, or `PROFESSIONAL`, and `position` is optional free text up to 40 characters (blank means none; position suggestions are a client hint, never a rule). An unknown or retired sport answers `404 Sport not found.`; adding a sport twice answers `409` ("Basketball is already on your profile. Edit it instead."), also when two adds race (the unique index decides).
- `PATCH /users/me/sports/:sportId` changes `skillLevel` and/or `position` (empty clears it); the sport itself cannot change. `DELETE /users/me/sports/:sportId` removes only the `UserSport` row and answers `204`. Both answer `404` when the sport is not on your profile, which is also what another user's sport looks like: each user's "me" is only themselves.
- `GET|POST /profiles/me/sports` and `PATCH|DELETE /profiles/me/sports/:sportId` are aliases with the same behavior, kept for existing clients.

Counts are never stored or invented; each is counted from rows, and a system with no data yet answers 0:

- `stats.friends`: `ACCEPTED` friendships with active users. `stats.followers` / `stats.following`: `UserFollow` rows with active users. Friendship and follows stay separate.
- `sections.posts`: posts the viewer may see (`visiblePostsWhere`). `sections.games`: games hosted or joined (`ACTIVE`/`COMPLETED` participation), not cancelled. `sections.reels`: reels the viewer may see (`visibleReelsWhere`). `sections.stories`: active stories the viewer may see (`visibleStoriesWhere`). `sections.clubs`: `ACTIVE` memberships in active clubs (private clubs only when the viewer is also a member). `sections.activity`: completed games the user completed. `sections.badges`: unlocked badges.

### Games

The call chain is `GamesController` → `GamesService` → `PrismaService` (`server/src/games/`). Every route requires a Bearer token. The host always comes from the JWT, a new game is always `OPEN`, and games are never deleted. Join requests and players have their own controllers and services in the same module (below).

- Dates and times are the venue's wall clock: `gameDate` is `YYYY-MM-DD` and `startTime`/`endTime` are `HH:mm` on that date, stored as timestamp without time zone and returned exactly as entered (`game-schedule.ts`). "Today" is decided in `GAME_TIMEZONE` (IANA zone, default `Asia/Manila`), never in the database's or the browser's zone.
- `POST /games` accepts only `sportId`, `clubId`, `title` (3–80, trimmed), `description` (up to 500, blank is none), `requiredPlayers` (whole number 1–100), `gameDate` (a real date from today up to 365 days ahead), `startTime`, `endTime` (end after start, equal is rejected; a game today cannot start in the past), `locationName` (2–120), and optional `latitude` (−90..90) / `longitude` (−180..180), both or neither. `hostId`, `status`, player counts, and timestamps are rejected with 400. An unknown or retired sport answers `404 Sport not found.`. A club must exist (404), be active (403), and have the host as an ACTIVE member (`HOST_CLUB_GAMES` in `club-permissions.ts`, 403); the `Game_require_club_member` trigger checks the same in the database. The host stays the host.
- Responses: `{ id, title, description, sport { id, name, iconUrl }, host { id, username, firstName, lastName, displayName, profileImageUrl }, club { id, name, slug, profileImageUrl } | null, requiredPlayers, currentPlayers, remainingSlots, status, gameDate, startTime, endTime, locationName, latitude, longitude, isHost, isPlayer, pendingRequestCount, canEdit, canCancel, createdAt, updatedAt }`. `currentPlayers` is the number of ACTIVE `GameParticipant` rows (the same count as the roster endpoint); no participant is ever invented, not even the host. `isPlayer` is true when the viewer holds an ACTIVE seat. `pendingRequestCount` is the number of PENDING join requests, sent to the host only (`null` for everyone else).
- `GET /games/:id` answers `404 Game not found.` for unknown, malformed, and hidden games. `visibleGamesWhere` (`game-visibility.ts`): the host always sees their games; others see games of active hosts with no block in either direction that are outside a club, in a public club, or in a club they are an ACTIVE member of.
- `GET /games?sportId=&status=&gameDate=&limit=&offset=` lists visible games soonest first (date, then start time). `gameDate` is `upcoming` (default: today and later), `today`, or a `YYYY-MM-DD` date; without `status` only OPEN, FULL, and ACTIVE games are listed. `limit` is 1–50 (default 20). There is no text search, distance, or map here. `GET /games/mine` lists every game you host, whatever its status or date. `GET /games/playing` lists every visible game where you hold an ACTIVE seat.
- `GET /games/discover?sportId=&date=&latitude=&longitude=&distanceKm=&status=&limit=` (`GameDiscoveryService`, separate from game CRUD) finds visible games for the map and list. `date` is `today`, `tomorrow`, `this-week`, or one `YYYY-MM-DD` date (default every date from today on, on the `GAME_TIMEZONE` clock). `latitude`/`longitude` come together (validated -90..90 / -180..180, never 0 as a fallback), only center the search, and are never stored; `distanceKm` (0.1–100, omitted = Any) needs them. Default statuses OPEN/FULL/ACTIVE; COMPLETED on request; CANCELLED is 400. Unknown sport 404. With a radius, a bounding box on `(latitude, longitude)` narrows the query and Haversine (`geo-distance.ts`) keeps games within it, nearest first; games without coordinates never appear in radius results (they are listed without a distance otherwise). Each result carries `sport`, a public `host` summary, schedule, place, `distanceKm`, `currentPlayers` (ACTIVE `GameParticipant` rows) / `requiredPlayers`, `status`, `isHost`, `isPlayer`, and `myJoinRequestStatus`. It never changes a game.
- `PATCH /games/:id` is host only (`403 Only the host can change this game.`; 404 when the game is hidden) and only while the game is OPEN or FULL (409 otherwise). It accepts the same fields as create, all optional; the schedule is re-checked only when the date or a time changes, and `requiredPlayers` cannot drop below the players already in the game (409, `Game_capacity_roster_guard`). Status cannot be set.
- `PATCH /games/:id/cancel` is host only and sets `CANCELLED` (409 when already cancelled or completed). The row and its history stay.

### Join requests

`JoinRequestsController` → `JoinRequestsService` → `PrismaService` (`server/src/games/join-requests.*`), using the existing `JoinRequest` model (no migration). Every route requires a Bearer token; the requester and the host come from the JWT, and only the optional message is ever read from a body (`userId`, `status`, `gameId` in a body are 400).

- `POST /games/:gameId/join-requests` with `{ message? }` (trimmed, blank is none, up to 300 characters) creates a PENDING request. The game must be visible to the requester (`visibleGamesWhere`, so a block in either direction answers 404 like a missing game), OPEN, and not started yet (the start is compared in `GAME_TIMEZONE`; a FULL game answers `409 This game is already full.`). The host asking to join their own game answers 403. An ACTIVE player, or a request that is PENDING or REJECTED answers 409. A CANCELLED request, or an ACCEPTED one whose player has since left or been removed, is reused: asking again moves the same row back to PENDING (one row per player and game, the unique index), so requests cannot be spammed and a declined player cannot ask again for that game.
- `GET /games/:gameId/join-requests/me` returns `{ joinRequest }`, the viewer's current or most recent request, or `null`.
- `PATCH /games/:gameId/join-requests/me/cancel` moves the viewer's own PENDING request to CANCELLED (404 when they have none, 409 when it was already answered).
- `GET /games/:gameId/join-requests` is host only (403 otherwise): every request on the game, PENDING first, each with the requester's public fields `user { id, username, firstName, lastName, displayName, profileImageUrl }`. Email, date of birth, and credentials are never returned.
- `PATCH /games/:gameId/join-requests/:requestId/accept` and `/reject` are host only. The request must belong to that game (404 otherwise, as for unknown or malformed ids) and be PENDING (409 with the current state). Accept runs in a transaction that locks the `Game` row (`SELECT … FOR UPDATE`), re-checks that the request is still PENDING, that the game is OPEN (FULL answers `409 This game is already full.`) and not started, that the requester is still active and not blocked, and that ACTIVE players are below `requiredPlayers`. It then marks the request ACCEPTED and seats the player (creates an ACTIVE `GameParticipant`, or reactivates their existing row) in the same transaction, so a request is never ACCEPTED without a seat. Both accept and reject set `respondedAt`.
- State machine: only PENDING moves, to ACCEPTED or REJECTED (host) or CANCELLED (requester). Every move is a conditional `updateMany … where status = PENDING`, so two simultaneous answers cannot both win; the loser gets 409. Rows are never deleted.
- When the last seat is taken the `GameParticipant_sync_recruiting_status` trigger flips the game to FULL inside the same transaction. Pending requests on a FULL game stay PENDING and are never accepted automatically; the host can accept one once a seat opens. The request stays ACCEPTED (never deleted) even after the player leaves.
- Responses: `{ id, gameId, userId, message, status, createdAt, updatedAt, respondedAt }`; host responses add `user`.

### Players

`GamePlayersController` → `GamePlayersService` → `PrismaService` (`server/src/games/game-players.*`, shared helpers in `game-roster.ts` and `game-capacity.ts`), using the existing `GameParticipant` model and `ParticipantStatus` enum (`ACTIVE`, `LEFT`, `COMPLETED`, `REMOVED`); no migration. Every route requires a Bearer token and reads no body.

- `GET /games/:gameId/players` (anyone who may see the game, else 404) returns `{ gameId, requiredPlayers, currentPlayers, availableSlots, status, players: [{ id, username, firstName, lastName, displayName, profileImageUrl, joinedAt }] }`: ACTIVE players only, in join order. Open slots are not stored; the client draws them from `availableSlots`.
- `GET /games/:gameId/players/me` returns `{ gameId, status, joinedAt, completedAt }` where `status` is `ACTIVE`, `LEFT`, `COMPLETED`, `REMOVED`, or `NOT_A_PLAYER` (the host is `NOT_A_PLAYER` unless seated).
- `PATCH /games/:gameId/players/me/leave` moves the caller's ACTIVE seat to LEFT (404 without a seat; 409 when already LEFT, REMOVED, or COMPLETED, or when the game is ACTIVE or COMPLETED).
- `PATCH /games/:gameId/players/:userId/remove` is host only (403 otherwise; 400 for the host's own id). The target must be ACTIVE (404 without a seat, 409 when LEFT, REMOVED, or COMPLETED). It sets REMOVED and returns the updated roster.
- Rules: at most one row per player and game (the unique index), so rejoining after leaving or removal reactivates the same row, and there can never be two ACTIVE seats. The count is ACTIVE rows only. Leave and remove run in a transaction that locks the `Game` row, never delete the row, and reopen a FULL game to OPEN through the recruiting-status trigger. CANCELLED, ACTIVE, and COMPLETED games are never reopened or closed by these changes; the game lifecycle (ACTIVE/COMPLETED) is not automated yet.
- Capacity is enforced three times: the service counts ACTIVE players under the row lock, the `GameParticipant_capacity_guard` trigger rejects any insert or reactivation past `requiredPlayers` (mapped to `409 This game is already full.`), and the lock serializes concurrent accepts. Two simultaneous accepts for the last seat produce one 200 and one 409 (the other request stays PENDING), never 13/12.

## Database

PostgreSQL (`gora_db`) is accessed only through Prisma in the NestJS server. The schema is `server/prisma/schema.prisma`; migrations are in `server/prisma/migrations/` and are only ever added, never reset or deleted.

| Area | Models |
| --- | --- |
| Users and sports | `User`, `Sport`, `UserSport` |
| Games | `Game`, `GameParticipant`, `JoinRequest` |
| Friends and follows | `Friendship`, `UserFollow` |
| Clubs | `Club`, `ClubMember`, `ClubFollow`, `ClubSport`, `ClubTag`, `ClubRule`, `ClubInvite` |
| Posts | `Post`, `PostMedia`, `PostCustomViewer`, `PostTag`, `PostLike`, `PostComment`, `PostShare` |
| Reels | `Reel`, `ReelLike`, `ReelComment`, `ReelView`, `ReelShare`, `ReelCustomViewer` |
| Stories | `Story`, `StoryView`, `StoryCustomViewer`, `MusicTrack` |
| Notifications | `Notification` |
| Badges | `Badge`, `UserBadge` |
| Chat | `Conversation`, `ConversationParticipant`, `Message`, `MessageRequest` |
| Live | `LiveStream`, `LiveViewer` |
| Moderation | `Report` |

Design rules:

- `User.coverImageUrl` holds the profile cover URL (the image itself lives in external storage). `User.bio` is limited to 160 characters by `User_bio_length_check`.
- `20260930190000_user_profile_constraints` adds CHECK constraints that match the profile DTOs, so data written outside the API follows the same rules: first and last names 1–50 non-blank characters (`User_names_check`), city null or 1–100 (`User_city_check`), profile and cover image URLs starting with `http://` or `https://` and up to 2048 characters (`User_image_urls_check`), and `UserSport.position` null or 1–40 non-blank characters (`UserSport_position_check`). It changes no columns or data.
- `UserSport` (`userId`, `sportId`, `skillLevel`, `position`, `createdAt`, `updatedAt`) is a sport on a user's profile: unique per user and sport, with `skillLevel` from the `SkillLevel` enum and an optional free-text position.
- Primary keys are UUIDs. Users are deactivated with `isActive`, not deleted, and relations to content a user owns use `Restrict` so a delete cannot silently wipe posts, reels, games, or messages. Likes, views, and media rows cascade with their parent post, reel, or story. Notification and report references use `SetNull`, so they survive when the target is removed.
- The game host is `Game.hostId` and is not a `GameParticipant`. Creating a game does not put the host on the roster. They occupy a slot only if they also have an ACTIVE `GameParticipant` row. `LEFT` and `REMOVED` do not count. (The database guards still count `COMPLETED` rows as occupying, which only matters for games that are already over.)
- There is no stored `players` counter on `Game`. Cards and Game Details show `currentPlayers / requiredPlayers`, where `currentPlayers` is counted from ACTIVE participant rows. Remaining slots are `requiredPlayers - currentPlayers`. The frontend never invents this number; it displays the value the API (or today's mock, which uses the same formula) returns.
- A recruiting game stays `OPEN` while occupying players < `requiredPlayers`, and becomes `FULL` at capacity. A trigger (`20260930120000_game_recruiting_status`) keeps `OPEN`/`FULL` in sync. It does not change `ACTIVE`, `COMPLETED`, or `CANCELLED` games.
- Capacity is enforced in the database (`20260930100000_game_capacity_guard`): a 12-slot game can never hold a 13th occupying player, even if two accept-join transactions race. The join request service also accepts inside a transaction that locks the `Game` row, counts ACTIVE participants, and rejects the extra request. `GameParticipant` and `JoinRequest` are unique per game and user; leaving, rejoining, or re-requesting updates the existing row, which also stops request spam.
- Every game has a required venue name (`locationName`, never blank, `Game_location_name_check`). `20260930220000_game_creation` made `latitude`/`longitude` optional until a map provider exists (both or neither, `Game_coordinates_pair_check`; only games with coordinates can become map markers), added CHECKs that repeat the Create Game limits (title 3–80, description up to 500, location up to 120, at most 100 required players, start and end times on `gameDate`), and made the game status and capacity triggers stamp `Game.updatedAt` in UTC. Together with `sportId`, `hostId`, optional `clubId`, `gameDate`, `startTime`, `endTime`, `requiredPlayers`, and `status`, that is everything Create Game needs.
- Post and game locations are separate ideas. `Post.locationName`/`latitude`/`longitude` is an optional place the author picked for social content; `Post_location_check` requires all three together (or none), a non-blank name up to 120 characters, and coordinates in range, and `(latitude, longitude)` is indexed. A game's location is where the activity happens. Neither is ever a user's home or live position, and nothing tracks location in the background.
- `PostTag` (`postId`, `userId`, `createdAt`) records people tagged in a post: unique per post and user, cascading with either, indexed by `(userId, createdAt)` for a future "posts you're tagged in", and a trigger rejects tagging the post's author. Tagged users can later be notified; no notification is sent yet.
- Enum names: `UserRole` (USER, ADMIN), `ParticipantStatus`, `JoinRequestStatus`, `FriendshipStatus`, `PostVisibility`, `ReelVisibility`, `MediaType` (post media), `StoryMediaType`, `NotificationType`, `MessageType` (TEXT, IMAGE, VIDEO, FILE), `MessageRequestStatus`, `LiveStreamStatus` (SCHEDULED, LIVE, ENDED, CANCELLED), `ReportReason`, `ReportStatus`, plus `GameStatus`, `SkillLevel`, `ConversationType`, `BadgeCategory`, `BadgeRequirement`.
- `Report` points at comments through `postCommentId` or `reelCommentId` rather than one generic `commentId`, so each reference is a real foreign key.
- Message requests should be rate-limited in the service layer; the schema only guarantees one request per pair.
- `Friendship.pairKey` and `MessageRequest.pairKey` hold the two user ids sorted and joined with `:`, so a pair of users has at most one friendship and one message request in either direction. A rejected or blocked message request stays on record. Direct conversations use `Conversation.directKey` the same way; game chats use a unique `Conversation.gameId`.
- `PostVisibility` is `PUBLIC`, `FRIENDS`, `CUSTOM`, or `ONLY_ME` (`Post.visibility` is indexed). `PostCustomViewer` (`postId`, `userId`, `createdAt`) lists who may see a `CUSTOM` post: unique per post and user, both columns indexed, cascading with the post or user, and a trigger rejects adding the post's own author.
- `Friendship.blockedById` records which of the two users blocked the other. A CHECK keeps it set exactly when `status` is `BLOCKED` and requires it to be the requester or the receiver.
- `UserFollow` (`followerId`, `followingId`, `createdAt`) is a one-way follow, separate from `Friendship`. Each pair is unique, both columns are indexed, and a CHECK constraint blocks following yourself. A new follow can create a `NEW_FOLLOWER` notification. Followers and following counts are counted from these rows, never stored.
- A `Club` has an owner (`ownerId`, `Restrict`), a unique `slug` (lowercase words joined by hyphens, 3–50 characters, enforced by a CHECK), an optional sport and location, `isPublic`, and `isActive`. Disabling a club (`isActive = false`) hides it without deleting its history.
- `ClubMember` has a `role` (OWNER, ADMIN, MODERATOR, MEMBER) and a `status` (PENDING, ACTIVE, REMOVED, BANNED), unique per club and user. The owner is represented by a trigger, not by application code: creating a club inserts the owner as ACTIVE OWNER, and changing `Club.ownerId` demotes the previous owner to ADMIN and promotes the new one. A partial unique index allows one OWNER per club, and a guard trigger stops anyone else from holding OWNER and stops the owner's row from being demoted, banned, or deleted.
- `Post.clubId`, `Game.clubId`, and `Reel.clubId` are optional. A trigger only accepts them when the author (or game host) is an ACTIVE member of an active club. The club never replaces the host: `Game.hostId` is still the organizer. Deleting a club sets these columns to null and keeps the content. `Post.isAnnouncement` marks club announcements, and `Post.sportId` lets posts be filtered by sport. `Report.clubId` lets a club itself be reported.
- `ClubFollow` is a one-way follow of a club, unique per club and user. Club membership, club follows, `Friendship`, and `UserFollow` are four separate relationships; none creates another.
- Role permissions live in `server/src/clubs/club-permissions.ts`: OWNER manages the club, admins, and members, and can disable it; ADMIN manages posts, games, members, and content; MODERATOR moderates content, reports, and comments; MEMBER views, participates, joins and hosts club games, posts, and comments. A disabled club allows nothing, and a pending or removed member can only view a public club. The full moderation system (removals, bans, report review screens) is not built.
- `ConversationType` is `DIRECT`, `GAME`, or `CLUB`. `Conversation_context_check` keeps each type's context: DIRECT has no game or club (and at most two participants, enforced by a trigger), GAME has an optional `gameId` and no club, and CLUB has a `clubId` and nothing else. `Conversation.clubId` is unique, so a club has exactly one official chat. The `Club_create_chat` trigger (`20260930200100_club_group_chat`) creates it in the same transaction as the club, so a club insert fails if its chat cannot be created, and existing clubs were backfilled. A conversation's type and club never change (`Conversation_guard_context`).
- Club chat access comes only from `ClubMember`: any role with status ACTIVE in an active club. PENDING, REMOVED, BANNED, and non-members have no access, and leaving or being removed ends access at once because nothing is copied into the conversation. `ConversationParticipant` rows in a club chat only hold read state (`lastReadAt`), and a trigger accepts them only for ACTIVE members. `Message_guard_sender` rejects club messages from anyone who is not an ACTIVE member of an active club, and direct messages from non-participants. A disabled club's chat keeps its history and accepts no new messages. Deleting a club row removes an empty chat, but messages (`Restrict`) block the delete, so history is never silently removed.
- Club chat permissions (`clubChatPermissions` in `club-permissions.ts`): OWNER and ADMIN manage the chat, MODERATOR and up moderate it, and every ACTIVE member reads and sends. Moderation actions, pinned messages, announcements, images, files, polls, event announcements, mentions, message deletion, and push notifications are not built; `MessageType`, `Message.deletedAt`, and the permission flags leave room for them.
- `20260930200200_club_trigger_utc_timestamps` makes the club triggers write UTC like Prisma does (on a database whose time zone is not UTC, `CURRENT_TIMESTAMP` wrote local time into UTC columns) and moved the affected owner `joinedAt` and club chat timestamps back to UTC. The game status and capacity triggers were moved to UTC by `20260930220000_game_creation`.
- `20260930210000_club_creation_system` adds the club creation fields: `about`, `country`, `barangay`, `homeCourt`, `maxMembers` (required), `membershipType` (`ClubMembershipType` OPEN, APPROVAL_REQUIRED, INVITE_ONLY), the informational schedule (`activityDay`, `activityStartTime`, `activityEndTime`, `trainingSchedule`; it never creates games), and contact (`contactEmail`, `websiteUrl`, `facebookUrl`, `instagramUrl`, `tiktokUrl`). Existing clubs were given `maxMembers = max(50, active members)`, and private ones became APPROVAL_REQUIRED. `ClubSport` (additional sports, unique per club and sport), `ClubTag` (lowercase letters and numbers, unique per club), `ClubRule` (ordered by `position`), and `ClubInvite` (one per club and invitee, PENDING / ACCEPTED / DECLINED / REVOKED, never yourself) hang off the club. CHECK constraints repeat the DTO limits.
- Club capacity is `maxMembers` (1 to `CLUB_MAX_MEMBERS_LIMIT`, default 1000; the database allows up to 100000) and is separate from `Game.requiredPlayers`. The member count, available slots, and FULL are always counted from ACTIVE `ClubMember` rows, never stored. The owner is the first ACTIVE member, so a new club is 1 / N. PENDING requests and invites take no slot. The service locks the `Club` row (`SELECT ... FOR UPDATE`) before every join and approval, recounts, and answers 409 "Club is currently full."; the `ClubMember_capacity_guard` trigger makes the same check in the database, so two concurrent approvals at 49 / 50 give one success and one 409, never 51 / 50. `Club_max_members_guard` rejects lowering `maxMembers` below the ACTIVE count, and members are never removed automatically.
- Creating a club runs in one transaction: the club with its sports, tags, and rules, the owner's OWNER/ACTIVE membership (trigger), and the one CLUB chat (trigger). The service checks both before committing, so any failure rolls everything back. Join rules are enforced on the server: OPEN joins at once while there is room, APPROVAL_REQUIRED creates a PENDING request, and INVITE_ONLY needs a pending invite (an invite also lets someone skip approval). Only the owner edits club settings; admins manage requests, invites, and members.
- Discover's All / Friends / Clubs filters are queries over existing rows (`Friendship`, `UserFollow`, `ClubMember`, `ClubFollow`, and the club, sport, and author columns on posts, games, and reels). There is no feed table.
- `PostShare` and `ReelShare` record who shared what and when. `ReelView` keeps one row per viewer and reel with `watchSeconds` (≥ 0), `completed`, and `viewedAt`; `Reel.viewCount` stays as a cached total for sorting. Together with likes, comments, follows, and `Reel.sportId`, these rows are the inputs the future For You recommendations will use. No recommendation logic exists yet.
- The Home feed is assembled from existing rows: posts, games (`Game.createdAt`, indexed), reels, and activity derived from `GameParticipant.completedAt`, `JoinRequest`/`GameParticipant` joins, and `UserBadge.unlockedAt`. There is no separate feed table.
- CHECK constraints in the migration block self-friending, messaging yourself, non-positive player counts and badge targets, end times before start times, out-of-range coordinates, and stories that expire before they are created.
- A story is active while `expiresAt > now`. Expired rows are kept.
- Story music is optional (photo or video, with or without music). `Story` stores `musicTrackId`, `musicTitle`, `musicArtist`, `musicStartTime`, and `musicDuration`. Times are whole seconds: start 18 and duration 15 play 0:18–0:33. Title and artist are copied when the story is posted, so the story still displays them if the track is removed (`musicTrackId` becomes null). CHECK constraints keep the segment all-or-nothing, with start ≥ 0 and duration > 0, and require a title whenever music is attached.
- `MusicTrack` is a catalog reference to a licensed provider (`provider` + `providerTrackId`, unique together), with title, artist, album, artwork, a provider `previewUrl`, `durationSeconds`, and `isActive`. It is empty until a music provider is integrated. Audio files are never stored in PostgreSQL or downloaded; playback goes through the provider.
- Planned Add Story flow: Photo / Video → Add Music → search → select track → select segment → preview → post. Only the viewer's music tag exists today.
- Stories and reels store media references and metadata in PostgreSQL and uploaded files in persistent private directories. Post media and live streams still await upload/streaming providers.
- Badge progress is measured against a `BadgeRequirement` (the activity stat) and a `target`, and computed on the server.

Seeding: `npx prisma db seed` (from `server/`) upserts the 10 sports and 13 badges from `prisma/seed-data.ts`. It is safe to run again.

## API versioning

Public routes use the `/api/v1` prefix. A later version can be introduced as `/api/v2` without changing the current contract.

Endpoints today:

```http
GET  /api/v1/health
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me                        (Bearer token)
GET  /api/v1/users/:username/relationship   (Bearer token)
POST /api/v1/posts                          (Bearer token)
GET  /api/v1/posts                          (Bearer token, Home feed; ?limit=&cursor=)
GET  /api/v1/posts/:postId                  (Bearer token)
PATCH /api/v1/posts/:postId                 (Bearer token, author only; caption, sport, location)
DELETE /api/v1/posts/:postId                (Bearer token, author only; soft delete)
PATCH /api/v1/posts/:postId/visibility      (Bearer token, author only)
PUT  /api/v1/posts/:postId/tags             (Bearer token, author only)
GET  /api/v1/users/:username/posts          (Bearer token)
GET  /api/v1/sports                         (Bearer token, active sports only)
GET  /api/v1/sports/:id                     (Bearer token)
GET  /api/v1/users/me/sports                (Bearer token)
POST /api/v1/users/me/sports                (Bearer token)
PATCH /api/v1/users/me/sports/:sportId      (Bearer token)
DELETE /api/v1/users/me/sports/:sportId     (Bearer token)
GET  /api/v1/profiles/me                    (Bearer token)
PATCH /api/v1/profiles/me                   (Bearer token)
GET  /api/v1/profiles/me/sports             (Bearer token, alias of /users/me/sports)
POST /api/v1/profiles/me/sports             (Bearer token, alias)
PATCH /api/v1/profiles/me/sports/:sportId   (Bearer token, alias)
DELETE /api/v1/profiles/me/sports/:sportId  (Bearer token, alias)
GET  /api/v1/profiles/:username             (Bearer token)
POST /api/v1/clubs                          (Bearer token, the caller becomes the owner)
GET  /api/v1/clubs/mine                     (Bearer token, owned, joined, requested, or followed)
GET  /api/v1/clubs/:clubId                  (Bearer token)
PATCH /api/v1/clubs/:clubId                 (Bearer token, owner only)
POST /api/v1/clubs/:clubId/join             (Bearer token)
POST /api/v1/clubs/:clubId/leave            (Bearer token, not the owner)
GET  /api/v1/clubs/:clubId/members          (Bearer token; private clubs: ACTIVE members)
GET  /api/v1/clubs/:clubId/members/requests (Bearer token, owner and admins)
POST /api/v1/clubs/:clubId/members/:userId/approve   (owner and admins)
POST /api/v1/clubs/:clubId/members/:userId/reject    (owner and admins)
POST /api/v1/clubs/:clubId/members/:userId/remove    (owner and admins)
GET  /api/v1/clubs/:clubId/invites          (Bearer token, owner and admins)
POST /api/v1/clubs/:clubId/invites          (Bearer token, owner and admins)
GET  /api/v1/chat/clubs                     (Bearer token, the viewer's club chats)
GET  /api/v1/clubs/:clubId/chat             (Bearer token, ACTIVE members)
GET  /api/v1/clubs/:clubId/chat/messages    (Bearer token, ACTIVE members; ?before=&limit=)
POST /api/v1/clubs/:clubId/chat/messages    (Bearer token, ACTIVE members)
POST /api/v1/games                          (Bearer token, the caller becomes the host)
GET  /api/v1/games                          (Bearer token; ?sportId=&status=&gameDate=&limit=&offset=)
GET  /api/v1/games/mine                     (Bearer token, games you host)
GET  /api/v1/games/discover                 (Bearer token, map/list discovery of real games)
GET  /api/v1/games/playing                  (Bearer token, games where you are an ACTIVE player)
GET  /api/v1/games/:id                      (Bearer token)
GET  /api/v1/games/:gameId/players          (Bearer token, roster of a visible game)
GET  /api/v1/games/:gameId/players/me       (Bearer token, your participation status)
PATCH /api/v1/games/:gameId/players/me/leave          (Bearer token, ACTIVE players)
PATCH /api/v1/games/:gameId/players/:userId/remove    (Bearer token, host only)
PATCH /api/v1/games/:id                     (Bearer token, host only)
PATCH /api/v1/games/:id/cancel              (Bearer token, host only; never deletes)
```

Every club chat request checks, in order: the user (JWT), that the club exists (404), that it is active (403), that the user has an ACTIVE `ClubMember` row (403, with a separate message for a pending request), and that the conversation is the club's own CLUB chat. The club id comes only from the path and the sender only from the JWT; extra body fields such as `senderId`, `conversationId`, or `clubId` are rejected with 400. There is no endpoint that creates a group chat or adds people to one. Reading the first page of messages marks the chat read; unread counts are messages from others since the viewer last read the chat, or since they joined the club.

## Planned modules

These server modules are the intended boundaries for later phases. They are not created yet.

`friends`, `comments`, `likes`, `notifications`, `chat`, `live`, `maps`, `uploads`, `reports`, `admin`.

## Future infrastructure

The following systems are expected later and are intentionally not installed:

- Redis for cache, sessions, or queues
- Object storage for photos and video
- Video processing for highlights and reels
- Video streaming and live streaming
- Push notifications
- Maps for game locations

Each one should be added behind its own module when that phase starts, with configuration coming from environment variables.

### Story photo/video uploads

- Add Story uses one device picker for JPEG, PNG, WebP and GIF photos (up to 10 MB) or MP4/WebM video (up to 50 MB). Type is inferred from the file. Preview, remove/change, progress and cancellation are supported; caption and audience controls remain.
- Authenticated multipart POST /api/v1/stories/upload accepts media, mediaType, visibility, optional caption and customViewerIds (JSON array). The server validates metadata, size and MIME/container headers, generates the filename and sets the author and 24-hour expiry. It does not transcode or deeply inspect codecs.
- STORY_UPLOAD_DIR defaults to uploads/stories relative to the API working directory. Preserve and back up this directory for deployment. Migration 20261010060000_story_media_uploads permits generated upload references; existing external URL API calls remain supported.
- API responses replace uploaded references with scoped 12-hour media URLs. GET /api/v1/stories/:id/media rechecks the active viewer, current audience, blocks, expiration and deletion on every request. HTTP ranges support video seeking. Expired files remain available to the author through their archive. Deleting a story removes its file; failed creation also cleans up the upload.
- Stories and reels share private file storage, range serving, multipart transport and picker styles. Account changes and leaving the Story form abort the upload and release the local preview; old responses cannot modify another account's stories.

### Post location picker

- Create Post and Edit Post share LocationPickerModal. The venue list still filters by name/city. Previously confirmed points outside the catalog are restored directly, without requiring a venue ID.
- Use current location requests one high-accuracy browser reading only after a tap, with a 10-second deadline and coordinates rounded to six decimals. Permission denial, timeout, unavailable devices and unsupported browsers show inline errors; map/list selection remains available. Discovery keeps its existing three-decimal reading behavior.
- Select on map mounts LocationMapPicker with Leaflet 1.9.4 and OpenStreetMap street tiles. Tap the map, drag the pin or pan with the keyboard and choose Use map center. Zoom controls work on desktop and mobile. The browsing center is never silently selected. The default tile URL can be changed with VITE_LOCATION_TILE_URL to a compatible OSM tile server; attribution stays visible.
- A selected name can be edited (up to 120 characters). Confirm emits the existing location object for POST/PATCH /posts. Closing the picker cancels the draft; a late GPS response cannot overwrite a venue/map selection, a reopened picker or another account. The map and resize observer are released on close.
- Browser geolocation requires localhost or HTTPS plus the user's permission. Street tiles require a network connection. No reverse geocoder, background tracking or location history is added.
- Automated browser checks intercept tile requests with local test responses. Native GPS/permission overrides, map clicks, pin dragging, mobile sizing, exact saved post coordinates and canceled/reopened state were verified without downloading tiles from the public service.
- References: [Leaflet source/API](https://leafletjs.com/reference.html), [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
