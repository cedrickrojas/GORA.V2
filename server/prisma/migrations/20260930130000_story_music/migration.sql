-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "musicArtist" TEXT,
ADD COLUMN     "musicDuration" INTEGER,
ADD COLUMN     "musicStartTime" INTEGER,
ADD COLUMN     "musicTitle" TEXT,
ADD COLUMN     "musicTrackId" UUID;

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTrackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "artworkUrl" TEXT,
    "previewUrl" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicTrack_isActive_idx" ON "MusicTrack"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MusicTrack_provider_providerTrackId_key" ON "MusicTrack"("provider", "providerTrackId");

-- CreateIndex
CREATE INDEX "Story_musicTrackId_idx" ON "Story"("musicTrackId");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "MusicTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Music is optional, but a segment is all-or-nothing: start and duration are
-- set together, start is not negative, duration is positive, and any music
-- (track or segment) carries a title to display.
ALTER TABLE "Story" ADD CONSTRAINT "Story_music_segment_check" CHECK (
  ("musicStartTime" IS NULL) = ("musicDuration" IS NULL)
  AND ("musicStartTime" IS NULL OR "musicStartTime" >= 0)
  AND ("musicDuration" IS NULL OR "musicDuration" > 0)
);
ALTER TABLE "Story" ADD CONSTRAINT "Story_music_title_check" CHECK (
  ("musicTrackId" IS NULL AND "musicStartTime" IS NULL AND "musicArtist" IS NULL)
  OR "musicTitle" IS NOT NULL
);
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_duration_check" CHECK ("durationSeconds" > 0);
