-- Existing accounts did not receive the ACCOUNT_CREATED award when GORA Points
-- launched. Award it once to accounts without a signup event, keeping prior points.
WITH newly_credited AS (
  INSERT INTO "GoraPointEvent" ("userId", reason, "sourceKey", points)
  SELECT
    u.id,
    'ACCOUNT_CREATED'::"GoraPointReason",
    'existing-account-backfill-v1',
    1
  FROM "User" AS u
  WHERE NOT EXISTS (
    SELECT 1
    FROM "GoraPointEvent" AS existing
    WHERE existing."userId" = u.id
      AND existing.reason = 'ACCOUNT_CREATED'::"GoraPointReason"
  )
  ON CONFLICT ("userId", reason, "sourceKey") DO NOTHING
  RETURNING "userId", points
)
UPDATE "User" AS u
SET "goraPoints" = u."goraPoints" + newly_credited.points
FROM newly_credited
WHERE u.id = newly_credited."userId";
