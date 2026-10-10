-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "PostTag" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostTag_userId_createdAt_idx" ON "PostTag"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostTag_postId_userId_key" ON "PostTag"("postId", "userId");

-- CreateIndex
CREATE INDEX "Post_latitude_longitude_idx" ON "Post"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A post location is a named place with coordinates, or nothing. Each column is tested
-- with IS NOT NULL because a CHECK passes when its expression is NULL.
ALTER TABLE "Post" ADD CONSTRAINT "Post_location_check" CHECK (
  ("locationName" IS NULL AND "latitude" IS NULL AND "longitude" IS NULL)
  OR (
    "locationName" IS NOT NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    AND char_length(btrim("locationName")) BETWEEN 1 AND 120
    AND "latitude" BETWEEN -90 AND 90
    AND "longitude" BETWEEN -180 AND 180
  )
);

-- Every game already needs a venue name and coordinates; the name must also have text.
ALTER TABLE "Game" ADD CONSTRAINT "Game_location_name_check" CHECK (char_length(btrim("locationName")) > 0);

-- Authors do not tag themselves.
CREATE FUNCTION "post_tag_not_author"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Post" WHERE "id" = NEW."postId" AND "userId" = NEW."userId") THEN
    RAISE EXCEPTION 'A post author cannot tag themselves'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PostTag_not_author"
  BEFORE INSERT OR UPDATE ON "PostTag"
  FOR EACH ROW EXECUTE FUNCTION "post_tag_not_author"();
