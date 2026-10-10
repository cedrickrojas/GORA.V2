-- Capacity guard: a game can never hold more occupying players than
-- Game.requiredPlayers, even if two join requests are accepted at once.
-- ACTIVE and COMPLETED participants occupy a slot; LEFT and REMOVED do not.
-- The host is not counted unless they have their own GameParticipant row.

CREATE FUNCTION "gora_enforce_game_capacity"() RETURNS trigger
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
  UPDATE "Game" SET "updatedAt" = CURRENT_TIMESTAMP
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

CREATE TRIGGER "GameParticipant_capacity_guard"
BEFORE INSERT OR UPDATE OF "status", "gameId" ON "GameParticipant"
FOR EACH ROW EXECUTE FUNCTION "gora_enforce_game_capacity"();

-- requiredPlayers cannot be lowered below the players already in the game.
CREATE FUNCTION "gora_prevent_capacity_below_roster"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  occupied integer;
BEGIN
  SELECT count(*) INTO occupied
  FROM "GameParticipant"
  WHERE "gameId" = NEW."id"
    AND "status" IN ('ACTIVE', 'COMPLETED');

  IF NEW."requiredPlayers" < occupied THEN
    RAISE EXCEPTION 'Game % already has % players; requiredPlayers cannot be %', NEW."id", occupied, NEW."requiredPlayers"
      USING ERRCODE = 'check_violation', CONSTRAINT = 'Game_capacity_roster_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Game_capacity_roster_guard"
BEFORE UPDATE OF "requiredPlayers" ON "Game"
FOR EACH ROW EXECUTE FUNCTION "gora_prevent_capacity_below_roster"();
