CREATE TABLE "CloudMediaUpload" (
  "id" uuid PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "resource" text NOT NULL CHECK ("resource" IN ('stories','reels')),
  "contentType" text NOT NULL CHECK ("contentType" IN ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm')),
  "size" integer NOT NULL CHECK ("size" BETWEEN 1 AND 52428800),
  "expiresAt" timestamp(3) NOT NULL,
  "claimedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT timezone('UTC',now())
);
CREATE INDEX "CloudMediaUpload_userId_claimedAt_expiresAt_idx" ON "CloudMediaUpload"("userId","claimedAt","expiresAt");
ALTER TABLE "Story" DROP CONSTRAINT "Story_media_url_check";
ALTER TABLE "Story" ADD CONSTRAINT "Story_media_url_check" CHECK (
  (("mediaUrl" ~ '^https?://' AND char_length("mediaUrl") <= 2048)
   OR ("mediaType"='IMAGE' AND "mediaUrl" ~ '^(upload|blob):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|gif)$')
   OR ("mediaType"='VIDEO' AND "mediaUrl" ~ '^(upload|blob):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm)$'))
  AND ("thumbnailUrl" IS NULL OR ("thumbnailUrl" ~ '^https?://' AND char_length("thumbnailUrl") <= 2048))
);
ALTER TABLE "Reel" DROP CONSTRAINT "Reel_video_url_check";
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_video_url_check" CHECK (
  (("videoUrl" ~ '^https?://' AND char_length("videoUrl") <= 2048)
   OR "videoUrl" ~ '^(upload|blob):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm)$')
  AND ("thumbnailUrl" IS NULL OR ("thumbnailUrl" ~ '^https?://' AND char_length("thumbnailUrl") <= 2048))
);
