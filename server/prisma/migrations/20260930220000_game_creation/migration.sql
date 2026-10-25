-- Game creation (Prompt 8). The Game table was empty when this was written; no data changes.

-- Coordinates are optional until a map provider exists. A pin needs both.
ALTER TABLE "Game" ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "Game" ADD CONSTRAINT "Game_coordinates_pair_check"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

-- Same limits as CreateGameDto, so data written outside the API follows them too.
ALTER TABLE "Game" ADD CONSTRAINT "Game_title_check"
  CHECK (char_length(btrim("title")) BETWEEN 3 AND 80);
ALTER TABLE "Game" ADD CONSTRAINT "Game_description_check"
  CHECK ("description" IS NULL OR char_length("description") BETWEEN 1 AND 500);
ALTER TABLE "Game" ADD CONSTRAINT "Game_location_name_length_check"
  CHECK (char_length("locationName") <= 120);
ALTER TABLE "Game" ADD CONSTRAINT "Game_required_players_max_check"
  CHECK ("requiredPlayers" <= 100);

-- startTime and endTime are wall-clock times on gameDate (no overnight games).
ALTER TABLE "Game" ADD CONSTRAINT "Game_times_on_game_date_check"
  CHECK (
    "startTime"::date = "gameDate" AND
    ("endTime" IS NULL OR "endTime"::date = "gameDate")
  );

-- The game triggers wrote updatedAt with CURRENT_TIMESTAMP, which lands in the database's
-- local zone. Same logic, UTC timestamps (the Prisma convention for "updatedAt").
CREATE OR REPLACE FUNCTION "gora_refresh_recruiting_status"(target uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  capacity integer;
  occupied integer;
  current_status "GameStatus";
BEGIN
  SELECT "requiredPlayers", "status"
  INTO capacity, current_status
  FROM "Game"
  WHERE "id" = target
  FOR UPDATE;

  IF NOT FOUND OR current_status NOT IN ('OPEN', 'FULL') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO occupied
  FROM "GameParticipant"
  WHERE "gameId" = target
    AND "status" IN ('ACTIVE', 'COMPLETED');

  UPDATE "Game"
  SET
    "status" = CASE
      WHEN occupied >= capacity THEN 'FULL'::"GameStatus"
      ELSE 'OPEN'::"GameStatus"
    END,
    "updatedAt" = timezone('UTC', now())
  WHERE "id" = target
    AND "status" IN ('OPEN', 'FULL');
END;
$$;

CREATE OR REPLACE FUNCTION "gora_enforce_game_capacity"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  capacity integer;
  occupied integer;
BEGIN
  IF NEW."status" NOT IN ('ACTIVE', 'COMPLETED') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."gameId" = NEW."gameId" AND OLD."status" IN ('ACTIVE', 'COMPLETED') THEN
    RETURN NEW;
  END IF;

  -- Updating the game row serializes concurrent joins for the same game under
  -- READ COMMITTED and makes REPEATABLE READ / SERIALIZABLE transactions fail
  -- with a serialization error instead of overfilling.
  UPDATE "Game" SET "updatedAt" = timezone('UTC', now())
  WHERE "id" = NEW."gameId"
  RETURNING "requiredPlayers" INTO capacity;

  SELECT count(*) INTO occupied
  FROM "GameParticipant"
  WHERE "gameId" = NEW."gameId"
    AND "status" IN ('ACTIVE', 'COMPLETED')
    AND "id" IS DISTINCT FROM NEW."id";

  IF occupied >= capacity THEN
    RAISE EXCEPTION 'Game % is full (% of % players)', NEW."gameId", occupied, capacity
      USING ERRCODE = 'check_violation', CONSTRAINT = 'GameParticipant_capacity_check';
  END IF;

  RETURN NEW;
END;
$$;
