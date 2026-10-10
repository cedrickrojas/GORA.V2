# Sport-Based Live Activity Map (game discovery)

Status: implemented in Prompt 11 with the built-in map preview. Real GORA games come from `GET /api/v1/games/discover`, filtered by sport, date, status, and distance on the server. No map provider package, map API key, or external API is required; a Google Maps, Mapbox, or OpenStreetMap adapter can be added later without changing the discovery rules. Live tracking, real-time updates, a venue database, routing, and PostGIS are not implemented.

## Concept

A user picks a sport, a date, and a distance, and sees the matching GORA games on a map and in a list. Each marker is a game created on GORA; a marker is never a real-world court on its own.

```text
Discover -> Nearby GORA Games -> [Sport] [Date] [Distance] -> [Map] [List] -> tap 🏐 -> preview -> View Game / Request to Join
Search -> Volleyball -> Today -> Map -> "Open the Volleyball map" -> Discover (Volleyball, Today, Map)
Game Details -> 📍 place / [View on Map] -> location view -> Selected game + nearby GORA games
```

## Endpoint

```http
GET /api/v1/games/discover?sportId=<uuid>&date=today&latitude=14.55&longitude=121.05&distanceKm=10&status=OPEN&limit=50
```

Signed-in users only (JWT). Every parameter is optional.

| Parameter | Rules |
| --- | --- |
| `sportId` | Sport UUID (filter by id, never by name). Not a UUID: 400. Unknown or retired sport: 404. |
| `date` | `today`, `tomorrow`, `this-week` (today + 6 days), or one `YYYY-MM-DD` date. Omitted: every date from today on. Presets are decided on the game clock (`GAME_TIMEZONE`, default Asia/Manila). |
| `latitude`, `longitude` | Together or not at all (400). Latitude -90..90, longitude -180..180; text, blanks, and `12,5` are 400, never 0. Used for this request only and never stored. |
| `distanceKm` | 0.1..100. Needs `latitude`/`longitude` (400). Omitted = Any distance. The app offers 1, 5, 10, 25, 50, 100 km, Any. |
| `status` | One of `OPEN`, `FULL`, `ACTIVE`, `COMPLETED`. Default `OPEN`/`FULL`/`ACTIVE`. `CANCELLED` is never discoverable (400). |
| `limit` | 1..100, default 50. |

Response:

```json
{
  "games": [
    {
      "id": "…", "title": "Sunset Volleyball",
      "sport": { "id": "…", "name": "Volleyball", "iconUrl": null },
      "host": { "id": "…", "username": "juan", "firstName": "Juan", "lastName": "Cruz", "displayName": "Juan Cruz", "profileImageUrl": null },
      "club": null,
      "gameDate": "2026-10-02", "startTime": "18:00", "endTime": "20:00",
      "locationName": "BGC Court", "latitude": 14.5618, "longitude": 121.05, "distanceKm": 1.2,
      "currentPlayers": 8, "requiredPlayers": 12, "remainingSlots": 4, "status": "OPEN",
      "isHost": false, "isPlayer": false, "myJoinRequestStatus": null
    }
  ],
  "dateFrom": "2026-09-30", "dateTo": null, "distanceKm": null
}
```

- Only games the viewer may see (`visibleGamesWhere`: blocks, inactive hosts, and private clubs hide games). The host summary never includes email, password hash, date of birth, role, or tokens.
- `currentPlayers` is the count of ACTIVE `GameParticipant` rows, the same rule as Game Details ("PLAYERS 8/12").
- Discovery only reads; it never changes a game's status.

## Server design

| Piece | Where |
| --- | --- |
| Route | `GamesController` `@Get('discover')`, declared before `:gameId` |
| Query DTO | `server/src/games/dto/discover-games.dto.ts` (`DiscoverGamesQueryDto`) |
| Service | `server/src/games/game-discovery.service.ts` (`GameDiscoveryService`), separate from game CRUD |
| Distance | `server/src/games/geo-distance.ts`: Haversine km, a bounding box for the index prefilter, rounding to 2 decimals |
| Types | `DiscoveredGameView`, `GameDiscoveryResult` in `server/src/games/game.types.ts` |
| Tests | `server/src/games/geo-distance.spec.ts`, `server/test/game-discovery.e2e-spec.ts` (16 cases) |

Query flow:

1. Validate the query (DTO), check the sport (404), check center/radius pairing (400).
2. Prisma query: visible games, date range, statuses, sport id, and, with a radius, the bounding box on `(latitude, longitude)` (games without coordinates never match).
3. With a center: measure each game with Haversine, drop those outside the radius, sort nearest first (ties keep soonest first), cap at `limit`. At most 500 candidates are measured per request. Without a radius (Any), games without coordinates follow the located ones with `distanceKm: null`.
4. Without a center: soonest first (`gameDate`, `startTime`, `createdAt`, `id`).

PostGIS (a geography column with a GiST index and `ST_DWithin`/`ST_Distance`) can replace `geo-distance.ts` later; the endpoint and response stay the same.

## Which games appear

- Real GORA games only; never venues, never invented games, never demo data.
- Sport by id; date as above; statuses OPEN/FULL/ACTIVE by default (COMPLETED on request, CANCELLED never).
- A game with only a `locationName` stays valid: it is listed without a distance, but never appears in radius results and never gets a marker (no 0,0 fallback).
- Several games, and several sports, can share one place: games closer than 100 m share one marker that shows each sport (🏐 🏀) and a count; the preview lets you switch between them.

## Client design

| Piece | Where |
| --- | --- |
| API call | `discoverGames` in `mobile/src/services/games-api.service.ts`; types in `mobile/src/types/discovery.ts` |
| Store | `mobile/src/stores/discovery.ts`: games, date, view mode, selected game, device location, loading, error. Sport and distance are the header filter (`filters` store), so Home, Search, and Discover share them. Actions: `fetchNearbyGames`, `fetchGamesBySport`, `fetchGamesByDate`, `fetchGamesByDistance`, `selectGame`, `clearFilters`, `locate`, `initLocation`, `discoverAround` (location view), `applyJoinRequest`. |
| Query building | `buildDiscoveryQuery`, `toDiscoveryDateParam`, `DISCOVERY_DATE_FILTERS` in `mobile/src/utils/map-discovery.ts` |
| Location | `mobile/src/services/location.service.ts`: `isLocationAvailable`, `checkPermission`, `requestPermission`, `getCurrentLocation` (rounded to about 110 m; answers granted, denied, unavailable, timeout, unsupported, never throws) |
| Map provider | `mobile/src/services/map-provider.ts`: `resolveMapProvider` reads `VITE_MAP_PROVIDER` / `VITE_MAP_API_KEY`, and falls back to the built-in preview when unset, missing a key, or not connected yet. `MapCanvasProps` is the adapter contract. |
| Map | `mobile/src/components/map/GameDiscoveryMap.vue` (props: games, center, radiusKm, selectedGameId, loading, error; events: select, view, join), `PlaceholderMapCanvas.vue` (the built-in provider), `DiscoveredGameCard.vue` (marker preview and list row) |
| Grouping | `groupGamesByPlace`, `gamePoint`, `placeMarkers`, `projectToPreview` in `mobile/src/utils/location-map.ts` |
| Text | `mobile/src/utils/discovery-display.ts` ("Today • 6:00 PM", "1.2 km away", "Players: 8/12", Request to Join state) |
| Discover | `mobile/src/components/discover/NearbyGamesSection.vue` in the Discover All tab ("Nearby GORA Games") |
| Location view | `mobile/src/views/LocationMapPage.vue`, `/map/:lat/:lng?name=&game=`: real games within 2 km, the game you came from always shown as "Selected game" |
| Game Details | `ServerGameDetails.vue`: "📍 Location Name"; with coordinates, the name and a [View on Map] button open the location view centered on the game; without coordinates only the name is shown |
| Search handoff | `SportPage.vue` Map view: "Open the <Sport> map" opens `/discover?sport=<name>&date=<filter>&view=map` |
| Tests | `mobile/tests/unit/game-discovery.spec.ts`, `mobile/tests/unit/post-location.spec.ts` |

## Marker preview

```text
🏐 Volleyball  OPEN
Sunset Volleyball
🕕 Today • 6:00 PM
📍 BGC Court
1.2 km away
👥 Players: 8/12
Hosted by @juan
[View Game]  [Request to Join]
```

- View Game opens Game Details (`/games/:gameId`).
- Request to Join opens the existing Join Request modal and sends `POST /games/:gameId/join-requests`; the player becomes a participant only after the host accepts. The button follows the Game Details rules: Request Pending, You're playing, You're hosting, Request declined, or the closed reason (Game is full, Game in progress, …).

## Location and privacy

- The device location is asked for only when the user taps "Use my location" (or is reused when the browser already granted it). A denial is remembered for the session; the app never asks again on its own.
- It stays in memory, is rounded to about 110 m, and is sent only as the center of a discovery search. It is never saved (no User column, no location table, no local storage), never shown to others, and never logged by the app.
- On denial the app shows "Location access is unavailable. You can still browse GORA games by sport and date." Sport, date, and list browsing keep working; distance filters then show games at any distance and say so.
- Game coordinates are the venue (court, field, gym), never a player's home. Profiles show a city at most.

## Post location vs game location

- A post location (`Post.locationName`, `latitude`, `longitude`) is optional social context the author explicitly picked. All three are set together or none are. A post location never creates a marker; tapping it opens the location view with the GORA games near that place.
- A game location is where the activity takes place: `locationName` is required, coordinates are optional (both or neither).

## Database

No migration was needed. `Game` already has `sportId`, `gameDate`, `startTime`, `endTime`, `locationName`, `latitude`, `longitude`, and `status`, a CHECK constraint on coordinate ranges, and the indexes `(sportId, gameDate, status)` and `(latitude, longitude)` the discovery query uses.

## Not implemented (later prompts)

- A real map provider adapter (Google Maps, Mapbox, or OpenStreetMap tiles). Set `VITE_MAP_PROVIDER` / `VITE_MAP_API_KEY` and add a canvas component implementing `MapCanvasProps` to `CANVASES` in `GameDiscoveryMap.vue`.
- Place search, picking a point on the map, and "use current location" in Create Game / Create Post.
- Real-time map updates (WebSocket), PostGIS, live location sharing, background tracking, routing, and a venue database.
