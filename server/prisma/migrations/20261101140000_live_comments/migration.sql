CREATE TABLE "LiveComment" (
    "id" UUID NOT NULL,
    "liveStreamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveComment_liveStreamId_createdAt_idx"
    ON "LiveComment"("liveStreamId", "createdAt");

ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_liveStreamId_fkey"
    FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
