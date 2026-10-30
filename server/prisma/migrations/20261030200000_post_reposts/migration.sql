ALTER TABLE "Post" ADD COLUMN "sharedPostId" UUID;

CREATE INDEX "Post_sharedPostId_idx" ON "Post"("sharedPostId");

ALTER TABLE "Post"
ADD CONSTRAINT "Post_sharedPostId_fkey"
FOREIGN KEY ("sharedPostId") REFERENCES "Post"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
