-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coverImageUrl" TEXT;

-- Bio is a short intro under the name on the profile (same limit as the app).
ALTER TABLE "User" ADD CONSTRAINT "User_bio_length_check" CHECK ("bio" IS NULL OR char_length("bio") <= 160);
