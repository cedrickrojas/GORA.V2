CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'FRIENDS');

CREATE TABLE "UserSettings" (
    "userId" UUID NOT NULL,
    "notifyFriends" BOOLEAN NOT NULL DEFAULT true,
    "notifyGames" BOOLEAN NOT NULL DEFAULT true,
    "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
    "notifyContent" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "defaultDistanceKm" INTEGER,
    "useDeviceLocation" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
