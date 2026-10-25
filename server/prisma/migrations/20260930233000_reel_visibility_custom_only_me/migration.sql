-- AlterEnum
-- Reels get the same audience options as posts. New enum values must be committed
-- before any constraint or query uses them, so they get their own migration.
ALTER TYPE "ReelVisibility" ADD VALUE 'CUSTOM';
ALTER TYPE "ReelVisibility" ADD VALUE 'ONLY_ME';
