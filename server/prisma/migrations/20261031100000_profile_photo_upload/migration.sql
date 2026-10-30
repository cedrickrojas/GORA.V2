ALTER TABLE "User"
  ADD COLUMN "profilePhotoData" BYTEA,
  ADD COLUMN "profilePhotoType" TEXT,
  ADD COLUMN "profilePhotoRevision" UUID;
