-- A club's official group chat. Kept in its own migration: PostgreSQL cannot use a
-- new enum value inside the transaction that adds it.
ALTER TYPE "ConversationType" ADD VALUE 'CLUB';
