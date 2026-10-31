-- Uploaded profile pictures use an internal API route as their stored reference.
-- Keep external image URLs valid while allowing only that exact route shape.
ALTER TABLE "User" DROP CONSTRAINT "User_image_urls_check";

ALTER TABLE "User" ADD CONSTRAINT "User_image_urls_check" CHECK (
  (
    "profileImageUrl" IS NULL
    OR (
      ("profileImageUrl" ~ '^https?://' AND char_length("profileImageUrl") <= 2048)
      OR "profileImageUrl" ~* '^/api/v1/profiles/[0-9a-f-]{36}/photo/[0-9a-f-]{36}$'
    )
  )
  AND (
    "coverImageUrl" IS NULL
    OR ("coverImageUrl" ~ '^https?://' AND char_length("coverImageUrl") <= 2048)
  )
);
