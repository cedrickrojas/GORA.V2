-- Prisma stores DateTime values as UTC in TIMESTAMP(3) columns, but
-- CURRENT_TIMESTAMP is converted to the session time zone. On a database that
-- is not set to UTC, trigger-written timestamps were ahead of every value
-- Prisma wrote (an owner's joinedAt looked like it was in the future, which
-- hid club chat unread counts). Triggers now write UTC like Prisma does.

CREATE OR REPLACE FUNCTION gora_sync_club_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."ownerId" IS DISTINCT FROM NEW."ownerId" THEN
    UPDATE "ClubMember"
      SET "role" = 'ADMIN', "updatedAt" = timezone('UTC', now())
      WHERE "clubId" = NEW."id" AND "userId" = OLD."ownerId" AND "role" = 'OWNER';
  END IF;

  INSERT INTO "ClubMember" ("id", "clubId", "userId", "role", "status", "joinedAt", "updatedAt")
    VALUES (gen_random_uuid(), NEW."id", NEW."ownerId", 'OWNER', 'ACTIVE', timezone('UTC', now()), timezone('UTC', now()))
    ON CONFLICT ("clubId", "userId")
    DO UPDATE SET "role" = 'OWNER', "status" = 'ACTIVE', "updatedAt" = timezone('UTC', now());

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION gora_create_club_chat() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "Conversation" ("id", "type", "clubId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'CLUB', NEW."id", timezone('UTC', now()), timezone('UTC', now()))
    ON CONFLICT ("clubId") DO NOTHING;

  RETURN NULL;
END;
$$;

-- Repair rows the old triggers wrote. An owner row inserted with its club sits
-- exactly one session-offset after the club's createdAt; move it back to the
-- club's creation time. Rows written by the application are left alone.
UPDATE "ClubMember" m
  SET "joinedAt" = c."createdAt"
  FROM "Club" c
  WHERE m."clubId" = c."id"
    AND m."userId" = c."ownerId"
    AND m."role" = 'OWNER'
    AND (CURRENT_TIMESTAMP::timestamp - timezone('UTC', now())) <> interval '0'
    AND abs(extract(epoch FROM (
      m."joinedAt" - c."createdAt" - (CURRENT_TIMESTAMP::timestamp - timezone('UTC', now()))
    ))) < 300;

-- Club chats are brand new: their createdAt is the club's, and updatedAt is the
-- latest message, or the club's creation time while the chat is empty.
UPDATE "Conversation" v
  SET "createdAt" = c."createdAt",
      "updatedAt" = GREATEST(
        c."createdAt",
        COALESCE((SELECT max(msg."createdAt") FROM "Message" msg WHERE msg."conversationId" = v."id"), c."createdAt")
      )
  FROM "Club" c
  WHERE v."type" = 'CLUB' AND v."clubId" = c."id";
