-- SDP is private signaling data, accessible only to the host and its viewer.
ALTER TABLE "LiveViewer" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "offer" TEXT, ADD COLUMN "answer" TEXT;
-- Close legacy placeholder sessions before enforcing one broadcast per host.
UPDATE "LiveStream" SET "status" = 'ENDED', "endedAt" = CURRENT_TIMESTAMP WHERE "status" = 'LIVE';
CREATE UNIQUE INDEX "LiveStream_one_active_host" ON "LiveStream" ("hostId") WHERE "status" = 'LIVE';
