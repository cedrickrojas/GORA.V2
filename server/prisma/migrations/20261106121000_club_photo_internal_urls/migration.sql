-- Keep existing HTTP(S) references valid and permit only this club's uploaded photos.
BEGIN;
ALTER TABLE "Club" DROP CONSTRAINT "Club_urls_check";
ALTER TABLE "Club" ADD CONSTRAINT "Club_urls_check" CHECK (
  ("profileImageUrl" IS NULL OR
    ("profileImageUrl" ~* '^https?://' AND char_length("profileImageUrl") <= 2048) OR
    "profileImageUrl" ~* ('^/api/v1/clubs/' || id::text || '/photos/profile/[0-9a-f-]{36}$'))
  AND ("coverImageUrl" IS NULL OR
    ("coverImageUrl" ~* '^https?://' AND char_length("coverImageUrl") <= 2048) OR
    "coverImageUrl" ~* ('^/api/v1/clubs/' || id::text || '/photos/cover/[0-9a-f-]{36}$'))
  AND ("websiteUrl" IS NULL OR ("websiteUrl" ~* '^https?://' AND char_length("websiteUrl") <= 2048))
  AND ("facebookUrl" IS NULL OR ("facebookUrl" ~* '^https?://' AND char_length("facebookUrl") <= 2048))
  AND ("instagramUrl" IS NULL OR ("instagramUrl" ~* '^https?://' AND char_length("instagramUrl") <= 2048))
  AND ("tiktokUrl" IS NULL OR ("tiktokUrl" ~* '^https?://' AND char_length("tiktokUrl") <= 2048))
);
COMMIT;
