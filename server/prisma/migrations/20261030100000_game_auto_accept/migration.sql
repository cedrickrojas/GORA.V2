-- Existing games keep manual host approval. The setting applies to new requests.
ALTER TABLE "Game" ADD COLUMN "autoAccept" BOOLEAN NOT NULL DEFAULT false;
