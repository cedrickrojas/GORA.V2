ALTER TYPE "GoraPointReason" ADD VALUE 'GAME_CANCELLED_PLAYER';
ALTER TYPE "NotificationType" ADD VALUE 'GAME_LEAVE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'GAME_LEAVE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'GAME_LEAVE_REJECTED';

CREATE TYPE "GameLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "GameLeaveRequest" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "GameLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "GameLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameLeaveRequest_gameId_userId_key" ON "GameLeaveRequest"("gameId", "userId");
CREATE INDEX "GameLeaveRequest_gameId_status_idx" ON "GameLeaveRequest"("gameId", "status");
CREATE INDEX "GameLeaveRequest_userId_status_idx" ON "GameLeaveRequest"("userId", "status");

ALTER TABLE "GameLeaveRequest" ADD CONSTRAINT "GameLeaveRequest_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameLeaveRequest" ADD CONSTRAINT "GameLeaveRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
