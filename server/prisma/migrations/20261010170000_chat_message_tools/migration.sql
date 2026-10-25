ALTER TABLE "Message" ADD COLUMN "attachmentData" BYTEA,
ADD COLUMN "attachmentType" TEXT,
ADD COLUMN "pinnedAt" TIMESTAMP(3),
ADD COLUMN "isForwarded" BOOLEAN NOT NULL DEFAULT false;
