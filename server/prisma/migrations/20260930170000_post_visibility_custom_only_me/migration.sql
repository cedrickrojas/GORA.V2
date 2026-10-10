-- AlterEnum
-- New enum values must be committed before any constraint or query uses them,
-- so they get their own migration.
ALTER TYPE "PostVisibility" ADD VALUE 'CUSTOM';
ALTER TYPE "PostVisibility" ADD VALUE 'ONLY_ME';
