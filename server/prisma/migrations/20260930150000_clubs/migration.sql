-- CreateEnum
CREATE TYPE "ClubMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClubMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED', 'BANNED');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "clubId" UUID;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "clubId" UUID,
ADD COLUMN     "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sportId" UUID;

-- AlterTable
ALTER TABLE "Reel" ADD COLUMN     "clubId" UUID;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "clubId" UUID;

-- CreateTable
CREATE TABLE "Club" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "profileImageUrl" TEXT,
    "coverImageUrl" TEXT,
    "sportId" UUID,
    "city" TEXT,
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMember" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ClubMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "ClubMemberStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubFollow" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE INDEX "Club_ownerId_idx" ON "Club"("ownerId");

-- CreateIndex
CREATE INDEX "Club_sportId_idx" ON "Club"("sportId");

-- CreateIndex
CREATE INDEX "Club_city_idx" ON "Club"("city");

-- CreateIndex
CREATE INDEX "Club_isActive_isPublic_idx" ON "Club"("isActive", "isPublic");

-- CreateIndex
CREATE INDEX "Club_latitude_longitude_idx" ON "Club"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Club_name_idx" ON "Club"("name");

-- CreateIndex
CREATE INDEX "ClubMember_clubId_status_idx" ON "ClubMember"("clubId", "status");

-- CreateIndex
CREATE INDEX "ClubMember_userId_status_idx" ON "ClubMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMember_clubId_userId_key" ON "ClubMember"("clubId", "userId");

-- CreateIndex
CREATE INDEX "ClubFollow_userId_idx" ON "ClubFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubFollow_clubId_userId_key" ON "ClubFollow"("clubId", "userId");

-- CreateIndex
CREATE INDEX "Game_clubId_startTime_idx" ON "Game"("clubId", "startTime");

-- CreateIndex
CREATE INDEX "Post_clubId_createdAt_idx" ON "Post"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_sportId_createdAt_idx" ON "Post"("sportId", "createdAt");

-- CreateIndex
CREATE INDEX "Reel_clubId_createdAt_idx" ON "Reel"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_clubId_idx" ON "Report"("clubId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubFollow" ADD CONSTRAINT "ClubFollow_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubFollow" ADD CONSTRAINT "ClubFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==================================================
-- Club rules the Prisma schema cannot express
-- ==================================================

ALTER TABLE "Club"
  ADD CONSTRAINT "Club_slug_format_check"
    CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 3 AND 50),
  ADD CONSTRAINT "Club_name_check"
    CHECK (char_length(btrim("name")) BETWEEN 2 AND 80),
  ADD CONSTRAINT "Club_coordinates_check"
    CHECK (
      ("latitude" IS NULL AND "longitude" IS NULL)
      OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
    );

-- The owner's membership is always ACTIVE, and a club has exactly one OWNER row.
ALTER TABLE "ClubMember"
  ADD CONSTRAINT "ClubMember_owner_active_check" CHECK ("role" <> 'OWNER' OR "status" = 'ACTIVE');

CREATE UNIQUE INDEX "ClubMember_one_owner_idx" ON "ClubMember"("clubId") WHERE "role" = 'OWNER';

-- Creating a club adds the owner as an ACTIVE OWNER member. Transferring
-- ownership demotes the previous owner to ADMIN and promotes the new one.
CREATE OR REPLACE FUNCTION gora_sync_club_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."ownerId" IS DISTINCT FROM NEW."ownerId" THEN
    UPDATE "ClubMember"
      SET "role" = 'ADMIN', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "clubId" = NEW."id" AND "userId" = OLD."ownerId" AND "role" = 'OWNER';
  END IF;

  INSERT INTO "ClubMember" ("id", "clubId", "userId", "role", "status", "joinedAt", "updatedAt")
    VALUES (gen_random_uuid(), NEW."id", NEW."ownerId", 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("clubId", "userId")
    DO UPDATE SET "role" = 'OWNER', "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER "Club_sync_owner"
  AFTER INSERT OR UPDATE OF "ownerId" ON "Club"
  FOR EACH ROW EXECUTE FUNCTION gora_sync_club_owner();

-- Only Club.ownerId may hold the OWNER role, and the owner's row cannot be
-- demoted, removed, banned, or deleted while they still own the club.
CREATE OR REPLACE FUNCTION gora_guard_club_owner_membership() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  club_owner uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."role" = 'OWNER' THEN
    SELECT "ownerId" INTO club_owner FROM "Club" WHERE "id" = OLD."clubId";

    IF club_owner = OLD."userId" AND (
      TG_OP = 'DELETE'
      OR NEW."role" <> 'OWNER'
      OR NEW."status" <> 'ACTIVE'
      OR NEW."userId" <> OLD."userId"
      OR NEW."clubId" <> OLD."clubId"
    ) THEN
      RAISE EXCEPTION 'Transfer club ownership before changing the owner''s membership'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW."role" = 'OWNER' THEN
    SELECT "ownerId" INTO club_owner FROM "Club" WHERE "id" = NEW."clubId";

    IF club_owner IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'Only the club owner can have the OWNER role'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ClubMember_guard_owner"
  BEFORE INSERT OR UPDATE OR DELETE ON "ClubMember"
  FOR EACH ROW EXECUTE FUNCTION gora_guard_club_owner_membership();

-- Club posts, games, and reels come from active members of an active club.
-- TG_ARGV[0] names the author column ("userId" for posts and reels, "hostId"
-- for games). The host stays the organizer; the club is the community.
CREATE OR REPLACE FUNCTION gora_require_club_member() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  author uuid;
BEGIN
  IF NEW."clubId" IS NULL THEN
    RETURN NEW;
  END IF;

  author := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM "ClubMember" m
    JOIN "Club" c ON c."id" = m."clubId"
    WHERE m."clubId" = NEW."clubId"
      AND m."userId" = author
      AND m."status" = 'ACTIVE'
      AND c."isActive"
  ) THEN
    RAISE EXCEPTION 'Only active members of an active club can post club content'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Post_require_club_member"
  BEFORE INSERT OR UPDATE OF "clubId", "userId" ON "Post"
  FOR EACH ROW EXECUTE FUNCTION gora_require_club_member('userId');

CREATE TRIGGER "Reel_require_club_member"
  BEFORE INSERT OR UPDATE OF "clubId", "userId" ON "Reel"
  FOR EACH ROW EXECUTE FUNCTION gora_require_club_member('userId');

CREATE TRIGGER "Game_require_club_member"
  BEFORE INSERT OR UPDATE OF "clubId", "hostId" ON "Game"
  FOR EACH ROW EXECUTE FUNCTION gora_require_club_member('hostId');
