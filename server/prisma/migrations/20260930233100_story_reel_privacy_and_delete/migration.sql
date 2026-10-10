-- Stories and reels: audience (Public / Friends / Custom / Only Me) and soft delete.
-- Only nullable columns, a defaulted column, and new tables are added; nothing is dropped.

-- AlterTable
ALTER TABLE "Reel" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "ReelCustomViewer" (
    "id" UUID NOT NULL,
    "reelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelCustomViewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryCustomViewer" (
    "id" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryCustomViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReelCustomViewer_userId_idx" ON "ReelCustomViewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReelCustomViewer_reelId_userId_key" ON "ReelCustomViewer"("reelId", "userId");

-- CreateIndex
CREATE INDEX "StoryCustomViewer_userId_idx" ON "StoryCustomViewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryCustomViewer_storyId_userId_key" ON "StoryCustomViewer"("storyId", "userId");

-- AddForeignKey
ALTER TABLE "ReelCustomViewer" ADD CONSTRAINT "ReelCustomViewer_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelCustomViewer" ADD CONSTRAINT "ReelCustomViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryCustomViewer" ADD CONSTRAINT "StoryCustomViewer_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryCustomViewer" ADD CONSTRAINT "StoryCustomViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Media are URLs to external storage (never files in the database), like profile images.
ALTER TABLE "Story" ADD CONSTRAINT "Story_media_url_check" CHECK (
  "mediaUrl" ~ '^https?://' AND char_length("mediaUrl") <= 2048
  AND ("thumbnailUrl" IS NULL OR ("thumbnailUrl" ~ '^https?://' AND char_length("thumbnailUrl") <= 2048))
);
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_video_url_check" CHECK (
  "videoUrl" ~ '^https?://' AND char_length("videoUrl") <= 2048
  AND ("thumbnailUrl" IS NULL OR ("thumbnailUrl" ~ '^https?://' AND char_length("thumbnailUrl") <= 2048))
);
ALTER TABLE "Story" ADD CONSTRAINT "Story_caption_length_check" CHECK ("caption" IS NULL OR char_length("caption") <= 500);
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_caption_length_check" CHECK ("caption" IS NULL OR char_length("caption") <= 2200);

-- The author always sees their own story or reel, so they are never stored as a custom viewer.
CREATE FUNCTION "story_custom_viewer_not_author"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Story" WHERE "id" = NEW."storyId" AND "userId" = NEW."userId") THEN
    RAISE EXCEPTION 'A story author cannot be a custom viewer of their own story'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StoryCustomViewer_not_author"
  BEFORE INSERT OR UPDATE ON "StoryCustomViewer"
  FOR EACH ROW EXECUTE FUNCTION "story_custom_viewer_not_author"();

CREATE FUNCTION "reel_custom_viewer_not_author"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Reel" WHERE "id" = NEW."reelId" AND "userId" = NEW."userId") THEN
    RAISE EXCEPTION 'A reel author cannot be a custom viewer of their own reel'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReelCustomViewer_not_author"
  BEFORE INSERT OR UPDATE ON "ReelCustomViewer"
  FOR EACH ROW EXECUTE FUNCTION "reel_custom_viewer_not_author"();
