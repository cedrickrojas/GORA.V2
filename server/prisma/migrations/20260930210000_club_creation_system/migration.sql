-- Club creation system: identity, location, membership capacity, join policy,
-- rules, tags, schedule, contact links, additional sports, and invitations.

-- CreateEnum
CREATE TYPE "ClubMembershipType" AS ENUM ('OPEN', 'APPROVAL_REQUIRED', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "ClubActivityDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ClubInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- AlterTable. maxMembers is added with a temporary default so existing clubs get
-- a capacity that fits their current ACTIVE members, then the default is dropped:
-- every new club must choose its own capacity.
ALTER TABLE "Club" ADD COLUMN     "about" TEXT,
ADD COLUMN     "activityDay" "ClubActivityDay",
ADD COLUMN     "activityEndTime" TEXT,
ADD COLUMN     "activityStartTime" TEXT,
ADD COLUMN     "barangay" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "homeCourt" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "maxMembers" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "membershipType" "ClubMembershipType" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "tiktokUrl" TEXT,
ADD COLUMN     "trainingSchedule" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

UPDATE "Club" c
  SET "maxMembers" = GREATEST(
        50,
        (SELECT count(*) FROM "ClubMember" m WHERE m."clubId" = c."id" AND m."status" = 'ACTIVE')
      ),
      "membershipType" = CASE WHEN c."isPublic" THEN 'OPEN'::"ClubMembershipType"
                              ELSE 'APPROVAL_REQUIRED'::"ClubMembershipType" END;

ALTER TABLE "Club" ALTER COLUMN "maxMembers" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ClubSport" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "sportId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubSport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubTag" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubRule" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubInvite" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "inviteeId" UUID NOT NULL,
    "status" "ClubInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ClubInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubSport_sportId_idx" ON "ClubSport"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubSport_clubId_sportId_key" ON "ClubSport"("clubId", "sportId");

-- CreateIndex
CREATE INDEX "ClubTag_tag_idx" ON "ClubTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ClubTag_clubId_tag_key" ON "ClubTag"("clubId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "ClubRule_clubId_position_key" ON "ClubRule"("clubId", "position");

-- CreateIndex
CREATE INDEX "ClubInvite_inviteeId_status_idx" ON "ClubInvite"("inviteeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClubInvite_clubId_inviteeId_key" ON "ClubInvite"("clubId", "inviteeId");

-- AddForeignKey
ALTER TABLE "ClubSport" ADD CONSTRAINT "ClubSport_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubSport" ADD CONSTRAINT "ClubSport_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubTag" ADD CONSTRAINT "ClubTag_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubRule" ADD CONSTRAINT "ClubRule_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvite" ADD CONSTRAINT "ClubInvite_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvite" ADD CONSTRAINT "ClubInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvite" ADD CONSTRAINT "ClubInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================================================
-- Field rules (the API validates the same limits first)
-- ==================================================

ALTER TABLE "Club"
  ADD CONSTRAINT "Club_max_members_check" CHECK ("maxMembers" BETWEEN 1 AND 100000),
  ADD CONSTRAINT "Club_description_check"
    CHECK ("description" IS NULL OR char_length("description") <= 160),
  ADD CONSTRAINT "Club_about_check" CHECK ("about" IS NULL OR char_length("about") <= 2000),
  ADD CONSTRAINT "Club_location_fields_check" CHECK (
    ("country" IS NULL OR char_length("country") <= 80)
    AND ("city" IS NULL OR char_length("city") <= 80)
    AND ("barangay" IS NULL OR char_length("barangay") <= 80)
    AND ("homeCourt" IS NULL OR char_length("homeCourt") <= 120)
    AND ("locationName" IS NULL OR char_length("locationName") <= 120)
  ),
  ADD CONSTRAINT "Club_activity_time_check" CHECK (
    ("activityStartTime" IS NULL OR "activityStartTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    AND ("activityEndTime" IS NULL OR "activityEndTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  ),
  ADD CONSTRAINT "Club_training_schedule_check"
    CHECK ("trainingSchedule" IS NULL OR char_length("trainingSchedule") <= 300),
  ADD CONSTRAINT "Club_contact_email_check"
    CHECK ("contactEmail" IS NULL OR (char_length("contactEmail") <= 254 AND "contactEmail" ~ '^[^@\s]+@[^@\s]+$')),
  ADD CONSTRAINT "Club_urls_check" CHECK (
    ("profileImageUrl" IS NULL OR ("profileImageUrl" ~* '^https?://' AND char_length("profileImageUrl") <= 2048))
    AND ("coverImageUrl" IS NULL OR ("coverImageUrl" ~* '^https?://' AND char_length("coverImageUrl") <= 2048))
    AND ("websiteUrl" IS NULL OR ("websiteUrl" ~* '^https?://' AND char_length("websiteUrl") <= 2048))
    AND ("facebookUrl" IS NULL OR ("facebookUrl" ~* '^https?://' AND char_length("facebookUrl") <= 2048))
    AND ("instagramUrl" IS NULL OR ("instagramUrl" ~* '^https?://' AND char_length("instagramUrl") <= 2048))
    AND ("tiktokUrl" IS NULL OR ("tiktokUrl" ~* '^https?://' AND char_length("tiktokUrl") <= 2048))
  );

ALTER TABLE "ClubTag"
  ADD CONSTRAINT "ClubTag_tag_format_check" CHECK ("tag" ~ '^[a-z0-9]{2,30}$');

ALTER TABLE "ClubRule"
  ADD CONSTRAINT "ClubRule_position_check" CHECK ("position" >= 1),
  ADD CONSTRAINT "ClubRule_text_check" CHECK (char_length(btrim("text")) BETWEEN 1 AND 200);

ALTER TABLE "ClubInvite"
  ADD CONSTRAINT "ClubInvite_not_self_check" CHECK ("inviterId" <> "inviteeId");

-- ==================================================
-- Capacity: ACTIVE members never exceed Club.maxMembers
-- ==================================================

-- A membership becoming ACTIVE locks its club row, so concurrent joins and
-- approvals queue up and each one sees the count the previous one committed.
-- PENDING, REMOVED, and BANNED rows never take a slot.
CREATE OR REPLACE FUNCTION gora_guard_club_capacity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  capacity integer;
  occupied integer;
BEGIN
  IF NEW."status" <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'ACTIVE' AND OLD."clubId" = NEW."clubId" THEN
    RETURN NEW;
  END IF;

  SELECT "maxMembers" INTO capacity FROM "Club" WHERE "id" = NEW."clubId" FOR UPDATE;

  SELECT count(*) INTO occupied
    FROM "ClubMember"
    WHERE "clubId" = NEW."clubId" AND "status" = 'ACTIVE' AND "id" <> NEW."id";

  IF occupied >= capacity THEN
    RAISE EXCEPTION 'Club is currently full'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ClubMember_capacity_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ClubMember_capacity_guard"
  BEFORE INSERT OR UPDATE OF "status", "clubId" ON "ClubMember"
  FOR EACH ROW EXECUTE FUNCTION gora_guard_club_capacity();

-- Capacity can grow freely but never drop below the current ACTIVE members;
-- members are never removed to make room.
CREATE OR REPLACE FUNCTION gora_guard_club_max_members() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  occupied integer;
BEGIN
  IF NEW."maxMembers" >= OLD."maxMembers" THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO occupied
    FROM "ClubMember"
    WHERE "clubId" = NEW."id" AND "status" = 'ACTIVE';

  IF NEW."maxMembers" < occupied THEN
    RAISE EXCEPTION 'Maximum members cannot be lower than the current active members'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'Club_max_members_roster_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Club_max_members_guard"
  BEFORE UPDATE OF "maxMembers" ON "Club"
  FOR EACH ROW EXECUTE FUNCTION gora_guard_club_max_members();
