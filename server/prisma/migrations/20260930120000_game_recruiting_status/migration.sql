-- Keep Game.status OPEN or FULL from occupying GameParticipant rows.
-- ACTIVE and COMPLETED occupy a slot; LEFT and REMOVED do not.
-- Does not change ACTIVE, COMPLETED, or CANCELLED games.

CREATE FUNCTION "gora_refresh_recruiting_status"(target uuid) RETURNS void
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
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = target
    AND "status" IN ('OPEN', 'FULL');
END;
$$;

CREATE FUNCTION "gora_sync_recruiting_status_from_participant"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "gora_refresh_recruiting_status"(COALESCE(NEW."gameId", OLD."gameId"));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE FUNCTION "gora_sync_recruiting_status_from_game"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "gora_refresh_recruiting_status"(NEW."id");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GameParticipant_sync_recruiting_status"
AFTER INSERT OR DELETE OR UPDATE OF "status", "gameId" ON "GameParticipant"
FOR EACH ROW EXECUTE FUNCTION "gora_sync_recruiting_status_from_participant"();

CREATE TRIGGER "Game_sync_recruiting_status"
AFTER UPDATE OF "requiredPlayers" ON "Game"
FOR EACH ROW EXECUTE FUNCTION "gora_sync_recruiting_status_from_game"();
