# Hosted and joined games

My Games separates Hosted Games from Joined Games, each with upcoming games and game history.

Hosts can open Edit Game, cancel a game, manage requests, and change player approval directly from a hosted card. The Create/Edit Game form also includes the approval setting:

- **Manual Accept** is the default. The host accepts or declines each request.
- **Auto Accept** confirms new requests immediately while the game is open, has not started, and has an available player slot.

Changing the mode applies to new requests. Existing pending requests remain available for manual review. Completed and cancelled games cannot be edited. Cancelled games and cancelled joins remain in history.

Automatic acceptance saves the accepted request and active participation in one transaction. It locks the game row and uses the existing capacity guards so concurrent joins cannot overfill a game. Rejoining reuses the user's request and participation rows.

## Database setup

Before starting the updated API against an existing database, apply `20261030100000_game_auto_accept`. From the `server` directory:

```powershell
npx prisma migrate deploy
npm run build
```

The migration adds `Game.autoAccept` with a default of `false`, preserving manual approval for existing games.
