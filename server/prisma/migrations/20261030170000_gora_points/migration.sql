CREATE TYPE "GoraPointReason" AS ENUM ('ACCOUNT_CREATED', 'DAILY_LOGIN', 'GAME_CREATED', 'FOLLOWER_GAINED', 'POST_CREATED', 'GAME_COMPLETED_HOST', 'GAME_COMPLETED_PLAYER');

ALTER TABLE "User" ADD COLUMN "goraPoints" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "GoraPointEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "reason" "GoraPointReason" NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoraPointEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoraPointEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoraPointEvent_userId_reason_sourceKey_key" ON "GoraPointEvent"("userId", "reason", "sourceKey");
CREATE INDEX "GoraPointEvent_userId_createdAt_idx" ON "GoraPointEvent"("userId", "createdAt");