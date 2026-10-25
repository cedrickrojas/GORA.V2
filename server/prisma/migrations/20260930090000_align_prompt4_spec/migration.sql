-- Aligns the schema with the final Prompt 4 specification.
-- Additive or in-place only: renamed enums are converted with casts, so no
-- column is dropped and existing rows (if any) keep their values.

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'LEFT', 'COMPLETED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'FRIENDS');

-- CreateEnum
CREATE TYPE "ReelVisibility" AS ENUM ('PUBLIC', 'FRIENDS');

-- CreateEnum
CREATE TYPE "StoryMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterEnum
ALTER TYPE "LiveStreamStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "MessageType_new" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE');
ALTER TABLE "public"."Message" ALTER COLUMN "messageType" DROP DEFAULT;
ALTER TABLE "Message" ALTER COLUMN "messageType" TYPE "MessageType_new" USING ("messageType"::text::"MessageType_new");
ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "public"."MessageType_old";
ALTER TABLE "Message" ALTER COLUMN "messageType" SET DEFAULT 'TEXT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'GAME_JOIN_REQUEST', 'GAME_JOIN_ACCEPTED', 'GAME_JOIN_REJECTED', 'GAME_FULL', 'GAME_CANCELLED', 'GAME_COMPLETED', 'NEW_MESSAGE', 'MESSAGE_REQUEST', 'POST_LIKE', 'POST_COMMENT', 'REEL_LIKE', 'REEL_COMMENT', 'STORY_REPLY', 'BADGE_UNLOCKED', 'LIVE_STARTED');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "latitude" SET NOT NULL,
ALTER COLUMN "longitude" SET NOT NULL;

-- AlterTable
ALTER TABLE "GameParticipant" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GameParticipant" ALTER COLUMN "status" TYPE "ParticipantStatus" USING ("status"::text::"ParticipantStatus");
ALTER TABLE "GameParticipant" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "JoinRequest" ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "visibility" TYPE "PostVisibility" USING ("visibility"::text::"PostVisibility");
ALTER TABLE "Post" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "PostMedia" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Reel" ALTER COLUMN "durationSeconds" DROP NOT NULL;
ALTER TABLE "Reel" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "Reel" ALTER COLUMN "visibility" TYPE "ReelVisibility" USING ("visibility"::text::"ReelVisibility");
ALTER TABLE "Reel" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Story" ALTER COLUMN "mediaType" TYPE "StoryMediaType" USING ("mediaType"::text::"StoryMediaType");

-- DropEnum (no column references these types any more)
DROP TYPE "GameParticipantStatus";

-- DropEnum
DROP TYPE "Visibility";
