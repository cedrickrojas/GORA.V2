-- Both coordinates or neither. The first version let a lone latitude through
-- because a CHECK passes when its expression is NULL.
ALTER TABLE "Club" DROP CONSTRAINT "Club_coordinates_check";

ALTER TABLE "Club"
  ADD CONSTRAINT "Club_coordinates_check"
    CHECK (
      ("latitude" IS NULL AND "longitude" IS NULL)
      OR (
        "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        AND "latitude" BETWEEN -90 AND 90
        AND "longitude" BETWEEN -180 AND 180
      )
    );