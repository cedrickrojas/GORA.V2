CREATE TABLE "ClubPhoto" (
 "clubId" UUID NOT NULL,
 "kind" VARCHAR(7) NOT NULL CHECK ("kind" IN ('profile','cover')),
 "revision" UUID NOT NULL,
 "data" BYTEA NOT NULL CHECK (octet_length("data") BETWEEN 1 AND 262144),
 "contentType" VARCHAR(20) NOT NULL CHECK ("contentType" IN ('image/jpeg','image/png','image/webp')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ClubPhoto_pkey" PRIMARY KEY ("clubId","kind"),
 CONSTRAINT "ClubPhoto_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
