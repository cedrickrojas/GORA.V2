-- Preserve external URLs and allow only server-generated local video references.
ALTER TABLE "Reel" DROP CONSTRAINT "Reel_video_url_check";
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_video_url_check" CHECK (
  (
    ("videoUrl" ~ '^https?://' AND char_length("videoUrl") <= 2048)
    OR "videoUrl" ~ '^upload:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm)$'
  )
  AND ("thumbnailUrl" IS NULL OR ("thumbnailUrl" ~ '^https?://' AND char_length("thumbnailUrl") <= 2048))
);
