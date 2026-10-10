-- External URLs remain supported; local files are referenced only by generated names.
ALTER TABLE "Story" DROP CONSTRAINT "Story_media_url_check";
ALTER TABLE "Story" ADD CONSTRAINT "Story_media_url_check" CHECK (
  (
    ("mediaUrl" ~ '^https?://' AND char_length("mediaUrl") <= 2048)
    OR ("mediaType" = 'IMAGE' AND "mediaUrl" ~ '^upload:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|gif)$')
    OR ("mediaType" = 'VIDEO' AND "mediaUrl" ~ '^upload:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm)$')
  )
  AND ("thumbnailUrl" IS NULL OR ("thumbnailUrl" ~ '^https?://' AND char_length("thumbnailUrl") <= 2048))
);
