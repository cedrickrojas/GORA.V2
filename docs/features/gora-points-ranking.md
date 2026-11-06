# GORA Points Ranking

Discover's **All** feed begins with GORA Points Ranking. It reads the existing
`User.goraPoints` balance, shows ten players at a time, and links each player to
their profile. The signed-in player's own rank stays visible even outside the
loaded page. Refresh and re-entering Discover fetch current scores.

- All-time scores, independent of sport and distance filters.
- Active regular players only; administrators and blocked accounts in either
  direction are excluded. Rankings are calculated among visible players.
- Equal scores share a competition rank (1, 1, 3). Username, then ID, stabilizes
  ordering within a tie. Zero and negative balances remain eligible.
- Existing point awards and deductions are unchanged. Browsing never awards points.

## API

`GET /api/v1/gora-points/ranking?limit=10&offset=0` requires a valid JWT.
`limit` is an integer from 1 to 50; `offset` is an integer from 0 to 100000.
Unknown query fields are rejected. The response contains `players`,
`currentPlayer` (or null), `total`, `nextOffset`, and `hasMore`.

Each player has `id`, `username`, `displayName`, `avatarUrl`, `goraPoints`, and
`rank`. No email, birth date, credentials or other private fields are returned.
One parameterized PostgreSQL statement computes the ranking, page and own rank
from the same snapshot. The response is private and cannot be cached.

## Verification

From `server`: `npm run test:e2e -- --runInBand --testPathPatterns=gora-ranking`

From `mobile`: `npm run test:unit -- tests/unit/gora-ranking.spec.ts`

The API tests use temporary accounts in the configured development database and
remove them afterward. They cover real SQL sorting, tied ranks, pagination,
blocked/inactive/admin exclusions, private fields, input validation and fresh scores.
