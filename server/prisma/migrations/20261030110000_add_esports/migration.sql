-- Add the category to existing installations without changing a sport already managed by an admin.
INSERT INTO "Sport" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Esports',
  'Competitive video games, team matches, and tournaments.',
  true,
  timezone('UTC', now()),
  timezone('UTC', now())
)
ON CONFLICT ("name") DO NOTHING;
