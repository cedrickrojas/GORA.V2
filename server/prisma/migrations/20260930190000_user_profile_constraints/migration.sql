-- Profile and sports-profile rules enforced by the database as well as the API DTOs.
-- Constraints only: no tables or columns change, and existing rows already comply.

-- Names are required and at most 50 characters (register and PATCH /profiles/me).
ALTER TABLE "User" ADD CONSTRAINT "User_names_check" CHECK (
  char_length(btrim("firstName")) BETWEEN 1 AND 50
  AND char_length(btrim("lastName")) BETWEEN 1 AND 50
);

-- A city is either absent or 1-100 non-blank characters.
ALTER TABLE "User" ADD CONSTRAINT "User_city_check" CHECK (
  "city" IS NULL OR char_length(btrim("city")) BETWEEN 1 AND 100
);

-- Images live in external storage; only their http(s) URLs are stored, never binaries.
ALTER TABLE "User" ADD CONSTRAINT "User_image_urls_check" CHECK (
  ("profileImageUrl" IS NULL OR ("profileImageUrl" ~ '^https?://' AND char_length("profileImageUrl") <= 2048))
  AND ("coverImageUrl" IS NULL OR ("coverImageUrl" ~ '^https?://' AND char_length("coverImageUrl") <= 2048))
);

-- A position is optional for every sport; when present it is 1-40 non-blank characters.
ALTER TABLE "UserSport" ADD CONSTRAINT "UserSport_position_check" CHECK (
  "position" IS NULL OR char_length(btrim("position")) BETWEEN 1 AND 40
);
