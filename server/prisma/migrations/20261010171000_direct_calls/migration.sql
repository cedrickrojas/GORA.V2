CREATE TABLE "DirectCall" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "callerId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "calleeId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('AUDIO', 'VIDEO')),
  "status" TEXT NOT NULL DEFAULT 'RINGING' CHECK ("status" IN ('RINGING', 'ACTIVE', 'ENDED', 'DECLINED', 'MISSED')),
  "offer" TEXT NOT NULL,
  "answer" TEXT,
  "callerCandidates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "calleeCandidates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "callerSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calleeSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "DirectCall_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DirectCall_distinct_people" CHECK ("callerId" <> "calleeId")
);
CREATE INDEX "DirectCall_calleeId_status_idx" ON "DirectCall"("calleeId", "status");
CREATE INDEX "DirectCall_callerId_status_idx" ON "DirectCall"("callerId", "status");
CREATE UNIQUE INDEX "DirectCall_one_active" ON "DirectCall"("conversationId") WHERE status IN ('RINGING', 'ACTIVE');
