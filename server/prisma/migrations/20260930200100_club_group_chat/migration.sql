-- Club group chats. Only a club has a group chat, exactly one, created together
-- with the club. Access comes from ACTIVE ClubMember rows, never from a user
-- adding people to a conversation.

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "clubId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_clubId_key" ON "Conversation"("clubId");

-- AddForeignKey
-- Clubs are disabled with isActive, not deleted. If a club row is deleted anyway,
-- an empty chat goes with it, but Message_conversationId_fkey (RESTRICT) blocks
-- the delete while the chat has messages, so history is never silently removed.
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DIRECT: no game or club. GAME: no club and no direct key (gameId becomes null
-- if the game is deleted). CLUB: a club, and nothing else.
ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_context_check" CHECK (
    ("type" = 'DIRECT' AND "gameId" IS NULL AND "clubId" IS NULL)
    OR ("type" = 'GAME' AND "clubId" IS NULL AND "directKey" IS NULL)
    OR ("type" = 'CLUB' AND "clubId" IS NOT NULL AND "gameId" IS NULL AND "directKey" IS NULL)
  );

-- Creating a club creates its official chat in the same transaction, so a club
-- never exists without one; if this insert fails, the club insert fails too.
CREATE OR REPLACE FUNCTION gora_create_club_chat() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "Conversation" ("id", "type", "clubId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'CLUB', NEW."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("clubId") DO NOTHING;

  RETURN NULL;
END;
$$;

CREATE TRIGGER "Club_create_chat"
  AFTER INSERT ON "Club"
  FOR EACH ROW EXECUTE FUNCTION gora_create_club_chat();

-- Clubs created before this migration get their chat now.
INSERT INTO "Conversation" ("id", "type", "clubId", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), 'CLUB', c."id", c."createdAt", CURRENT_TIMESTAMP
  FROM "Club" c
  ON CONFLICT ("clubId") DO NOTHING;

-- A conversation keeps its type and context: a direct chat cannot become a group
-- chat, and a club chat cannot move to another club. The only allowed change is
-- gameId becoming null when its game is deleted.
CREATE OR REPLACE FUNCTION gora_guard_conversation_context() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."type" <> OLD."type"
    OR NEW."clubId" IS DISTINCT FROM OLD."clubId"
    OR NEW."directKey" IS DISTINCT FROM OLD."directKey"
    OR (NEW."gameId" IS DISTINCT FROM OLD."gameId" AND NEW."gameId" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'A conversation''s type and context cannot change'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Conversation_guard_context"
  BEFORE UPDATE OF "type", "clubId", "gameId", "directKey" ON "Conversation"
  FOR EACH ROW EXECUTE FUNCTION gora_guard_conversation_context();

-- Participants: a direct conversation has at most two people (no user-made group
-- chats), and a club chat only keeps read state for ACTIVE members of an active
-- club. Locking the conversation row serializes concurrent inserts.
CREATE OR REPLACE FUNCTION gora_guard_conversation_participant() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  conversation_type "ConversationType";
  conversation_club uuid;
BEGIN
  SELECT "type", "clubId" INTO conversation_type, conversation_club
    FROM "Conversation" WHERE "id" = NEW."conversationId" FOR UPDATE;

  IF conversation_type = 'DIRECT' AND (
    SELECT count(*) FROM "ConversationParticipant"
    WHERE "conversationId" = NEW."conversationId" AND "id" <> NEW."id"
  ) >= 2 THEN
    RAISE EXCEPTION 'A direct conversation has two people; group chats belong to clubs'
      USING ERRCODE = 'check_violation';
  END IF;

  IF conversation_type = 'CLUB' AND NOT EXISTS (
    SELECT 1
    FROM "ClubMember" m
    JOIN "Club" c ON c."id" = m."clubId"
    WHERE m."clubId" = conversation_club
      AND m."userId" = NEW."userId"
      AND m."status" = 'ACTIVE'
      AND c."isActive"
  ) THEN
    RAISE EXCEPTION 'Only active members of an active club can join its chat'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ConversationParticipant_guard"
  BEFORE INSERT OR UPDATE OF "conversationId", "userId" ON "ConversationParticipant"
  FOR EACH ROW EXECUTE FUNCTION gora_guard_conversation_participant();

-- Senders: club chat messages come from ACTIVE members of an active club (so a
-- removed, banned, or departed member, or a disabled club, cannot post), and
-- direct messages come from one of the two participants.
CREATE OR REPLACE FUNCTION gora_guard_message_sender() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  conversation_type "ConversationType";
  conversation_club uuid;
BEGIN
  SELECT "type", "clubId" INTO conversation_type, conversation_club
    FROM "Conversation" WHERE "id" = NEW."conversationId";

  IF conversation_type = 'CLUB' AND NOT EXISTS (
    SELECT 1
    FROM "ClubMember" m
    JOIN "Club" c ON c."id" = m."clubId"
    WHERE m."clubId" = conversation_club
      AND m."userId" = NEW."senderId"
      AND m."status" = 'ACTIVE'
      AND c."isActive"
  ) THEN
    RAISE EXCEPTION 'Only active members of an active club can send messages to its chat'
      USING ERRCODE = 'check_violation';
  END IF;

  IF conversation_type = 'DIRECT' AND NOT EXISTS (
    SELECT 1 FROM "ConversationParticipant"
    WHERE "conversationId" = NEW."conversationId" AND "userId" = NEW."senderId"
  ) THEN
    RAISE EXCEPTION 'Only the people in a direct conversation can send messages to it'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Message_guard_sender"
  BEFORE INSERT OR UPDATE OF "conversationId", "senderId" ON "Message"
  FOR EACH ROW EXECUTE FUNCTION gora_guard_message_sender();
